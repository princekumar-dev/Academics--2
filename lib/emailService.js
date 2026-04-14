import nodemailer from 'nodemailer'
import { resolve4 } from 'dns/promises'

let transporter = null

function buildTransportConfig({ host, port, user, pass, forceIPv4, requireTLS, tlsServername }) {
  const secure = port === 465
  return {
    host,
    port,
    family: forceIPv4 ? 4 : undefined,
    secure,
    requireTLS: secure ? false : requireTLS,
    auth: { user, pass },
    tls: tlsServername ? { servername: tlsServername } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000
  }
}

function shouldRetryWithAlternatePort(error) {
  const code = String(error?.code || '').toUpperCase()
  return code === 'ESOCKET' || code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ENOTFOUND'
}

async function sendWithResend({ to, from, subject, text, html }) {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return { success: false, skipped: true }
  }

  const resendFrom = process.env.RESEND_FROM || from

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [to],
        subject,
        text,
        html
      })
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const providerError = data?.message || data?.error || `Resend HTTP ${response.status}`
      return { success: false, error: `Resend send failed: ${providerError}` }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    return { success: false, error: `Resend request failed: ${error?.message || 'Unknown error'}` }
  }
}

function getTransporter() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const requireTLS = String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true'
  const forceIPv4 = String(process.env.SMTP_FORCE_IPV4 || 'true').toLowerCase() !== 'false'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    return null
  }

  transporter = nodemailer.createTransport(
    buildTransportConfig({ host, port, user, pass, forceIPv4, requireTLS })
  )

  return transporter
}

export async function sendVerificationCodeEmail({ to, code, purpose }) {
  const mailTransporter = getTransporter()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  const actionLabel = purpose === 'login' ? 'sign in' : 'create your account'

  if (!mailTransporter) {
    return {
      success: false,
      error: 'Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.'
    }
  }

  const subject = 'MSEC Academics verification code'
  const text = `Your verification code is ${code}. It is valid for 10 minutes. Use this code to ${actionLabel}.`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 12px;">MSEC Academics Email Verification</h2>
      <p style="margin-bottom: 8px;">Use this one-time code to ${actionLabel}:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 14px 0; color: #0b3b8f;">${code}</div>
      <p style="margin-bottom: 8px;">This code expires in 10 minutes.</p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">If you did not request this code, you can ignore this email.</p>
    </div>
  `

  // Prefer HTTPS provider in production-like environments if configured.
  const resendResult = await sendWithResend({ to, from, subject, text, html })
  if (resendResult.success) {
    return { success: true, messageId: resendResult.messageId }
  }

  try {
    const info = await mailTransporter.sendMail({ from, to, subject, text, html })
    return { success: true, messageId: info?.messageId }
  } catch (error) {
    const host = process.env.SMTP_HOST
    const configuredPort = Number(process.env.SMTP_PORT || 587)
    const requireTLS = String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true'
    const forceIPv4 = String(process.env.SMTP_FORCE_IPV4 || 'true').toLowerCase() !== 'false'
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    // Gmail fallback: if one SMTP port fails due connection/network, try the alternate port once.
    if (host === 'smtp.gmail.com' && shouldRetryWithAlternatePort(error) && user && pass) {
      const fallbackPort = configuredPort === 587 ? 465 : 587
      try {
        const fallbackTransport = nodemailer.createTransport(
          buildTransportConfig({ host, port: fallbackPort, user, pass, forceIPv4, requireTLS })
        )
        const info = await fallbackTransport.sendMail({ from, to, subject, text, html })
        return { success: true, messageId: info?.messageId }
      } catch (fallbackError) {
        console.error('[emailService] Fallback SMTP send failed:', fallbackError)
      }

      // If network still fails and provider returns IPv6-only endpoint in this environment,
      // resolve IPv4 addresses explicitly and retry using those addresses.
      try {
        const ipv4Hosts = await resolve4(host)
        const portsToTry = Array.from(new Set([configuredPort, fallbackPort]))

        for (const smtpPort of portsToTry) {
          for (const ipv4Host of ipv4Hosts.slice(0, 3)) {
            try {
              const ipv4Transport = nodemailer.createTransport(
                buildTransportConfig({
                  host: ipv4Host,
                  port: smtpPort,
                  user,
                  pass,
                  forceIPv4: false,
                  requireTLS,
                  tlsServername: host
                })
              )
              const info = await ipv4Transport.sendMail({ from, to, subject, text, html })
              return { success: true, messageId: info?.messageId }
            } catch {
              // Continue trying other IPv4 address/port combinations.
            }
          }
        }
      } catch (resolveError) {
        console.error('[emailService] IPv4 resolve retry failed:', resolveError)
      }
    }

    console.error('[emailService] Failed to send verification email:', error)

    const code = String(error?.code || '').toUpperCase()
    const responseCode = Number(error?.responseCode || 0)

    if (code === 'EAUTH' || responseCode === 535) {
      return {
        success: false,
        error: 'SMTP authentication failed (Gmail 535). Generate a new Gmail App Password and set SMTP_USER/SMTP_PASS correctly.'
      }
    }

    if (code === 'ESOCKET' || code === 'ECONNECTION') {
      return {
        success: false,
        error: 'Could not connect to SMTP server. Check SMTP host/port and network access.'
      }
    }

    // If SMTP failed and Resend was configured but also failed, prefer provider-specific message.
    if (!resendResult.skipped && resendResult.error) {
      return { success: false, error: resendResult.error }
    }

    return { success: false, error: 'Failed to send verification email. Check SMTP credentials and sender settings.' }
  }
}

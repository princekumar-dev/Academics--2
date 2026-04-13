import nodemailer from 'nodemailer'

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
  const requireTLS = String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    return null
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000
  })

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

  try {
    const info = await mailTransporter.sendMail({ from, to, subject, text, html })
    return { success: true, messageId: info?.messageId }
  } catch (error) {
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

    return { success: false, error: 'Failed to send verification email. Check SMTP credentials and sender settings.' }
  }
}

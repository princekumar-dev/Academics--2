import dotenv from 'dotenv'
import nodemailer from 'nodemailer'

dotenv.config()

const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT || 587)
const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
const requireTLS = String(process.env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true'
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS

const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing SMTP environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  requireTLS,
  auth: { user, pass }
})

try {
  await transporter.verify()
  console.log('SMTP verify success')
  console.log(`Host: ${host}, Port: ${port}, Secure: ${secure}, RequireTLS: ${requireTLS}`)
} catch (e) {
  console.error('SMTP verify failed')
  console.error('code:', e?.code)
  console.error('responseCode:', e?.responseCode)
  console.error('command:', e?.command)
  console.error('message:', e?.message)
  process.exit(1)
}

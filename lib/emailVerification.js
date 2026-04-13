import crypto from 'crypto'
import { EmailVerification } from '../models.js'

const OTP_VALID_MINUTES = 10
const SESSION_VALID_MINUTES = 20
const MAX_VERIFY_ATTEMPTS = 5

function getSecret() {
  return process.env.EMAIL_VERIFICATION_SECRET || 'change-this-email-verification-secret'
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function hashValue(value) {
  return crypto.createHash('sha256').update(`${value}:${getSecret()}`).digest('hex')
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export async function createVerificationRequest({ email, purpose, code, requestIp, userAgent }) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + OTP_VALID_MINUTES * 60 * 1000)

  const doc = new EmailVerification({
    email: normalizeEmail(email),
    purpose,
    codeHash: hashValue(code),
    expiresAt,
    attempts: 0,
    requestIp: requestIp || null,
    userAgent: userAgent || null
  })

  await doc.save()
  return doc
}

export async function verifyOtpCode({ email, purpose, code }) {
  const normalizedEmail = normalizeEmail(email)
  const doc = await EmailVerification.findOne({
    email: normalizedEmail,
    purpose,
    tokenUsedAt: null
  }).sort({ createdAt: -1 })

  if (!doc) {
    return { success: false, status: 404, error: 'Verification request not found. Please request a new code.' }
  }

  const now = new Date()
  if (!doc.expiresAt || doc.expiresAt.getTime() < now.getTime()) {
    return { success: false, status: 410, error: 'Verification code expired. Please request a new code.' }
  }

  if (doc.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { success: false, status: 429, error: 'Too many invalid attempts. Please request a new code.' }
  }

  const expected = doc.codeHash
  const actual = hashValue(String(code || '').trim())
  if (actual !== expected) {
    doc.attempts += 1
    doc.lastAttemptAt = now
    await doc.save()
    return { success: false, status: 401, error: 'Invalid verification code.' }
  }

  const sessionToken = crypto.randomBytes(24).toString('hex')
  doc.verifiedAt = now
  doc.sessionTokenHash = hashValue(sessionToken)
  doc.sessionExpiresAt = new Date(now.getTime() + SESSION_VALID_MINUTES * 60 * 1000)
  doc.lastAttemptAt = now
  await doc.save()

  return {
    success: true,
    verificationToken: sessionToken,
    expiresInMinutes: SESSION_VALID_MINUTES
  }
}

export async function validateVerificationToken({ email, purpose, token }) {
  const normalizedEmail = normalizeEmail(email)
  const tokenHash = hashValue(String(token || '').trim())
  const now = new Date()

  const doc = await EmailVerification.findOne({
    email: normalizedEmail,
    purpose,
    sessionTokenHash: tokenHash,
    verifiedAt: { $ne: null },
    tokenUsedAt: null,
    sessionExpiresAt: { $gt: now }
  }).sort({ createdAt: -1 })

  if (!doc) {
    return { success: false, error: 'Invalid or expired email verification token.' }
  }

  return { success: true, verificationId: doc._id }
}

export async function consumeVerificationToken({ email, purpose, token }) {
  const validation = await validateVerificationToken({ email, purpose, token })
  if (!validation.success) return validation

  await EmailVerification.findByIdAndUpdate(validation.verificationId, {
    $set: { tokenUsedAt: new Date() }
  })

  return { success: true }
}

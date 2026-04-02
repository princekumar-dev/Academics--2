import { connectToDatabase } from '../lib/mongo.js'
import { AccessPolicy, User } from '../models.js'

const DEFAULT_START_MINUTES = 8 * 60 + 30
const DEFAULT_END_MINUTES = 17 * 60
const ACCESS_POLICY_KEY = 'login_window'

const clampMinute = (value, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(23 * 60 + 59, Math.floor(n)))
}

const timeStringToMinutes = (timeString, fallback) => {
  const input = String(timeString || '').trim()
  const match = input.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return fallback

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback

  return hour * 60 + minute
}

const minutesToTimeString = (minutes) => {
  const safe = clampMinute(minutes, DEFAULT_START_MINUTES)
  const hour = Math.floor(safe / 60)
  const minute = safe % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const ensurePolicy = async () => {
  let policy = await AccessPolicy.findOne({ key: ACCESS_POLICY_KEY })
  if (policy) return policy

  policy = new AccessPolicy({
    key: ACCESS_POLICY_KEY,
    staffHodWindowStart: DEFAULT_START_MINUTES,
    staffHodWindowEnd: DEFAULT_END_MINUTES,
    enforceForStaffHod: true
  })
  await policy.save()
  return policy
}

const toResponsePolicy = (policy) => {
  const start = clampMinute(policy?.staffHodWindowStart, DEFAULT_START_MINUTES)
  const end = clampMinute(policy?.staffHodWindowEnd, DEFAULT_END_MINUTES)

  return {
    key: ACCESS_POLICY_KEY,
    staffHodWindowStart: start,
    staffHodWindowEnd: end,
    staffHodWindowStartTime: minutesToTimeString(start),
    staffHodWindowEndTime: minutesToTimeString(end),
    enforceForStaffHod: Boolean(policy?.enforceForStaffHod),
    updatedAt: policy?.updatedAt || null,
    updatedByUserId: policy?.updatedByUserId || null
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()

    if (req.method === 'GET') {
      const policy = await ensurePolicy()
      return res.status(200).json({ success: true, policy: toResponsePolicy(policy) })
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const { adminUserId, staffHodWindowStartTime, staffHodWindowEndTime, enforceForStaffHod } = req.body || {}

      if (!adminUserId) {
        return res.status(400).json({ success: false, error: 'adminUserId is required' })
      }

      const adminUser = await User.findById(adminUserId).select('_id role').lean()
      if (!adminUser || String(adminUser.role || '').toLowerCase() !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admin can update access policy' })
      }

      const startMinutes = timeStringToMinutes(staffHodWindowStartTime, NaN)
      const endMinutes = timeStringToMinutes(staffHodWindowEndTime, NaN)

      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        return res.status(400).json({ success: false, error: 'Valid start and end time are required (HH:mm)' })
      }

      if (startMinutes >= endMinutes) {
        return res.status(400).json({ success: false, error: 'Start time must be earlier than end time' })
      }

      const policy = await ensurePolicy()
      policy.staffHodWindowStart = startMinutes
      policy.staffHodWindowEnd = endMinutes
      policy.enforceForStaffHod = typeof enforceForStaffHod === 'boolean' ? enforceForStaffHod : true
      policy.updatedByUserId = adminUser._id
      await policy.save()

      return res.status(200).json({
        success: true,
        message: 'Access window updated successfully',
        policy: toResponsePolicy(policy)
      })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('Access policy API error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

import apiClient from './apiClient'

export const ACCESS_WINDOW_START_MINUTES = 8 * 60 + 30
export const ACCESS_WINDOW_END_MINUTES = 17 * 60
export const ACCESS_TIME_ZONE = 'Asia/Kolkata'
const ACCESS_POLICY_STORAGE_KEY = 'msec:access_policy'

const normalizeMinute = (value, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(23 * 60 + 59, Math.floor(n)))
}

const minutesToLabel = (minutes) => {
  const safe = normalizeMinute(minutes, ACCESS_WINDOW_START_MINUTES)
  const hour24 = Math.floor(safe / 60)
  const minute = safe % 60
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

const defaultPolicy = {
  staffHodWindowStart: ACCESS_WINDOW_START_MINUTES,
  staffHodWindowEnd: ACCESS_WINDOW_END_MINUTES,
  enforceForStaffHod: true
}

const sanitizePolicy = (policy = {}) => {
  const staffHodWindowStart = normalizeMinute(policy.staffHodWindowStart, ACCESS_WINDOW_START_MINUTES)
  const staffHodWindowEnd = normalizeMinute(policy.staffHodWindowEnd, ACCESS_WINDOW_END_MINUTES)

  return {
    staffHodWindowStart,
    staffHodWindowEnd,
    enforceForStaffHod: policy.enforceForStaffHod !== false
  }
}

const readCachedPolicy = () => {
  try {
    const raw = localStorage.getItem(ACCESS_POLICY_STORAGE_KEY)
    if (!raw) return defaultPolicy
    const parsed = JSON.parse(raw)
    return sanitizePolicy(parsed)
  } catch (error) {
    return defaultPolicy
  }
}

export const cacheAccessPolicy = (policy) => {
  const normalized = sanitizePolicy(policy)
  try {
    localStorage.setItem(ACCESS_POLICY_STORAGE_KEY, JSON.stringify(normalized))
  } catch (error) {
    // Ignore storage write errors.
  }
  return normalized
}

export const getAccessPolicy = () => readCachedPolicy()

export const refreshAccessPolicy = async () => {
  try {
    const data = await apiClient.get('/api/users?action=access-policy', { cache: false, ttl: 0, retry: 1 })
    if (data?.success && data.policy) {
      return cacheAccessPolicy(data.policy)
    }
  } catch (error) {
    // Keep cached/default policy when refresh fails.
  }
  return readCachedPolicy()
}

export const getAccessWindowLabel = () => {
  const policy = readCachedPolicy()
  return `${minutesToLabel(policy.staffHodWindowStart)} to ${minutesToLabel(policy.staffHodWindowEnd)}`
}

const getMinutesInTimeZone = (date = new Date(), timeZone = ACCESS_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0')
  return hour * 60 + minute
}

export const isWithinStudentAccessWindow = (date = new Date()) => {
  const policy = readCachedPolicy()
  const minutes = getMinutesInTimeZone(date)
  return minutes >= policy.staffHodWindowStart && minutes <= policy.staffHodWindowEnd
}

export const getAccessBlockMeta = (role, date = new Date()) => {
  const isWithinWindow = isWithinStudentAccessWindow(date)
  const policy = readCachedPolicy()
  const normalizedRole = String(role || '').toLowerCase()

  // Students and admins can access at any time.
  if (normalizedRole === 'student' || normalizedRole === 'admin') {
    return null
  }

  if (!policy.enforceForStaffHod) {
    return null
  }

  // Staff and HOD are restricted to the working-hours window.
  if (!isWithinWindow) {
    return {
      reason: 'outside-window',
      title: 'Login Available During Working Hours',
      message: `Staff and HOD login is allowed only between ${getAccessWindowLabel()} IST.`
    }
  }

  // Within working hours: non-student roles can access too.
  return null
}

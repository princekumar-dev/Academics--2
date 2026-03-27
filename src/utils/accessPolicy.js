export const ACCESS_WINDOW_START_MINUTES = 8 * 60 + 30
export const ACCESS_WINDOW_END_MINUTES = 17 * 60
export const ACCESS_TIME_ZONE = 'Asia/Kolkata'

export const getAccessWindowLabel = () => '8:30 AM to 5:00 PM'

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
  const minutes = getMinutesInTimeZone(date)
  return minutes >= ACCESS_WINDOW_START_MINUTES && minutes <= ACCESS_WINDOW_END_MINUTES
}

export const getAccessBlockMeta = (role, date = new Date()) => {
  const isWithinWindow = isWithinStudentAccessWindow(date)
  const normalizedRole = String(role || '').toLowerCase()

  // Students can access at any time.
  if (normalizedRole === 'student') {
    return null
  }

  // Staff, HOD, and admin are restricted to the working-hours window.
  if (!isWithinWindow) {
    return {
      reason: 'outside-window',
      title: 'Login Available During Working Hours',
      message: `Staff, HOD, and admin login is allowed only between ${getAccessWindowLabel()} IST.`
    }
  }

  // Within working hours: non-student roles can access too.
  return null
}

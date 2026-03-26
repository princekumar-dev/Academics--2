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
  void date
  if (role !== 'student') {
    return {
      reason: 'students-only',
      title: 'Access Restricted',
      message: 'Only students can access this website right now.'
    }
  }

  return null
}
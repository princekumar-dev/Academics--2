/**
 * Returns a user-friendly message for API/network errors.
 * Prefer server message (error.data.error/message), then status-based text, then network/timeout/generic.
 * @param {Error & { status?: number; data?: { error?: string; message?: string } }} error
 * @param {string} [fallback] - Optional fallback (e.g. "Login failed", "Could not load data")
 * @returns {string}
 */
export function getUserFriendlyMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback

  // Server-provided message (from API response body)
  const serverMsg = error.data && (error.data.error || error.data.message)
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg.trim()

  // HTTP status → friendly message (when no body message)
  const status = error.status
  if (status !== undefined && status !== null) {
    const statusMessages = {
      400: 'Invalid request. Please check your input and try again.',
      401: 'Session expired or invalid. Please sign in again.',
      403: 'You don\'t have permission to do this.',
      404: 'The requested item was not found.',
      408: 'Request timed out. Please try again.',
      409: 'This action conflicts with current data. Please refresh and try again.',
      422: 'The information provided could not be processed. Please check and try again.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'Server error. Please try again in a few moments.',
      502: 'Service temporarily unavailable. Please try again shortly.',
      503: 'Service temporarily unavailable. Please try again shortly.',
      504: 'Request timed out. The server is taking too long to respond.'
    }
    const statusMsg = statusMessages[status]
    if (statusMsg) return statusMsg
  }

  const msg = (error.message || '').toLowerCase()

  // Network / connection
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Connection failed. Please check your internet connection and try again.'
  }

  // Timeout / abort
  if (msg.includes('timeout') || msg.includes('abort') || error.name === 'AbortError') {
    return 'Request took too long. Please try again.'
  }

  // Raw "HTTP 500" style – don’t show to user
  if (typeof error.message === 'string' && /^HTTP\s+\d{3}/.test(error.message.trim())) {
    const code = status != null ? status : parseInt(String(error.message).replace(/^HTTP\s+(\d{3}).*/, '$1'), 10)
    if (!isNaN(code)) return code >= 500 ? 'Server error. Please try again in a few moments.' : 'Request failed. Please try again.'
    return fallback
  }

  // Generic unknown
  return fallback
}

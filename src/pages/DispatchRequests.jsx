import { useEffect, useMemo, useState, useCallback, memo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'
import RefreshButton from '../components/RefreshButton'
import SwipeableCard from '../components/SwipeableCard'
import AnimatedCount from '../components/AnimatedCount'
import usePullToRefresh, { PullToRefreshIndicator } from '../hooks/usePullToRefresh.jsx'
import { usePushNotifications, usePageFocus } from '../hooks/usePushNotifications'
import JSZip from 'jszip'
import { useAlert } from '../components/AlertContext'

const PUBLIC_BASE_URL =
  import.meta.env.VITE_PUBLIC_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ''

const getPublicOrigin = () => {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function DispatchRequests() {
  const navigate = useNavigate()
  const { showInfo, showSuccess, showWarning, hideAlert, updateAlert } = useAlert()
  const [userData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [marksheets, setMarksheets] = useState([])
  const [dispatchedMarksheets, setDispatchedMarksheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [batching, setBatching] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [requestingIds, setRequestingIds] = useState([])
  const [dispatchingId, setDispatchingId] = useState(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [viewTab, setViewTab] = useState('active') // 'active' or 'history'
  const [currentExaminationId, setCurrentExaminationId] = useState(null) // Track current exam for filtering dispatch history
  const activeMarksheetsRef = useRef([])
  const dispatchedMarksheetsRef = useRef([])
  const bulkProgressAlertIdRef = useRef(null)

  const clearBulkProgressAlert = useCallback(() => {
    if (!bulkProgressAlertIdRef.current) return
    hideAlert(bulkProgressAlertIdRef.current)
    bulkProgressAlertIdRef.current = null
  }, [hideAlert])

  useEffect(() => {
    return () => clearBulkProgressAlert()
  }, [clearBulkProgressAlert])

  // Pull-to-refresh functionality
  const handlePullRefresh = async () => {
    await fetchVerifiedMarksheets(true)
    setFeedback('Refreshed successfully')
    setTimeout(() => setFeedback(''), 2000)
  }

  const { isPulling, isRefreshing, pullDistance, containerRef, threshold } = usePullToRefresh(handlePullRefresh, {
    enabled: true,
    threshold: 80
  })

  useEffect(() => {
    if (userData?.role === 'staff') {
      fetchVerifiedMarksheets(true)
    } else {
      setLoading(false)
    }
  }, [userData])

  useEffect(() => {
    activeMarksheetsRef.current = marksheets
  }, [marksheets])

  useEffect(() => {
    dispatchedMarksheetsRef.current = dispatchedMarksheets
  }, [dispatchedMarksheets])

  // Listen for global updates and force-fetch to avoid stale cached responses
  useEffect(() => {
    const handler = () => {
      if (userData?.role === 'staff') fetchVerifiedMarksheets(true)
    }
    window.addEventListener('notificationsUpdated', handler)
    window.addEventListener('marksheetsUpdated', handler)
    return () => {
      window.removeEventListener('notificationsUpdated', handler)
      window.removeEventListener('marksheetsUpdated', handler)
    }
  }, [userData])

  // Real-time push notifications
  usePushNotifications({
    'dispatch_request': () => {
      console.log('🔔 Dispatch request notification triggered refresh')
      fetchVerifiedMarksheets(true)
    },
    'marksheet_dispatch': () => {
      console.log('🔔 Marksheet dispatch notification triggered refresh')
      fetchVerifiedMarksheets(true)
    },
    'marksheet_approval': () => {
      console.log('🔔 Marksheet approval notification triggered refresh')
      fetchVerifiedMarksheets(true)
    }
  })

  usePageFocus(() => fetchVerifiedMarksheets(true))

  const fetchVerifiedMarksheets = async (force = false) => {
    if (!userData) return
    setLoading(true)
    try {
      const staffId = userData?._id || userData?.id || localStorage.getItem('userId')
      // Fetch active (non-dispatched) marksheets only
      const opts = force ? { cache: false, dedupe: false } : undefined
      const data = await apiClient.get(`/api/marksheets?staffId=${staffId}&status=verified_by_staff,dispatch_requested,approved_by_hod,rejected_by_hod&compact=1`, opts)
      if (data.success) {
        const normalizeStatus = (sheet) => {
          if (sheet?.status === 'rescheduled_by_hod') {
            return {
              ...sheet,
              status: 'dispatch_requested',
              dispatchRequest: { ...(sheet.dispatchRequest || {}), hodResponse: null }
            }
          }
          return sheet
        }
        setMarksheets((data.marksheets || []).map(normalizeStatus))
      } else {
        setMarksheets([])
      }

      // Fetch already-dispatched marksheets separately for history view
      let historyData = { success: false, marksheets: [] }
      try {
        historyData = await apiClient.get(`/api/marksheets?staffId=${staffId}&status=dispatched&compact=1`, opts)
        if (historyData.success) {
          const normalizeStatus = (sheet) => sheet?.status === 'rescheduled_by_hod'
            ? { ...sheet, status: 'dispatch_requested', dispatchRequest: { ...(sheet.dispatchRequest || {}), hodResponse: null } }
            : sheet
          setDispatchedMarksheets((historyData.marksheets || []).map(normalizeStatus))
        } else {
          setDispatchedMarksheets([])
        }
      } catch (historyErr) {
        console.error('Error fetching dispatched marksheets:', historyErr)
        setDispatchedMarksheets([])
      }

      // Determine most recent exam ID from BOTH active and dispatched marksheets combined
      const allMarksheets = [
        ...(data && data.success ? data.marksheets : []),
        ...(historyData && historyData.success ? historyData.marksheets : [])
      ]

      if (allMarksheets && allMarksheets.length > 0) {
        const exams = allMarksheets.map(m => ({
          id: m.examinationId,
          name: m.examinationName,
          createdAt: m.createdAt
        }))
        const uniqueExams = Array.from(new Map(exams.map(e => [e.id, e])).values())
        const mostRecentExam = uniqueExams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        setCurrentExaminationId(mostRecentExam?.id || null)
      } else {
        setCurrentExaminationId(null)
      }
    } catch (err) {
      console.error('Error fetching marksheets:', err)
      setMarksheets([])
      setCurrentExaminationId(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchVerifiedMarksheets(true)
    } finally {
      setRefreshing(false)
    }
  }

  const updateActiveMarksheets = useCallback((ids, updater) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const idSet = new Set(ids)
    const nextActive = activeMarksheetsRef.current.map((marksheet) => (
      idSet.has(marksheet._id) ? updater(marksheet) : marksheet
    ))
    activeMarksheetsRef.current = nextActive
    setMarksheets(nextActive)
  }, [])

  const moveToDispatchHistory = useCallback((ids, updater = null) => {
    if (!Array.isArray(ids) || ids.length === 0) return
    const idSet = new Set(ids)
    const movedMarksheets = activeMarksheetsRef.current
      .filter((marksheet) => idSet.has(marksheet._id))
      .map((marksheet) => (updater ? updater(marksheet) : marksheet))

    if (movedMarksheets.length === 0) return

    const nextActive = activeMarksheetsRef.current.filter((marksheet) => !idSet.has(marksheet._id))
    const nextHistory = [
      ...movedMarksheets,
      ...dispatchedMarksheetsRef.current.filter((marksheet) => !idSet.has(marksheet._id))
    ]

    activeMarksheetsRef.current = nextActive
    dispatchedMarksheetsRef.current = nextHistory
    setMarksheets(nextActive)
    setDispatchedMarksheets(nextHistory)
  }, [])

  const requestDispatch = useCallback(async (marksheetId) => {
    try {
      return await apiClient.post('/api/marksheets?action=request-dispatch', { marksheetId, staffId: userData._id || userData.id })
    } catch (e) {
      return { success: false, error: e.message }
    }
  }, [userData])

  const handleRequest = useCallback(async (marksheetId) => {
    setFeedback('')
    setError('')
    setRequestingIds((ids) => Array.from(new Set([...ids, marksheetId])))
    try {
      const result = await requestDispatch(marksheetId)
      if (result?.success) {
        setFeedback('Dispatch request submitted for HOD approval.')
        setMarksheets((prev) => prev.map((m) => {
          if (m._id === marksheetId) {
            return {
              ...m,
              status: 'dispatch_requested',
              dispatchRequest: {
                ...(m.dispatchRequest || {}),
                requestedAt: new Date().toISOString(),
                requestedBy: userData?._id || userData?.id,
                hodResponse: null,
                hodComments: null,
                scheduledDispatchDate: null
              }
            }
          }
          return m
        }))
      } else {
        setError(result?.error || 'Failed to request dispatch')
      }
    } catch (err) {
      console.error(err)
      setError(getUserFriendlyMessage(err, 'Could not submit dispatch request. Please try again.'))
    } finally {
      setRequestingIds((ids) => ids.filter((id) => id !== marksheetId))
      fetchVerifiedMarksheets(true)
    }
  }, [requestDispatch, userData, fetchVerifiedMarksheets])

  const requestDispatchAll = async () => {
    const candidates = marksheets.filter((m) => m.status === 'verified_by_staff')
    if (candidates.length === 0) return
    setFeedback('')
    setError('')
    setBatching(true)
    try {
      const results = []
      for (const sheet of candidates) {
        const result = await requestDispatch(sheet._id)
        results.push(result)
        if (result?.success) {
          updateActiveMarksheets([sheet._id], (marksheet) => ({
            ...marksheet,
            status: 'dispatch_requested',
            dispatchRequest: {
              ...(marksheet.dispatchRequest || {}),
              requestedAt: new Date().toISOString(),
              requestedBy: userData?.name || userData?._id || userData?.id,
              status: 'pending',
              hodResponse: null,
              hodComments: null,
              scheduledDispatchDate: null
            }
          }))
        }
      }
      const okCount = results.filter((r) => r?.success).length
      const failCount = results.length - okCount
      if (okCount > 0) {
        setFeedback(`Submitted ${okCount} dispatch request${okCount > 1 ? 's' : ''} for approval.`)
      }
      if (failCount > 0) {
        setError(`Failed to submit ${failCount} request${failCount > 1 ? 's' : ''}. Please try again.`)
      }
    } finally {
      setBatching(false)
      fetchVerifiedMarksheets(true)
    }
  }

  const sendDispatch = useCallback(async (marksheet) => {
    if (!marksheet?._id) return
    setFeedback('')
    setError('')
    setDispatchingId(marksheet._id)
    try {
      const origin = getPublicOrigin()
      const marksheetPdfUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${Date.now()}` : ''
      const marksheetImageUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&format=jpeg&t=${Date.now()}` : ''

      // Debug: log payload that will be sent to the API
      const payload = { marksheetId: marksheet._id, marksheetPdfUrl, marksheetImageUrl }
      console.debug('Dispatch payload:', payload)

      let data
      try {
        // Sending marksheet may take longer due to media processing — increase timeout
        data = await apiClient.post('/api/whatsapp-dispatch?action=send-marksheet', payload, { timeout: 120000 })
      } catch (apiErr) {
        // apiClient attaches parsed response JSON to `apiErr.data` when available
        const server = apiErr && (apiErr.data || apiErr.data?.error) ? apiErr.data : null
        const serverMsg = server ? (server.error || server.details || JSON.stringify(server)) : null
        const errMsg = serverMsg || apiErr.message || 'Failed to dispatch marksheet'
        throw new Error(errMsg)
      }

      if (!data || !data.success) {
        const errorMsg = (data && (data.details || data.error)) || 'Failed to dispatch marksheet'
        if (errorMsg.includes('Authenticate') || errorMsg.includes('authentication')) {
          throw new Error('WhatsApp API authentication failed. Please verify EVOLUTION_API_KEY in .env file. See EVOLUTION_API_SETUP.md')
        } else if (data && data.setupGuide) {
          throw new Error(`${errorMsg}. ${data.setupGuide}`)
        } else {
          throw new Error(errorMsg)
        }
      }
      setFeedback('Marksheet dispatched to parent via WhatsApp.')
      moveToDispatchHistory([marksheet._id], (current) => ({
        ...current,
        status: 'dispatched',
        dispatchStatus: {
          ...(current.dispatchStatus || {}),
          dispatched: true,
          dispatchedAt: new Date().toISOString(),
          whatsappStatus: 'sent'
        }
      }))
      await fetchVerifiedMarksheets(true)
    } catch (err) {
      console.error(err)
      setError(getUserFriendlyMessage(err, 'Unable to dispatch marksheet. Please try again.'))
    } finally {
      setDispatchingId(null)
    }
  }, [fetchVerifiedMarksheets, moveToDispatchHistory])

  const sendAllApproved = async () => {
    const approvedMarksheets = marksheets.filter((m) => m.status === 'approved_by_hod')
    if (approvedMarksheets.length === 0) return

    setFeedback('')
    setError('')
    setSendingAll(true)

    try {
      const origin = getPublicOrigin()
      const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      // Anti-spam controls for WhatsApp bulk sends
      const MESSAGE_DELAY_MIN_MS = 2000   // 2s
      const MESSAGE_DELAY_MAX_MS = 8000   // 8s
      const BATCH_SIZE_MIN = 10
      const BATCH_SIZE_MAX = 15
      const BATCH_PAUSE_MIN_MS = 60000    // 60s
      const BATCH_PAUSE_MAX_MS = 120000   // 120s

      const controlState = {
        paused: false,
        cancelled: false
      }

      const progressState = {
        total: approvedMarksheets.length,
        processed: 0,
        successCount: 0,
        failCount: 0,
        phase: 'Preparing to send marksheets...',
        cooldownSeconds: 0,
        currentBatch: 0,
        totalBatches: 0
      }

      const formatEta = (seconds) => {
        const safe = Math.max(0, Math.round(seconds))
        const mins = Math.floor(safe / 60)
        const secs = safe % 60
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
      }

      const estimateRemainingSeconds = ({ total, processed, cooldownSeconds = 0 }) => {
        const remaining = Math.max(0, total - processed)
        const avgMessageSeconds = ((MESSAGE_DELAY_MIN_MS + MESSAGE_DELAY_MAX_MS) / 2) / 1000
        const avgBatchSize = (BATCH_SIZE_MIN + BATCH_SIZE_MAX) / 2
        const avgBatchPauseSeconds = ((BATCH_PAUSE_MIN_MS + BATCH_PAUSE_MAX_MS) / 2) / 1000
        const estimatedFuturePauses = remaining > 0 ? Math.max(0, Math.ceil(remaining / avgBatchSize) - 1) : 0
        return Math.round((remaining * avgMessageSeconds) + (estimatedFuturePauses * avgBatchPauseSeconds) + cooldownSeconds)
      }

      const getProgressMessage = ({
        total,
        processed,
        successCount,
        failCount,
        phase,
        cooldownSeconds = 0,
        currentBatch = 0,
        totalBatches = 0,
        paused = false,
        onPauseToggle,
        onCancel
      }) => {
        const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0
        const etaSeconds = estimateRemainingSeconds({ total, processed, cooldownSeconds })
        return (
          <span className="block">
            <span className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">{phase}</span>
            {totalBatches > 0 && (
              <span className="block text-[11px] sm:text-xs text-slate-600 mb-2">
                Batch {Math.min(currentBatch, totalBatches)}/{totalBatches}
              </span>
            )}
            <span className="block h-2 w-full rounded-full bg-white/70 border border-blue-100 overflow-hidden mb-2">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700 ease-out"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="block text-[11px] sm:text-xs text-slate-700 mb-0.5">
              Progress: {processed}/{total} ({percent}%)
            </span>
            <span className="block text-[11px] sm:text-xs text-slate-700 mb-0.5">
              Sent: {successCount} • Failed: {failCount}
            </span>
            <span className="block text-[11px] sm:text-xs text-slate-600">
              Estimated time left: {formatEta(etaSeconds)}{cooldownSeconds > 0 ? ` • Cooldown ${cooldownSeconds}s` : ''}
            </span>
            <span className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onPauseToggle}
                className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-white/80 border border-blue-200 text-blue-700 hover:bg-white"
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[11px] sm:text-xs font-semibold bg-white/80 border border-red-200 text-red-700 hover:bg-white"
              >
                ✖ Cancel
              </button>
            </span>
          </span>
        )
      }

      const showBulkProgressAlert = () => {
        const message = getProgressMessage({
          ...progressState,
          paused: controlState.paused,
          onPauseToggle: () => {
            controlState.paused = !controlState.paused
            progressState.phase = controlState.paused ? 'Paused by user. Dispatch will resume when you tap Resume.' : 'Resuming bulk dispatch...'
            showBulkProgressAlert()
          },
          onCancel: () => {
            controlState.cancelled = true
            progressState.phase = 'Cancelling bulk dispatch...'
            showBulkProgressAlert()
          }
        })

        if (!bulkProgressAlertIdRef.current) {
          bulkProgressAlertIdRef.current = showInfo('📤 Bulk Dispatch Running', message, {
            autoClose: false,
            duration: 0,
            position: 'top-right'
          })
          return
        }
        if (typeof updateAlert === 'function') {
          updateAlert(bulkProgressAlertIdRef.current, {
            type: 'info',
            title: '📤 Bulk Dispatch Running',
            message,
            autoClose: false,
            duration: 0,
            position: 'top-right'
          })
          return
        }
        clearBulkProgressAlert()
        bulkProgressAlertIdRef.current = showInfo('📤 Bulk Dispatch Running', message, {
          autoClose: false,
          duration: 0,
          position: 'top-right'
        })
      }

      const updateBulkProgress = (patch = {}) => {
        Object.assign(progressState, patch)
        showBulkProgressAlert()
      }

      const waitWithControls = async (durationMs, onTick = null) => {
        let remaining = Math.max(0, durationMs)
        let lastReportedSeconds = null
        while (remaining > 0) {
          if (controlState.cancelled) return false

          while (controlState.paused) {
            if (controlState.cancelled) return false
            await wait(250)
          }

          const step = Math.min(250, remaining)
          await wait(step)
          remaining -= step

          if (typeof onTick === 'function') {
            const seconds = Math.ceil(remaining / 1000)
            if (seconds !== lastReportedSeconds) {
              lastReportedSeconds = seconds
              onTick(seconds)
            }
          }
        }
        return !controlState.cancelled
      }

      const worker = async (marksheet) => {
        const marksheetPdfUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${Date.now()}` : ''
        const marksheetImageUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&format=jpeg&t=${Date.now()}` : ''
        try {
          const responseData = await apiClient.post('/api/whatsapp-dispatch?action=send-marksheet', { marksheetId: marksheet._id, marksheetPdfUrl, marksheetImageUrl }, { timeout: 120000 })
          if (responseData && responseData.success) {
            moveToDispatchHistory([marksheet._id], (current) => ({
              ...current,
              status: 'dispatched',
              dispatchStatus: {
                ...(current.dispatchStatus || {}),
                dispatched: true,
                dispatchedAt: new Date().toISOString(),
                whatsappStatus: 'sent'
              }
            }))
            return { success: true, id: marksheet._id }
          }
          return { success: false, id: marksheet._id, error: responseData?.error || 'Unknown API response' }
        } catch (apiErr) {
          const errMsg = (apiErr && (apiErr.data?.error || apiErr.data || apiErr.message)) || String(apiErr)
          return { success: false, id: marksheet._id, error: errMsg }
        }
      }

      const batches = []
      let sourceIndex = 0
      while (sourceIndex < approvedMarksheets.length) {
        const batchSize = randomBetween(BATCH_SIZE_MIN, BATCH_SIZE_MAX)
        const batch = approvedMarksheets.slice(sourceIndex, sourceIndex + batchSize)
        batches.push(batch)
        sourceIndex += batch.length
      }

      progressState.totalBatches = batches.length
      showBulkProgressAlert()

      const results = []

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        if (controlState.cancelled) break

        const batch = batches[batchIndex]
        updateBulkProgress({
          currentBatch: batchIndex + 1,
          phase: `Sending batch ${batchIndex + 1}/${batches.length} (${batch.length} marksheets)...`,
          cooldownSeconds: 0
        })

        for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
          if (controlState.cancelled) break

          const jitterMs = randomBetween(MESSAGE_DELAY_MIN_MS, MESSAGE_DELAY_MAX_MS)
          updateBulkProgress({
            phase: `Waiting ${Math.ceil(jitterMs / 1000)}s before next send to reduce spam risk...`,
            cooldownSeconds: Math.ceil(jitterMs / 1000)
          })

          const canContinue = await waitWithControls(jitterMs, (remainingSeconds) => {
            updateBulkProgress({
              phase: 'Applying randomized delay between messages...',
              cooldownSeconds: remainingSeconds
            })
          })

          if (!canContinue) break

          updateBulkProgress({
            phase: `Dispatching marksheet ${progressState.processed + 1}/${progressState.total}...`,
            cooldownSeconds: 0
          })

          const result = await worker(batch[itemIndex])
          results.push(result)

          if (result && result.success) {
            progressState.successCount += 1
          } else {
            progressState.failCount += 1
          }

          progressState.processed = results.length
          setFeedback(`Sending marksheets... ${progressState.processed}/${progressState.total}`)
          showBulkProgressAlert()
        }

        if (controlState.cancelled) break

        if (batchIndex < batches.length - 1) {
          const cooldownMs = randomBetween(BATCH_PAUSE_MIN_MS, BATCH_PAUSE_MAX_MS)
          const cooldownSeconds = Math.ceil(cooldownMs / 1000)

          setFeedback(`Batch ${batchIndex + 1}/${batches.length} completed. Cooling down ${cooldownSeconds}s before next batch...`)
          updateBulkProgress({
            phase: 'Cooling down between batches to avoid rate limits...',
            cooldownSeconds
          })

          const canContinue = await waitWithControls(cooldownMs, (remainingSeconds) => {
            updateBulkProgress({
              phase: 'Cooling down between batches to avoid rate limits...',
              cooldownSeconds: remainingSeconds
            })
          })

          if (!canContinue) break
        }
      }

      const successCount = progressState.successCount
      const failCount = progressState.failCount
      const wasCancelled = controlState.cancelled

      clearBulkProgressAlert()

      if (wasCancelled) {
        setFeedback(`Bulk dispatch cancelled. Processed ${progressState.processed}/${progressState.total} marksheets.`)
        showWarning('⛔ Bulk Dispatch Cancelled', `Processed ${progressState.processed}/${progressState.total}. Sent: ${successCount}, Failed: ${failCount}.`)
      }

      if (!wasCancelled && successCount > 0) {
        setFeedback(`Successfully sent ${successCount} marksheet${successCount > 1 ? 's' : ''} via WhatsApp.`)
        showSuccess('✅ Bulk Dispatch Complete', `Sent ${successCount}/${approvedMarksheets.length} marksheets successfully.`)
      }
      if (!wasCancelled && failCount > 0) {
        setError(`Failed to send ${failCount} marksheet${failCount > 1 ? 's' : ''}. Please try sending them individually.`)
        showWarning('⚠️ Some Dispatches Failed', `${failCount} of ${approvedMarksheets.length} marksheets failed.`)
      }
    } catch (err) {
      console.error(err)
      clearBulkProgressAlert()
      setError(getUserFriendlyMessage(err, 'Could not send marksheets. Please try again.'))
    } finally {
      clearBulkProgressAlert()
      setSendingAll(false)
      await fetchVerifiedMarksheets(true)
    }
  }

  const statusFilters = useMemo(() => {
    // Use the appropriate list based on current view tab
    const source = viewTab === 'active' ? marksheets : dispatchedMarksheets
    return [
      { id: 'all', label: 'All', count: source.length },
      { id: 'verified_by_staff', label: 'Ready', count: source.filter(m => m.status === 'verified_by_staff').length },
      { id: 'dispatch_requested', label: 'Pending', count: source.filter(m => m.status === 'dispatch_requested').length },
      { id: 'approved_by_hod', label: 'Approved', count: source.filter(m => m.status === 'approved_by_hod').length },
      { id: 'rejected_by_hod', label: 'Rejected', count: source.filter(m => m.status === 'rejected_by_hod').length },
      { id: 'dispatched', label: 'Dispatched', count: source.filter(m => m.status === 'dispatched').length }
    ]
  }, [marksheets, dispatchedMarksheets, viewTab])

  const filteredMarksheets = useMemo(() => {
    // Choose which list to filter based on active tab
    let source = viewTab === 'active' ? marksheets : dispatchedMarksheets

    // For history view, only show marksheets from the current (most recent) examination
    if (viewTab === 'history' && currentExaminationId) {
      source = source.filter(m => m.examinationId === currentExaminationId)
    }

    const filtered = statusFilter === 'all' ? source : source.filter((m) => m.status === statusFilter)
    return filtered.sort((a, b) => {
      const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
      const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [marksheets, dispatchedMarksheets, statusFilter, viewTab, currentExaminationId])

  // Count of marksheets that are approved by HOD
  const approvedCount = useMemo(() => marksheets.filter(m => m.status === 'approved_by_hod').length, [marksheets])

  const statusStyles = {
    verified_by_staff: 'bg-blue-100 text-blue-800',
    dispatch_requested: 'bg-yellow-100 text-yellow-800',
    approved_by_hod: 'bg-green-100 text-green-800',
    rejected_by_hod: 'bg-red-100 text-red-800',
    dispatched: 'bg-purple-100 text-purple-800'
  }

  const statusIcons = {
    verified_by_staff: '📋',
    dispatch_requested: '⏳',
    approved_by_hod: '✅',
    rejected_by_hod: '⛔',
    dispatched: '📤'
  }

  if (!userData || userData.role !== 'staff') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only staff members can manage dispatch requests.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator
        isPulling={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        threshold={threshold}
      />

      <div ref={containerRef} className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">Dispatch Requests</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Submit and track WhatsApp dispatch requests for verified marksheets.<br />
              Request approval, send reports, and manage dispatch status for your students.
            </p>
          </div>
          <div className="glass-card responsive-spacing rounded-3xl mb-8">

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading marksheets...</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 p-4 rounded-xl mb-6 text-blue-800">
                  <strong>Tip:</strong> Request dispatch after verifying marksheets. Once the HOD approves, you can send the report directly to parents via WhatsApp.
                </div>

                {/* View Tabs: Active vs Dispatched History */}
                <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
                  <button
                    onClick={() => { setViewTab('active'); setStatusFilter('all') }}
                    className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${viewTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                  >
                    Active (<AnimatedCount value={marksheets.length} />)
                  </button>
                  <button
                    onClick={() => { setViewTab('history'); setStatusFilter('all') }}
                    className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${viewTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                  >
                    Dispatched History (<AnimatedCount value={dispatchedMarksheets.length} />)
                  </button>
                </div>

                {/* Empty state for current tab */}
                {((viewTab === 'active' && marksheets.length === 0) || (viewTab === 'history' && dispatchedMarksheets.length === 0)) ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No marksheets available</h3>
                    <p className="text-gray-600">{viewTab === 'active' ? 'Import and verify marksheets to begin requesting dispatch approvals.' : 'No dispatched marksheets yet.'}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                      {/* Show filters and refresh only in Active tab */}
                      {viewTab === 'active' && (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {statusFilters.map((filter) => (
                              <button
                                key={filter.id}
                                onClick={() => setStatusFilter(filter.id)}
                                className={`px-3 py-2 rounded-full text-xs sm:text-sm font-medium border transition-colors duration-200 whitespace-nowrap ${statusFilter === filter.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-yellow-400'
                                  }`}
                              >
                                {filter.label}
                                <span className={`ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${statusFilter === filter.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                  <AnimatedCount value={filter.count} />
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="hidden sm:block ml-auto">
                            <RefreshButton isLoading={refreshing} onClick={handleRefresh} />
                          </div>
                        </>
                      )}
                    </div>

                    {(feedback || error) && (
                      <div className="mt-0 mb-3 space-y-2">
                        {feedback && (
                          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            {feedback}
                          </div>
                        )}
                        {error && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
                      {/* Show action buttons only when viewing Active tab */}
                      {viewTab === 'active' && (
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                          <button
                            onClick={requestDispatchAll}
                            disabled={batching || marksheets.every((m) => m.status !== 'verified_by_staff')}
                            className={`btn-fill inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg font-medium sm:font-semibold text-xs sm:text-sm whitespace-nowrap ${batching || marksheets.every((m) => m.status !== 'verified_by_staff')
                                ? 'cursor-not-allowed border border-gray-200 text-gray-500'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors'
                              }`}
                          >
                            {/* fill overlay (white -> blue) for batching */}
                            {batching && (
                              <span className="fill" style={{ backgroundColor: '#60A5FA' }} aria-hidden />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                              {batching ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Requesting...
                                </>
                              ) : (
                                '📋 Request All'
                              )}
                            </span>
                          </button>

                          <button
                            onClick={sendAllApproved}
                            disabled={sendingAll || marksheets.every((m) => m.status !== 'approved_by_hod')}
                            className={`btn-fill inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg font-medium sm:font-semibold text-xs sm:text-sm whitespace-nowrap ${sendingAll || marksheets.every((m) => m.status !== 'approved_by_hod')
                                ? 'cursor-not-allowed border border-gray-200 text-gray-500'
                                : 'bg-green-600 text-white hover:bg-green-700 transition-colors'
                              }`}
                          >
                            {/* green fill overlay when sending */}
                            {sendingAll && (
                              <span className="fill" style={{ backgroundColor: '#16A34A' }} aria-hidden />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                              {sendingAll ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Sending...
                                </>
                              ) : (
                                '📤 Send All'
                              )}
                            </span>
                          </button>

                          <button
                            onClick={async () => {
                              // Download all marksheets currently visible in a ZIP
                              // Only include marksheets that have been approved by HOD
                              const candidates = marksheets.filter(m => m.status === 'approved_by_hod')
                              if (!candidates || candidates.length === 0) return
                              setFeedback('')
                              setError('')
                              setDownloadingAll(true)
                              try {
                                const zip = new JSZip()
                                // Determine zip name: if all candidates share same exam/department/year, use it
                                const examNames = Array.from(new Set(candidates.map(c => c.examinationName || 'exam')))
                                const depts = Array.from(new Set(candidates.map(c => c.studentDetails?.department || 'dept')))
                                const years = Array.from(new Set(candidates.map(c => c.studentDetails?.year || 'year')))
                                const sections = Array.from(new Set(candidates.map(c => c.studentDetails?.section || 'section')))
                                let zipName = 'marksheets_' + Date.now()
                                // Preferred pattern when all candidates share the same exam, dept, year, and section
                                if (examNames.length === 1 && depts.length === 1 && years.length === 1 && sections.length === 1) {
                                  const ex = examNames[0].replace(/\s+/g, '_')
                                  const dp = String(depts[0]).replace(/\s+/g, '_')
                                  const yr = String(years[0]).replace(/\s+/g, '_')
                                  const sec = String(sections[0]).replace(/\s+/g, '_')
                                  zipName = `${ex}-${dp}-${yr}-${sec}`
                                } else if (examNames.length === 1 && depts.length === 1 && years.length === 1) {
                                  // If section differs, omit it
                                  zipName = `${examNames[0].replace(/\s+/g, '_')}-${depts[0]}-${years[0]}`
                                } else if (examNames.length === 1) {
                                  zipName = `${examNames[0].replace(/\s+/g, '_')}`
                                }

                                // Fetch each PDF and add to zip
                                for (const sheet of candidates) {
                                  try {
                                    const origin = getPublicOrigin()
                                    const ts = Date.now()
                                    const url = origin ? `${origin}/api/generate-pdf?marksheetId=${sheet._id}&t=${ts}` : `/api/generate-pdf?marksheetId=${sheet._id}&t=${ts}`
                                    try {
                                      const arrayBuffer = await apiClient.get(url, { responseType: 'arrayBuffer', timeout: 15000 })
                                      const filename = `${(sheet.studentDetails?.regNumber || sheet.studentDetails?.name || sheet._id)}_${(sheet.marksheetId || '').toString() || ''}.pdf`.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
                                      zip.file(filename, arrayBuffer)
                                    } catch (e) {
                                      console.warn('Failed to fetch PDF for', sheet._id, e)
                                      continue
                                    }
                                  } catch (e) {
                                    console.error('Error fetching PDF for marksheet', sheet._id, e)
                                  }
                                }

                                const content = await zip.generateAsync({ type: 'blob' })
                                const a = document.createElement('a')
                                const url = URL.createObjectURL(content)
                                a.href = url
                                a.download = `${zipName}.zip`
                                document.body.appendChild(a)
                                a.click()
                                a.remove()
                                URL.revokeObjectURL(url)
                                setFeedback(`Prepared ${candidates.length} marksheet${candidates.length > 1 ? 's' : ''} in ${zipName}.zip`)
                              } catch (err) {
                                console.error('Download all error:', err)
                                setError(getUserFriendlyMessage(err, 'Could not generate ZIP. Please try again.'))
                              } finally {
                                setDownloadingAll(false)
                              }
                            }}
                            disabled={downloadingAll || approvedCount === 0}
                            aria-disabled={downloadingAll || approvedCount === 0}
                            title={downloadingAll ? 'Preparing ZIP...' : (approvedCount === 0 ? 'Disabled until HOD approval (no approved marksheets).' : 'Download all approved marksheets as ZIP')}
                            className={`btn-fill inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg font-medium sm:font-semibold text-xs sm:text-sm whitespace-nowrap ${(downloadingAll || approvedCount === 0) ? 'cursor-not-allowed border border-gray-200 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 transition-colors'}`}
                          >
                            {/* indigo fill overlay when preparing */}
                            {downloadingAll && (
                              <span className="fill" style={{ backgroundColor: '#4F46E5' }} aria-hidden />
                            )}
                            <span className="relative z-10">
                              {downloadingAll ? 'Preparing ZIP...' : '📥 Download All (ZIP)'}
                            </span>
                          </button>

                          <button
                            onClick={async () => {
                              // Regenerate signatures/results for all marksheets in the current list
                              const candidates = marksheets
                              if (!candidates || candidates.length === 0) return
                              setFeedback('')
                              setError('')
                              setRegenerating(true)
                              try {
                                const results = []
                                for (const sheet of candidates) {
                                  try {
                                    const data = await apiClient.put('/api/marksheets', { marksheetId: sheet._id, regenerateSignatures: true, recomputeResults: true })
                                    if (data && data.success) {
                                      results.push({ success: true, id: sheet._id })
                                    } else {
                                      results.push({ success: false, id: sheet._id, error: data?.error || data?.details })
                                    }
                                  } catch (err) {
                                    results.push({ success: false, id: sheet._id, error: err.message })
                                  }
                                }

                                const successCount = results.filter(r => r.success).length
                                const failCount = results.length - successCount
                                if (successCount > 0) setFeedback(`Regenerated ${successCount} marksheet${successCount > 1 ? 's' : ''}.`)
                                if (failCount > 0) setError(`Failed to regenerate ${failCount} marksheet${failCount > 1 ? 's' : ''}.`)
                              } finally {
                                setRegenerating(false)
                                await fetchVerifiedMarksheets(true)
                              }
                            }}
                            disabled={regenerating || marksheets.length === 0}
                            className={`btn-fill inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg font-medium sm:font-semibold text-xs sm:text-sm whitespace-nowrap ${regenerating || marksheets.length === 0 ? 'cursor-not-allowed border border-gray-200 text-gray-500' : 'bg-yellow-500 text-white hover:bg-yellow-600 transition-colors'}`}
                          >
                            {/* yellow fill overlay when regenerating */}
                            {regenerating && (
                              <span className="fill" style={{ backgroundColor: '#D97706' }} aria-hidden />
                            )}
                            <span className="relative z-10">{regenerating ? 'Regenerating...' : '🔁 Regenerate All'}</span>
                          </button>

                          <div className="sm:hidden ml-auto">
                            <RefreshButton isLoading={refreshing} onClick={handleRefresh} />
                          </div>
                        </div>
                      )}

                      {/* Show Resend All History button only when viewing History tab */}
                      {viewTab === 'history' && (
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                          <button
                            onClick={async () => {
                              const candidates = dispatchedMarksheets.filter(m => m.status === 'dispatched')
                              if (candidates.length === 0) return

                              setFeedback('')
                              setError('')
                              setSendingAll(true)

                              try {
                                const results = []
                                for (const marksheet of candidates) {
                                  try {
                                    await sendDispatch(marksheet)
                                    results.push({ success: true })
                                  } catch (err) {
                                    results.push({ success: false, error: err.message })
                                  }
                                }

                                const successCount = results.filter(r => r.success).length
                                setFeedback(`Successfully re-sent ${successCount} marksheet${successCount > 1 ? 's' : ''} via WhatsApp.`)
                              } catch (err) {
                                setError(getUserFriendlyMessage(err, 'Could not re-send history. Please try again.'))
                              } finally {
                                setSendingAll(false)
                              }
                            }}
                            disabled={sendingAll || dispatchedMarksheets.length === 0}
                            className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${sendingAll || dispatchedMarksheets.length === 0
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 transition-colors'
                              }`}
                          >
                            {sendingAll ? 'Sending...' : '🔁 Resend All History'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {filteredMarksheets.map((marksheet) => {
                        // Build swipe actions using stable handlers passed as props
                        const swipeActions = [
                          {
                            label: 'Details',
                            icon: '👁️',
                            className: 'border-slate-300 text-slate-600 hover:border-slate-500 hover:bg-slate-50',
                            onClick: () => navigate(`/marksheets/${marksheet._id}`)
                          }
                        ];

                        if (marksheet.status === 'verified_by_staff') {
                          swipeActions.push({
                            label: 'Request',
                            icon: '📨',
                            className: 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50',
                            onClick: () => handleRequest(marksheet._id)
                          });
                        }

                        if (marksheet.status === 'approved_by_hod') {
                          swipeActions.push(
                            {
                              label: 'Download',
                              icon: '📥',
                              className: 'border-amber-300 text-amber-600 hover:border-amber-500 hover:bg-amber-50',
                              onClick: async () => {
                                const ts = Date.now();
                                const origin = getPublicOrigin();
                                const url = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}` : `/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}`;
                                window.open(url, '_blank');

                                try {
                                  await apiClient.put('/api/marksheets', { marksheetId: marksheet._id, status: 'dispatched' });
                                  moveToDispatchHistory([marksheet._id], (current) => ({
                                    ...current,
                                    status: 'dispatched',
                                    dispatchStatus: {
                                      ...(current.dispatchStatus || {}),
                                      dispatched: true,
                                      dispatchedAt: new Date().toISOString()
                                    }
                                  }));
                                } catch (err) {
                                  console.error('Error marking marksheet as dispatched:', err);
                                }
                              }
                            },
                            {
                              label: 'Send',
                              icon: '📤',
                              className: 'border-green-300 text-green-600 hover:border-green-500 hover:bg-green-50',
                              onClick: () => sendDispatch(marksheet)
                            }
                          );
                        }

                        if (marksheet.status === 'rejected_by_hod') {
                          swipeActions.push({
                            label: 'Review',
                            icon: '👁️',
                            className: 'border-red-300 text-red-600 hover:border-red-500 hover:bg-red-50',
                            onClick: () => navigate(`/marksheets/${marksheet._id}`)
                          });
                        }

                        if (marksheet.status === 'dispatched') {
                          swipeActions.push(
                            {
                              label: 'Download',
                              icon: '📥',
                              className: 'border-amber-300 text-amber-600 hover:border-amber-500 hover:bg-amber-50',
                              onClick: () => window.open(`/api/generate-pdf?marksheetId=${marksheet._id}`, '_blank')
                            },
                            {
                              label: 'Re-send',
                              icon: '🔁',
                              className: 'border-green-300 text-green-600 hover:border-green-500 hover:bg-green-50',
                              onClick: () => sendDispatch(marksheet)
                            }
                          );
                        }

                        return (
                          <SwipeableCard key={marksheet._id} actions={swipeActions}>
                            <div className="relative bg-white p-3 sm:p-6 md:pr-[15rem] rounded-xl shadow-sm border border-gray-200 transform transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
                              {/* Header with name and status badge */}
                              <div className="flex flex-row items-start justify-between gap-3 mb-2 sm:mb-3">
                                <h3 className="text-sm sm:text-lg font-semibold text-gray-900 break-words flex-1 min-w-0">
                                  {marksheet.studentDetails?.name}
                                </h3>
                                <span className={`w-fit inline-flex md:hidden items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold uppercase tracking-tight sm:tracking-wide flex-shrink-0 ${statusStyles[marksheet.status] || 'bg-gray-100 text-gray-700'}`}>
                                  <span className="text-xs sm:text-sm">{statusIcons[marksheet.status] || '📄'}</span>
                                  <span className="text-xs leading-tight whitespace-nowrap">{(marksheet.status || 'unknown').replace(/_/g, ' ')}</span>
                                </span>
                              </div>

                              {/* Register number and class */}
                              <p className="text-gray-600 text-xs sm:text-sm leading-snug mb-2 sm:mb-3">
                                {marksheet.studentDetails?.regNumber || '—'} • {formatYear(marksheet.studentDetails)}
                              </p>

                              {/* Info Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm items-start">
                                <div>
                                  <p className="text-gray-500 mb-0.5 font-medium">Parent:</p>
                                  <p className="font-medium text-gray-900 truncate">{marksheet.studentDetails?.parentPhoneNumber || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 mb-0.5 font-medium">Requested:</p>
                                  <p className="font-medium text-gray-900">{marksheet.dispatchRequest?.requestedAt ? new Date(marksheet.dispatchRequest.requestedAt).toLocaleDateString() : '—'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 mb-0.5 font-medium">HOD Decision:</p>
                                  <p className="font-medium text-gray-900">{marksheet.dispatchRequest?.hodResponse ? marksheet.dispatchRequest.hodResponse.toUpperCase() : '—'}</p>
                                </div>
                              </div>

                              {/* Desktop Actions - Separate from record details */}
                              <div className="hidden md:flex absolute right-6 top-6 w-[200px] justify-center">
                                <div className="flex w-full flex-col gap-2.5">
                                  <span className={`hidden md:inline-flex w-fit self-center items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold uppercase tracking-tight sm:tracking-wide ${statusStyles[marksheet.status] || 'bg-gray-100 text-gray-700'}`}>
                                    <span className="text-xs sm:text-sm">{statusIcons[marksheet.status] || 'ðŸ“„'}</span>
                                    <span className="text-xs leading-tight whitespace-nowrap">{(marksheet.status || 'unknown').replace(/_/g, ' ')}</span>
                                  </span>
                                  {marksheet.status === 'verified_by_staff' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRequest(marksheet._id)}
                                      disabled={requestingIds.includes(marksheet._id)}
                                      className={`w-full inline-flex items-center justify-center px-4 py-2 rounded-xl font-semibold text-sm transition-colors duration-200 ${requestingIds.includes(marksheet._id) ? 'bg-blue-300 text-white cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                    >
                                      Request
                                    </button>
                                  )}

                                  {marksheet.status === 'approved_by_hod' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => sendDispatch(marksheet)}
                                        disabled={dispatchingId === marksheet._id}
                                        className={`w-full inline-flex items-center justify-center px-4 py-2 rounded-xl font-semibold text-sm transition-colors duration-200 ${dispatchingId === marksheet._id ? 'bg-green-300 text-white cursor-wait' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                      >
                                        Send
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault()
                                          const ts = Date.now()
                                          const origin = getPublicOrigin()
                                          const url = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}` : `/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}`
                                          window.open(url, '_blank')
                                          try {
                                            await apiClient.put('/api/marksheets', { marksheetId: marksheet._id, status: 'dispatched' })
                                            moveToDispatchHistory([marksheet._id], (current) => ({
                                              ...current,
                                              status: 'dispatched',
                                              dispatchStatus: {
                                                ...(current.dispatchStatus || {}),
                                                dispatched: true,
                                                dispatchedAt: new Date().toISOString()
                                              }
                                            }))
                                          } catch (err) {
                                            console.error('Error marking marksheet as dispatched:', err)
                                          }
                                        }}
                                        className="w-full inline-flex items-center justify-center px-4 py-2 rounded-xl font-semibold text-sm transition-colors duration-200 bg-yellow-500 text-white hover:bg-yellow-600"
                                      >
                                        Download
                                      </button>
                                    </>
                                  )}

                                  {marksheet.status === 'rejected_by_hod' && (
                                    <a
                                      href={`/marksheets/${marksheet._id}`}
                                      className="block w-full px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border-2 border-red-300 bg-white hover:bg-red-50 text-center transition-colors duration-200"
                                    >
                                      Review
                                    </a>
                                  )}

                                  {marksheet.status === 'dispatched' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => sendDispatch(marksheet)}
                                        disabled={dispatchingId === marksheet._id}
                                        className={`w-full inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 ${dispatchingId === marksheet._id ? 'bg-green-300 text-white cursor-wait' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                      >
                                        Re-send
                                      </button>
                                      <a
                                        href={`/api/generate-pdf?marksheetId=${marksheet._id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block w-full px-4 py-2 rounded-lg text-sm font-semibold text-yellow-600 border-2 border-yellow-300 bg-white hover:bg-yellow-50 text-center transition-colors duration-200"
                                      >
                                        Download
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Mobile: Swipe instruction hint */}
                              <div className="sm:hidden -mx-3 -mb-3 mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100">
                                <p className="text-xs text-center text-gray-700 flex items-center justify-center gap-2">
                                  <span>👈</span>
                                  <span className="font-medium">Swipe left for actions</span>
                                </p>
                              </div>
                            </div>
                          </SwipeableCard>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div>
      <span className="block text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

function formatYear(details = {}) {
  const year = (details.year || '').toString()
  const section = (details.section || '').toString()
  if (!year && !section) return '—'
  if (!section) return year
  if (!year) return section
  if (year.includes('-')) return year
  return `${year}-${section}`
}

export default DispatchRequests

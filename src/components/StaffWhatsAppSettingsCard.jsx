import { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import { QrCode, RefreshCw, Trash2, Wifi, WifiOff, X } from 'lucide-react'
import QRCode from 'qrcode'
import ConfirmDialog from './ConfirmDialog'
import { useAlert } from './AlertContext'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'

export default function StaffWhatsAppSettingsCard() {
  const { showSuccess, showError, showInfo } = useAlert()
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrCode, setQRCode] = useState(null)
  const [qrImageSrc, setQrImageSrc] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteGuardUntil, setDeleteGuardUntil] = useState(0)

  const fetchConnectionStatus = async (showLoader = false, forceFresh = false) => {
    if (showLoader) setLoading(true)
    try {
      const data = await apiClient.get('/api/whatsapp-dispatch?action=connection-status', {
        cache: !forceFresh,
        ttl: forceFresh ? 0 : 15 * 1000,
        timeout: 60000,
        retry: 1,
        retryDelay: 800
      })

      const isTransientConnectedState = data?.connected === true || data?.state === 'open'
      if (Date.now() < deleteGuardUntil && isTransientConnectedState) {
        console.log('[Staff QR] Ignoring stale connected status during delete guard window', data)
        return
      }


      setConnectionStatus(data || null)
    } catch (error) {
      setConnectionStatus({ connected: false, state: 'error', error: error?.message || 'Network error' })
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnectionStatus(true)
  }, [])

  const refreshAfterDelete = async () => {
    const retryDelays = [600, 1200, 2000]

    for (const delayMs of retryDelays) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      try {
        const data = await apiClient.get('/api/whatsapp-dispatch?action=connection-status', {
          cache: false,
          ttl: 0,
          timeout: 60000,
          retry: 0
        })

        const stillConnected = data?.connected === true || data?.state === 'open'
        if (!stillConnected) {
          setConnectionStatus(data || { connected: false, state: 'disconnected' })
          setDeleteGuardUntil(0)
          return
        }
      } catch (error) {
        console.log('[Staff QR] Post-delete refresh failed, retrying:', error?.message || error)
      }
    }

    setConnectionStatus({ connected: false, state: 'disconnected' })
    setDeleteGuardUntil(0)
  }

  const closeQrModal = async () => {
    setShowQR(false)
    setQrImageSrc(null)
    setQRCode(null)
    await fetchConnectionStatus(false, true)
  }

  const handleRefreshStatus = async (event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    await fetchConnectionStatus(true, true)
  }

  const openQrModal = (payload) => {
    console.log('[Staff QR] openQrModal called', {
      hasBase64: !!payload?.base64,
      hasQrcode: !!payload?.qrcode,
      qrcodeType: typeof payload?.qrcode,
      qrcodeLength: typeof payload?.qrcode === 'string' ? payload.qrcode.length : null
    })
    setQRCode(payload)
    console.log('[Staff QR] opening QR modal immediately')
    setShowQR(true)
  }

  const getQrTextValue = (payload) => {
    if (!payload) return ''
    if (typeof payload.qrcode === 'string') return payload.qrcode
    if (payload.qrcode && typeof payload.qrcode === 'object') {
      if (typeof payload.qrcode.qrcode === 'string') return payload.qrcode.qrcode
      if (typeof payload.qrcode.code === 'string') return payload.qrcode.code
      if (typeof payload.qrcode.pairingCode === 'string') return payload.qrcode.pairingCode
    }
    if (typeof payload.code === 'string') return payload.code
    if (typeof payload.pairingCode === 'string') return payload.pairingCode
    return ''
  }

  const normalizeQrPayload = (data) => {
    if (!data) return null

    if (data.qrcode && typeof data.qrcode === 'object') {
      return {
        ...data,
        ...data.qrcode,
        qrcode: typeof data.qrcode.qrcode === 'string' ? data.qrcode.qrcode : data.qrcode
      }
    }

    return data
  }

  useEffect(() => {
    let cancelled = false

    const prepareQrImage = async () => {
      if (!qrCode) {
        console.log('[Staff QR] prepareQrImage: no qrCode payload')
        setQrImageSrc(null)
        return
      }

      if (qrCode.base64) {
        const normalized = qrCode.base64.startsWith('data:image')
          ? qrCode.base64
          : `data:image/png;base64,${qrCode.base64}`
        console.log('[Staff QR] prepareQrImage: using base64 from payload', {
          prefix: typeof normalized === 'string' ? normalized.slice(0, 40) : null,
          length: typeof normalized === 'string' ? normalized.length : null
        })
        setQrImageSrc(normalized)
        return
      }

      const qrTextValue = getQrTextValue(qrCode)

      if (!qrTextValue) {
        console.log('[Staff QR] prepareQrImage: no usable qrcode string', qrCode)
        setQrImageSrc(null)
        return
      }

      try {
        console.log('[Staff QR] prepareQrImage: generating image from qrcode text', {
          qrcodeLength: qrTextValue.length,
          qrcodePreview: qrTextValue.slice(0, 80)
        })
        const dataUrl = await QRCode.toDataURL(qrTextValue, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#FFFFFF' }
        })
        if (!cancelled) {
          console.log('[Staff QR] prepareQrImage: generated dataUrl successfully', {
            prefix: dataUrl.slice(0, 40),
            length: dataUrl.length
          })
          setQrImageSrc(dataUrl)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Staff QR] prepareQrImage: failed to generate dataUrl', error)
          setQrImageSrc(null)
        }
      }
    }

    prepareQrImage()

    return () => {
      cancelled = true
    }
  }, [qrCode])

  const handleGetQR = async (event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    console.log('[Staff QR] Get QR clicked', {
      connectionStatus,
      currentShowQR: showQR,
      currentHasQrCode: !!qrCode,
      currentHasQrImageSrc: !!qrImageSrc
    })
    setQrLoading(true)
    setQRCode(null)
    setQrImageSrc(null)
    try {
      const data = await apiClient.get('/api/whatsapp-dispatch?action=qrcode', { cache: false, timeout: 20000 })
      const normalizedPayload = normalizeQrPayload(data)
      console.log('[Staff QR] QR API response received', {
        success: data?.success,
        connected: data?.connected,
        state: data?.state,
        hasBase64: !!data?.base64,
        hasQrcode: !!data?.qrcode,
        qrcodeType: typeof data?.qrcode,
        qrcodeLength: typeof data?.qrcode === 'string' ? data.qrcode.length : null,
        payload: data
      })
      console.log('[Staff QR] Normalized QR payload', {
        hasBase64: !!normalizedPayload?.base64,
        hasQrcode: !!normalizedPayload?.qrcode,
        qrcodeType: typeof normalizedPayload?.qrcode,
        qrcodeLength: typeof normalizedPayload?.qrcode === 'string' ? normalizedPayload.qrcode.length : null,
        payload: normalizedPayload
      })

      if (data?.success && (data.connected || data.state === 'open')) {
        console.log('[Staff QR] API says already connected')
        showInfo('Already Connected', data.message || 'WhatsApp is already connected.')
        await fetchConnectionStatus(false, true)
        return
      }

      if (data?.success && (normalizedPayload?.base64 || normalizedPayload?.qrcode)) {
        console.log('[Staff QR] API returned usable QR payload')
        openQrModal(normalizedPayload)
        return
      }

      console.warn('[Staff QR] API returned no usable QR payload', data)
      showError('QR Failed', data?.error || 'Could not generate QR code. Please try again.')
    } catch (error) {
      console.error('[Staff QR] QR request failed', error)
      showError('QR Failed', getUserFriendlyMessage(error, 'Could not generate QR code. Please try again.'))
    } finally {
      console.log('[Staff QR] handleGetQR finished')
      setQrLoading(false)
    }
  }

  const handleDeleteInstance = async () => {
    setLoading(true)
    setShowQR(false)
    setQRCode(null)
    setQrImageSrc(null)
    setConfirmDelete(false)
    setDeleteGuardUntil(Date.now() + 7000)
    setConnectionStatus({ connected: false, state: 'close' })
    try {
      // First, logout the instance to ensure device is logged out
      try {
        await apiClient.post('/api/whatsapp-dispatch?action=logout', null, { timeout: 10000 })
        console.log('[Staff QR] Instance logout called before delete')
      } catch (logoutErr) {
        console.warn('[Staff QR] Instance logout failed before delete:', logoutErr?.message || logoutErr)
      }

      // Then, delete the instance
      const data = await apiClient.del('/api/whatsapp-dispatch?action=delete-instance', { timeout: 15000 })
      setConnectionStatus({ connected: false, state: 'close' })
      void refreshAfterDelete()
    } catch (error) {
      if (error?.status === 404) {
        setConnectionStatus({ connected: false, state: 'close' })
        void refreshAfterDelete()
      } else {
        setDeleteGuardUntil(0)
        await fetchConnectionStatus(false, true)
        showError('Delete Failed', getUserFriendlyMessage(error, 'Could not delete the WhatsApp instance.'))
      }
    } finally {
      setLoading(false)
    }
  }

  const statusMeta = useMemo(() => {
    const isConnected = connectionStatus?.connected === true || connectionStatus?.state === 'open'

    if (isConnected) {
      return {
        dot: 'bg-green-500',
        badge: 'bg-green-50 text-green-700 border-green-200',
        label: 'Connected'
      }
    }

    if (connectionStatus?.state === 'not_configured') {
      return {
        dot: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        label: 'Not Configured'
      }
    }

    if (connectionStatus?.state === 'error') {
      return {
        dot: 'bg-red-500',
        badge: 'bg-red-50 text-red-700 border-red-200',
        label: 'Connection Error'
      }
    }

    if (connectionStatus?.state === 'deleted') {
      return {
        dot: 'bg-gray-400',
        badge: 'bg-gray-50 text-gray-700 border-gray-200',
        label: 'Deleted'
      }
    }

    return {
      dot: 'bg-gray-400',
      badge: 'bg-gray-50 text-gray-700 border-gray-200',
      label: 'Disconnected'
    }
  }, [connectionStatus])

  const connectionStateLabel = connectionStatus?.state ? String(connectionStatus.state).replace(/_/g, ' ') : 'unknown'
  const isConnected = connectionStatus?.connected === true || connectionStatus?.state === 'open'
  const qrTextValue = getQrTextValue(qrCode)

  useEffect(() => {
    console.log('[Staff QR] modal/image state changed', {
      showQR,
      hasQrCode: !!qrCode,
      hasQrImageSrc: !!qrImageSrc
    })
  }, [showQR, qrCode, qrImageSrc])

  return (
    <>
      <div className="border-t border-[#e7edf4] pt-3">
        <h4 className="text-sm font-semibold text-[#111418] mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 5a2 2 0 012-2h4a2 2 0 012 2v1h1a2 2 0 012 2v2h1a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-1H3a2 2 0 01-2-2V7a2 2 0 012-2z" />
          </svg>
          WhatsApp Connection
        </h4>

        <div className="rounded-xl border border-[#e7edf4] bg-gradient-to-br from-white to-[#f8fbff] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isConnected ? <Wifi className="w-4 h-4 text-green-600" /> : <WifiOff className="w-4 h-4 text-gray-500" />}
                <p className="text-sm font-semibold text-[#111418]">Dispatch WhatsApp</p>
              </div>
              <p className="text-xs text-[#60758a] mt-1">QR setup and instance reset.</p>
            </div>

            <button
              type="button"
              onClick={handleRefreshStatus}
              disabled={loading}
              className="relative z-10 shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#dbe5ef] bg-white text-[#60758a] hover:text-[#111418] hover:border-[#c6d4e2] disabled:opacity-50"
              style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
              title="Refresh connection status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badge}`}>
              <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
            <span className="text-xs text-[#60758a] capitalize">State: {connectionStateLabel}</span>
          </div>

          {connectionStatus?.error && (
            <p className="mt-2 text-xs text-red-600">{connectionStatus.error}</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGetQR}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              disabled={loading || qrLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              title="Get QR code"
            >
              {qrLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              <span>{qrLoading ? 'Loading QR...' : 'Get QR'}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              title="Delete instance"
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>

      {showQR && qrCode && ReactDOM.createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[120] flex items-center justify-center min-h-screen p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              console.log('[Staff QR] closing modal from backdrop')
              closeQrModal()
            }
          }}
        >
          <div
            className="bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Scan QR Code</h3>
              <button
                type="button"
                onClick={async () => {
                  console.log('[Staff QR] closing modal from header close')
                  await closeQrModal()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                title="Close QR modal"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg border-2 border-gray-200 flex justify-center">
              {qrImageSrc ? (
                <img
                  src={qrImageSrc}
                  alt="WhatsApp QR code"
                  className="w-full max-w-xs sm:max-w-sm h-auto"
                />
              ) : qrTextValue ? (
                <div className="bg-gray-100 p-2 sm:p-4 rounded text-center overflow-x-auto">
                  <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">{qrTextValue}</pre>
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm">QR code not available</p>
              )}
            </div>

            <div className="mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-700 mb-2 font-semibold">
                Steps to connect:
              </p>
              <ol className="text-xs sm:text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Open WhatsApp on your phone</li>
                <li>Go to Settings to Linked Devices</li>
                <li>Tap Link a Device</li>
                <li>Scan this QR code</li>
              </ol>
            </div>

            <button
              onClick={async () => {
                console.log('[Staff QR] closing modal from footer close')
                await closeQrModal()
              }}
              className="mt-4 w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete WhatsApp Instance"
        description="This will remove the current WhatsApp session and stored instance data. You will need to generate a new QR code to reconnect."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteInstance}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

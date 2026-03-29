import { useEffect, useMemo, useState } from 'react'
import { QrCode, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { useAlert } from './AlertContext'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'

export default function StaffWhatsAppSettingsCard() {
  const { showSuccess, showError } = useAlert()
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [qrCode, setQRCode] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fetchConnectionStatus = async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const data = await apiClient.get('/api/whatsapp-dispatch?action=connection-status', {
        cache: true,
        ttl: 15 * 1000,
        timeout: 60000,
        retry: 1,
        retryDelay: 800
      })
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

  const handleGetQR = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/api/whatsapp-dispatch?action=qrcode', { cache: false, timeout: 20000 })

      if (data?.success && (data.connected || data.state === 'open')) {
        showSuccess('Already Connected', data.message || 'WhatsApp is already connected.')
        await fetchConnectionStatus()
        return
      }

      if (data?.success && data.qrcode) {
        setQRCode(data.qrcode)
        setShowQR(true)
        showSuccess('QR Ready', 'Scan the QR code in WhatsApp to connect.')
        return
      }

      showError('QR Failed', data?.error || 'Could not generate QR code. Please try again.')
    } catch (error) {
      showError('QR Failed', getUserFriendlyMessage(error, 'Could not generate QR code. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInstance = async () => {
    setLoading(true)
    try {
      const data = await apiClient.del('/api/whatsapp-dispatch?action=delete-instance', { timeout: 15000 })
      showSuccess('Instance Deleted', data?.message || 'WhatsApp instance deleted successfully.')
      setShowQR(false)
      setQRCode(null)
      setConfirmDelete(false)
      await fetchConnectionStatus()
    } catch (error) {
      if (error?.status === 404) {
        showSuccess('Instance Deleted', error?.data?.message || 'WhatsApp instance deleted successfully.')
        setShowQR(false)
        setQRCode(null)
        setConfirmDelete(false)
        await fetchConnectionStatus()
      } else {
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

    return {
      dot: 'bg-gray-400',
      badge: 'bg-gray-50 text-gray-700 border-gray-200',
      label: 'Disconnected'
    }
  }, [connectionStatus])

  const connectionStateLabel = connectionStatus?.state ? String(connectionStatus.state).replace(/_/g, ' ') : 'unknown'
  const isConnected = connectionStatus?.connected === true || connectionStatus?.state === 'open'

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
              onClick={() => fetchConnectionStatus(true)}
              disabled={loading}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#dbe5ef] bg-white text-[#60758a] hover:text-[#111418] hover:border-[#c6d4e2] disabled:opacity-50"
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
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              title="Get QR code"
            >
              <QrCode className="w-4 h-4" />
              <span>Get QR</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              title="Delete instance"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {showQR && qrCode && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowQR(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Scan QR Code</h3>
                <p className="text-xs text-gray-500 mt-1">Open WhatsApp and scan to connect this staff device.</p>
              </div>
              <button type="button" onClick={() => setShowQR(false)} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50">
                X
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 flex justify-center">
              {qrCode?.base64 ? (
                <img
                  src={qrCode.base64.startsWith('data:image') ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
                  alt="WhatsApp QR code"
                  className="w-full max-w-xs h-auto"
                />
              ) : qrCode?.qrcode ? (
                <pre className="text-xs whitespace-pre-wrap break-words overflow-auto">{qrCode.qrcode}</pre>
              ) : (
                <p className="text-sm text-gray-500">QR code not available.</p>
              )}
            </div>
          </div>
        </div>
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

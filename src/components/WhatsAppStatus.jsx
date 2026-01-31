import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, RefreshCw, QrCode, AlertCircle, Wifi, WifiOff, Trash2, Phone } from 'lucide-react';
import { useAlert } from './AlertContext';
import ConfirmDialog from './ConfirmDialog';
import RefreshButton from './RefreshButton';
import apiClient from '../utils/apiClient';
import { getUserFriendlyMessage } from '../utils/apiErrorMessages';

export default function WhatsAppStatus() {
  const [status, setStatus] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQRCode] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  
  const { showSuccess, showError, showInfo } = useAlert();
  const origin = import.meta.env.VITE_API_URL || '';

  const CACHE_KEY = 'whatsapp_status_cache_v1';
  const STALE_MS = 30 * 1000; // 30 seconds

  const intervalRef = useRef(null);
  const intervalMsRef = useRef(15000);
  useEffect(() => {
    // Try to populate from cache for instant UI
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.status) setStatus(parsed.status);
        if (parsed?.connectionStatus) setConnectionStatus(parsed.connectionStatus);
        // background refresh (non-blocking)
        fetchStatus();
        fetchConnectionStatus();
      } else {
        fetchStatus();
        fetchConnectionStatus();
      }
    } catch (e) {
      fetchStatus();
      fetchConnectionStatus();
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    // Slightly longer interval to reduce backend pressure
    intervalRef.current = setInterval(fetchConnectionStatus, intervalMsRef.current);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const data = await apiClient.get('/api/whatsapp-dispatch?action=status', { cache: true, ttl: 30 * 1000, timeout: 15000 });
      if (!data) return;
      console.log('WhatsApp status data:', data); // Debug log
      setStatus(data);
      try {
        const existingRaw = localStorage.getItem(CACHE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          status: data,
          connectionStatus: existing.connectionStatus || connectionStatus || null,
          ts: Date.now()
        }));
      } catch (e) {}
    } catch (error) {
      console.warn('Failed to fetch WhatsApp status:', error.message || error);
    }
  };

  const fetchConnectionStatus = async () => {
    try {
      const data = await apiClient.get('/api/whatsapp-dispatch?action=connection-status', { cache: true, ttl: 15 * 1000, timeout: 60000, retry: 1, retryDelay: 800 });
      if (!data) return;
      console.log('Connection status data:', data); // Debug log
      setConnectionStatus(data);
      try {
        const existingRaw = localStorage.getItem(CACHE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          status: existing.status || status || null,
          connectionStatus: data,
          ts: Date.now()
        }));
      } catch (e) {}
    } catch (error) {
      setConnectionStatus({ connected: false, state: 'error', error: error?.message || 'Network error' });
      // On repeated errors, back off polling frequency to reduce load
      try {
        if (intervalMsRef.current === 15000) {
          intervalMsRef.current = 30000;
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(fetchConnectionStatus, intervalMsRef.current);
        }
      } catch (e) {}
      try {
        const existingRaw = localStorage.getItem(CACHE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          status: existing.status || status || null,
          connectionStatus: { connected: false, state: 'error', error: error?.message || 'Network error' },
          ts: Date.now()
        }));
      } catch (e) {}
    }
  };

  const fetchQRCode = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/api/whatsapp-dispatch?action=qrcode', { cache: false, timeout: 20000 });
      
      console.log('QR Code API response:', data); // Debug log
      
      if (data.success) {
        // Check if instance is already connected
        if (data.connected || data.state === 'open') {
          showInfo('Already Connected', data.message || 'WhatsApp instance is already connected. Use "Disconnect" to link a different number.');
          await fetchConnectionStatus(); // Refresh status
          return;
        }
        
        // Check if we have QR code data
        if (data.qrcode) {
          console.log('QR Code data:', data.qrcode); // Debug log
          setQRCode(data.qrcode || data);
          setShowQR(true);
          showSuccess('QR Code ready', 'Scan the QR code with your WhatsApp app.');
        } else {
          showError('No QR Code', 'No QR code was returned. The instance may need to be created first.');
        }
      } else {
        showError('Failed to generate QR code', data.error || 'Could not generate QR code. Please try again.');
      }
    } catch (error) {
      showError('Failed to generate QR code', getUserFriendlyMessage(error, 'Could not generate QR code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const checkInstanceStatus = async () => {
    setLoading(true);
    await fetchStatus();
    await fetchConnectionStatus();
    setLoading(false);
  };

  const performLogout = async () => {
    setLoading(true);
    try {
      console.log('Logging out instance...');
      const data = await apiClient.post(`${origin}/api/whatsapp-dispatch?action=logout`, null, { timeout: 10000 });
      console.log('Logout response:', data);
      if (data && data.success) {
        showSuccess('Disconnected', data.message || 'WhatsApp disconnected successfully. Use "Get QR Code" to connect a different number.');
        // Wait a moment then refresh status
        setTimeout(async () => {
          await fetchStatus();
          await fetchConnectionStatus();
        }, 1000);
      } else {
        showError('Failed to disconnect', (data && (data.error || data.message)) || 'Could not disconnect. Please try again.');
      }
    } catch (error) {
      showError('Failed to disconnect WhatsApp', getUserFriendlyMessage(error, 'Could not disconnect. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const performDeleteInstance = async () => {
    console.log('🗑️ performDeleteInstance called!');
    setLoading(true);
    try {
      console.log('🗑️ Starting instance deletion...');
      try {
        const data = await apiClient.del(`${origin}/api/whatsapp-dispatch?action=delete-instance`, { timeout: 15000 });
        console.log('Delete instance result:', data);
        showSuccess('Instance Deleted', data.message || 'WhatsApp instance has been deleted successfully');

        // Clear local state immediately
        setStatus(prev => ({ ...prev, configured: false }));
        setConnectionStatus(null);

        // Wait 2 seconds before refreshing to allow backend cleanup
        console.log('⏳ Waiting for backend cleanup...');
        setTimeout(async () => {
          console.log('🔄 Refreshing status...');
          await fetchStatus();
          await fetchConnectionStatus();
        }, 2000);
      } catch (err) {
        // Treat 404 as success (resource already gone)
        if (err && err.status === 404) {
          const payload = err.data || {};
          showSuccess('Instance Deleted', payload.message || 'WhatsApp instance has been deleted successfully');
          setStatus(prev => ({ ...prev, configured: false }));
          setConnectionStatus(null);
          setTimeout(async () => {
            await fetchStatus();
            await fetchConnectionStatus();
          }, 2000);
        } else {
          console.error('❌ Delete instance error:', err);
          showError('Failed to delete instance', getUserFriendlyMessage(err, 'Could not delete instance. Please try again.'));
        }
      }
    } catch (error) {
      showError('Failed to delete instance', getUserFriendlyMessage(error, 'Could not delete instance. Please try again.'));
    } finally {
      setLoading(false);
    }

  };

  const handleLogout = () => {
    setConfirmAction({
      title: 'Disconnect WhatsApp',
      message: 'Disconnect the current WhatsApp number? You will need to scan a new QR code to reconnect.',
      onConfirm: performLogout
    });
  };

  const handleDeleteInstance = () => {
    console.log('🗑️ handleDeleteInstance clicked!');
    setConfirmAction({
      title: 'Delete WhatsApp Instance',
      message: 'This will delete the instance and all session data. You will need to create a new instance and scan a fresh QR code. Continue?',
      onConfirm: performDeleteInstance
    });
  };

  if (loading && !status) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const isConfigured = status.configured;
  const isConnected = connectionStatus?.connected === true || connectionStatus?.state === 'open' || false;
  const connectionState = connectionStatus?.state || 'unknown';

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <h3 className="text-lg font-semibold text-gray-900">Evolution API Status</h3>
            </div>
            <button
              onClick={() => {
                fetchStatus();
                fetchConnectionStatus();
              }}
              disabled={loading}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Real-time Connection Status */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <Wifi className="w-5 h-5 text-green-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-gray-400" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Connection Status</p>
                <p className="text-xs text-gray-600">
                  {isConnected ? (
                    <span className="text-green-600 font-semibold">● Connected</span>
                  ) : (
                    <span className="text-gray-500">● Disconnected</span>
                  )}
                  {connectionState && connectionState !== 'unknown' && (
                    <span className="ml-2 text-gray-500">({connectionState})</span>
                  )}
                </p>
                {!isConnected && connectionStatus?.error && (
                  <p className="text-xs text-red-500 mt-1">
                    Error: {connectionStatus.error}
                  </p>
                )}
                {!isConnected && connectionStatus?.state === 'not_configured' && (
                  <p className="text-xs text-yellow-600 mt-1">
                    ⚠️ Evolution API not configured in .env
                  </p>
                )}
                {!isConnected && connectionStatus?.error?.includes('404') && (
                  <p className="text-xs text-yellow-600 mt-1">
                    ⚠️ Instance not found - Click "Get QR Code" to create it
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Auto-refresh: 10s</p>
              {connectionStatus && (
                <p className="text-xs text-gray-400">
                  Last updated: {new Date().toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Provider Info */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            {isConfigured ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900">Provider:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Evolution API
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {isConfigured 
                  ? '✅ Evolution API is configured and ready' 
                  : '❌ Evolution API is not configured'
                }
              </p>
            </div>
          </div>

          {/* Evolution API Details */}
          <div className="space-y-3">
            {status.configured !== undefined && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Instance Name</p>
                  <p className="text-sm font-medium text-gray-900">{status.instance || 'Not set'}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Base URL</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{status.baseUrl || 'Not set'}</p>
                </div>
              </div>
            )}

            {/* Action Buttons - Always show if API is configured */}
            {isConfigured && (
              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <button
                    onClick={fetchQRCode}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Get QR Code</span>
                  </button>
                  <button
                    onClick={checkInstanceStatus}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh Status</span>
                  </button>
                </div>
                {/* Admin controls - always visible */}
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Disconnect current WhatsApp and connect a new number"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Disconnect & Change Number</span>
                </button>
                <button
                  onClick={handleDeleteInstance}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete instance and all session data - fresh start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Instance</span>
                </button>
              </div>
            )}
          </div>

          {/* Setup Guide Link */}
          {!isConfigured && (
            <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-800 mb-1">
                  WhatsApp service is not configured. Please set up Evolution API to enable marksheet dispatch.
                </p>
                <a 
                  href={status.setupGuide || '#'} 
                  className="text-sm font-medium text-yellow-900 hover:text-yellow-700 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Setup Guide →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* QR Code Modal */}
        {showQR && qrCode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center min-h-screen p-3 sm:p-4">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Scan QR Code</h3>
                <button
                  onClick={() => setShowQR(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-white p-3 sm:p-4 rounded-lg border-2 border-gray-200 flex justify-center">
                {qrCode.base64 ? (
                  <img 
                    src={qrCode.base64 && qrCode.base64.startsWith('data:image') ? qrCode.base64 : `data:image/png;base64,${qrCode.base64}`}
                    alt="WhatsApp QR Code" 
                    className="w-full max-w-xs sm:max-w-sm h-auto"
                  />
                ) : qrCode.qrcode ? (
                  <div className="bg-gray-100 p-2 sm:p-4 rounded text-center overflow-x-auto">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">{qrCode.qrcode}</pre>
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
                  <li>Go to Settings → Linked Devices</li>
                  <li>Tap "Link a Device"</li>
                  <li>Scan this QR code</li>
                </ol>
              </div>

              <button
                onClick={() => setShowQR(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          open={true}
          title={confirmAction.title}
          description={confirmAction.message}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => {
            console.log('✅ Confirm dialog confirmed, executing callback...');
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => {
            console.log('❌ Confirm dialog cancelled');
            setConfirmAction(null);
          }}
        />
      )}
    </>
  );
}

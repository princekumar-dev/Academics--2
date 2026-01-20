import React, { useState } from 'react';
import { useAlert } from './AlertContext';
import ConfirmDialog from './ConfirmDialog';

export default function SWControls() {
  const { showSuccess, showError, showInfo } = useAlert();
  const [working, setWorking] = useState(false);

  async function unregisterAll() {
    if (!('serviceWorker' in navigator)) {
      showError('Service Worker', 'Service workers are not supported in this browser');
      return;
    }
    setWorking(true);
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(()=>false)));
      showSuccess('Service Workers', 'All service workers unregistered');
      broadcastReload();
    } catch (e) {
      showError('Service Workers', String(e));
    } finally { setWorking(false); }
  }

  async function clearCaches() {
    if (!('caches' in window)) {
      showError('Cache', 'CacheStorage not supported');
      return;
    }
    setWorking(true);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(()=>false)));
      showSuccess('Caches', 'All Cache Storage entries removed');
      broadcastReload();
    } catch (e) {
      showError('Caches', String(e));
    } finally { setWorking(false); }
  }

  function clearLocalStorage() {
    try {
      // Keep this conservative: only clear known app keys
      localStorage.removeItem('whatsapp_status_cache_v1');
      localStorage.removeItem('auth');
      localStorage.removeItem('userEmail');
      showSuccess('Local Storage', 'Selected localStorage keys cleared');
      // Notify other clients via storage event + service worker reload
      try { localStorage.setItem('msec:reload_signal', Date.now()); } catch (e) {}
      broadcastReload();
    } catch (e) {
      showError('Local Storage', String(e));
    }
  }

  function hardReloadAll() {
    try {
      // Try to reload all window clients via postMessage + clients.matchAll in SW is not available here,
      // but we can do a forced reload of current window.
      showInfo('Reload', 'Performing hard reload of this page');
      window.location.reload(true);
      // Also request SW to reload other clients
      broadcastReload();
    } catch (e) {
      showError('Reload', String(e));
    }
  }

  async function broadcastReload() {
    try {
      if (!('serviceWorker' in navigator)) return;
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        try {
          const target = reg.active || reg.waiting || reg.installing;
          if (target && target.postMessage) {
            target.postMessage({ type: 'FORCE_RELOAD' });
          }
        } catch (e) {
          // ignore per-registration errors
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const [confirmAction, setConfirmAction] = useState(null);

  return (
    <div className="mt-4 bg-white p-3 rounded-md border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">Service Worker & Cache Controls</h4>
      <p className="text-xs text-gray-600 mb-3">Use these controls when deploying to production to ensure clients pick up the latest assets.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setConfirmAction({ title: 'Unregister service workers?', message: 'This will unregister all service workers for this origin. Clients may lose offline support until you re-register the worker.', onConfirm: unregisterAll })} disabled={working} className="px-3 py-1 text-xs bg-red-600 text-white rounded-md">Unregister SWs</button>
        <button onClick={() => setConfirmAction({ title: 'Clear CacheStorage?', message: 'This will delete all CacheStorage entries for this origin. Offline assets and cached responses will be removed.', onConfirm: clearCaches })} disabled={working} className="px-3 py-1 text-xs bg-orange-600 text-white rounded-md">Clear CacheStorage</button>
        <button onClick={() => setConfirmAction({ title: 'Clear localStorage keys?', message: 'This will clear selected application localStorage keys (auth, cached status). You will be logged out if auth is removed.', onConfirm: clearLocalStorage })} className="px-3 py-1 text-xs bg-yellow-600 text-white rounded-md">Clear localStorage</button>
        <button onClick={() => setConfirmAction({ title: 'Hard reload page?', message: 'This will force a full reload of this page. Unsaved state may be lost.', onConfirm: hardReloadAll })} className="px-3 py-1 text-xs bg-gray-600 text-white rounded-md">Hard Reload</button>
      </div>
      {confirmAction && (
        <ConfirmDialog
          open={true}
          title={confirmAction.title}
          description={confirmAction.message}
          confirmLabel="Proceed"
          cancelLabel="Cancel"
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

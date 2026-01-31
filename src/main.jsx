import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './performance.css'

// Suppress browser extension errors
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason && (event.reason.message || event.reason.error || event.reason)
  // Ignore common extension/background errors
  if (typeof msg === 'string' && (msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection'))) {
    event.preventDefault()
    return
  }

  // Suppress expected authentication failures to avoid noisy uncaught promise logs
  if (typeof msg === 'string' && (
    msg.includes('Invalid registration number') ||
    msg.includes('Invalid email or password') ||
    msg.includes('Invalid email or password') ||
    msg.includes('Registration number and password are required')
  )) {
    // preventDefault stops the UnhandledPromiseRejection from being logged as uncaught
    try { event.preventDefault() } catch (e) { /* ignore */ }
    // Optionally dispatch a global event so UI can show a nicer toast if desired
    try { window.dispatchEvent(new CustomEvent('api:auth-failed', { detail: { message: msg } })) } catch (e) {}
    return
  }
})

// Listen for service worker messages (fallback reload request)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener?.('message', (evt) => {
    try {
      const msg = evt && evt.data ? evt.data : null;
      if (!msg || !msg.type) return;
      if (msg.type === 'RELOAD_REQUEST') {
        // Dispatch a cross-app event so the UI can show a gentle toast
        console.info('Service worker requested reload (dispatching event):', msg.reason || 'unknown');
        try {
          window.dispatchEvent(new CustomEvent('sw:reload-request', { detail: { reason: msg.reason } }));
        } catch (e) {
          // Fallback to direct reload if CustomEvent is not available
          setTimeout(() => {
            try { window.location.reload(); } catch (err) { /* ignore */ }
          }, 150);
        }
      }
      // When SW notifies of a pushed notification, trigger app-level refresh
      else if (msg.type === 'NOTIFICATION_RECEIVED') {
        try {
          // Use debounced central dispatcher so rapid push events don't cause
          // multiple immediate client fetches. Import dynamically to avoid
          // client-side bundling issues with non-browser env.
          import('./utils/notificationEvents').then(mod => {
            try { mod.notifyNotificationsUpdated(msg, 300) } catch (e) { try { window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: msg })) } catch (ee) {} }
          }).catch(() => {
            try { window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: msg })) } catch (ee) {}
          })
        } catch (e) {
          try { window.dispatchEvent(new Event('notificationsUpdated')) } catch (ee) {}
        }
      }
    } catch (e) {
      // ignore
    }
  });
}

// Error handling for the root element
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

// Create root with error boundary
const root = ReactDOM.createRoot(rootElement)

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error('Failed to render app:', error)
  // Fallback rendering without StrictMode
  root.render(<App />)
}

// Debug helper: print service worker registrations and CacheStorage keys
if (typeof window !== 'undefined') {
  async function logSWStatus() {
    try {
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          console.info('[sw-debug] registrations:', regs.map(r => ({ scope: r.scope, active: !!r.active, waiting: !!r.waiting })))
        } catch (e) {
          console.warn('[sw-debug] getRegistrations failed', e)
        }
        try {
          console.info('[sw-debug] controller:', navigator.serviceWorker.controller)
        } catch (e) {}
      } else {
        console.info('[sw-debug] serviceWorker not supported in this browser')
      }

      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          console.info('[sw-debug] CacheStorage keys:', keys)
          for (const k of keys) {
            try {
              const c = await caches.open(k)
              const reqs = await c.keys()
              console.info(`[sw-debug] cache:${k} entries:`, reqs.map(r => r.url).slice(0, 50))
            } catch (e) {
              console.warn('[sw-debug] reading cache', k, e)
            }
          }
        } catch (e) {
          console.warn('[sw-debug] caches.keys failed', e)
        }
      } else {
        console.info('[sw-debug] CacheStorage not available')
      }
    } catch (e) {
      console.error('[sw-debug] unexpected error', e)
    }
  }

  // Run once on load (non-blocking)
  setTimeout(() => { logSWStatus().catch(()=>{}); }, 300);
  // Expose helper for manual invocation
  window.debugSWStatus = logSWStatus
}

// Auto-register service worker if not already registered (helps ensure SWControls actions work)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  (async () => {
    try {
      const existing = await navigator.serviceWorker.getRegistrations();
      if (existing && existing.length > 0) {
        console.info('[sw-auto] already registered', existing.map(r => r.scope));
      } else {
        console.info('[sw-auto] attempting to register /service-worker.js');
        try {
          const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
          console.info('[sw-auto] registration success', reg.scope, reg);
          // Ensure ready
          await navigator.serviceWorker.ready;
          console.info('[sw-auto] service worker ready');
          // Refresh debug status after registration
          setTimeout(() => { window.debugSWStatus && window.debugSWStatus().catch(()=>{}); }, 200);
        } catch (err) {
          console.warn('[sw-auto] registration failed', err);
        }
      }
    } catch (e) {
      console.warn('[sw-auto] failed to check/register', e);
    }
  })();
}

// Debug helpers: find elements that cover the full viewport and allow
// toggling their `pointer-events` or forcing scroll to diagnose freezes
if (typeof window !== 'undefined') {
  window.findCoveringElements = () => {
    try {
      const nodes = Array.from(document.body.querySelectorAll('*'))
      const covering = nodes.filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && r.top <= 0 && r.left <= 0 && r.right >= window.innerWidth && r.bottom >= window.innerHeight
      })
      const info = covering.map(el => ({
        tag: el.tagName,
        id: el.id || null,
        class: el.className || null,
        zIndex: getComputedStyle(el).zIndex,
        pointerEvents: getComputedStyle(el).pointerEvents,
        position: getComputedStyle(el).position
      }))
      console.info('[debug] covering elements:', info)
      return covering
    } catch (e) {
      console.warn('[debug] findCoveringElements failed', e)
      return []
    }
  }

  window.toggleCoveringPointerEvents = () => {
    const covering = window.findCoveringElements()
    covering.forEach(el => {
      try {
        const curr = el.style.pointerEvents || getComputedStyle(el).pointerEvents
        el.dataset.__origPointer = el.dataset.__origPointer || curr
        el.style.pointerEvents = curr === 'none' ? (el.dataset.__origPointer || '') : 'none'
      } catch (e) {}
    })
    console.info('[debug] toggled pointer-events on', covering.length, 'elements')
  }

  window.forceTempScroll = (ms = 2000) => {
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    console.info('[debug] forced overflow:auto for', ms, 'ms')
    setTimeout(() => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
      console.info('[debug] restored overflow')
    }, ms)
  }

  // Key shortcuts: Ctrl+Shift+D => list covering elements
  // Ctrl+Shift+F => toggle pointer-events on covering elements
  // Ctrl+Shift+S => force scroll for 2s
  window.addEventListener('keydown', (evt) => {
    if (evt.ctrlKey && evt.shiftKey && evt.key.toLowerCase() === 'd') {
      evt.preventDefault(); window.findCoveringElements()
    }
    if (evt.ctrlKey && evt.shiftKey && evt.key.toLowerCase() === 'f') {
      evt.preventDefault(); window.toggleCoveringPointerEvents()
    }
    if (evt.ctrlKey && evt.shiftKey && evt.key.toLowerCase() === 's') {
      evt.preventDefault(); window.forceTempScroll(2000)
    }
  })
  // Toggle to disable heavy visual effects (backdrop-filter, filters, will-change)
  window.disableVisualEffects = () => {
    if (document.getElementById('debug-disable-visuals')) return
    const style = document.createElement('style')
    style.id = 'debug-disable-visuals'
    style.innerHTML = `
      .backdrop-blur-sm, [class*="backdrop-blur"], .backdrop-blur-md, .glass-card, .settings-modal, .notification-card, .notification-container {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      * {
        filter: none !important;
        will-change: auto !important;
        transform: none !important;
      }
    `
    document.head.appendChild(style)
    console.info('[debug] visual effects disabled')
  }

  window.restoreVisualEffects = () => {
    const s = document.getElementById('debug-disable-visuals')
    if (s) s.remove()
    console.info('[debug] visual effects restored')
  }

  // Touch-event tracing helpers: start/stop lightweight logging to help
  // diagnose which listeners are preventing scrolling on specific devices.
  window.startTouchTrace = (limit = 200) => {
    if (window.__touchTraceRunning) return console.info('[touch-trace] already running')
    window.__touchTrace = []
    window.__touchTraceRunning = true

    const log = (e) => {
      try {
        const t = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) || {}
        const entry = {
          time: Date.now(),
          type: e.type,
          target: e.target && (e.target.tagName || e.target.nodeName),
          id: e.target && (e.target.id || null),
          class: e.target && (e.target.className || null),
          x: t.clientX || null,
          y: t.clientY || null,
          defaultPrevented: e.defaultPrevented
        }
        window.__touchTrace.push(entry)
        if (window.__touchTrace.length > limit) window.__touchTrace.shift()
        // Keep console logs concise
        console.debug('[touch-trace]', entry.type, entry.target, 'dp=', entry.defaultPrevented)
      } catch (err) { /* ignore logging errors */ }
    }

    window.__touchTraceHandlers = {
      touchstart: (e) => log(e),
      touchmove: (e) => log(e),
      touchend: (e) => log(e)
    }

    document.addEventListener('touchstart', window.__touchTraceHandlers.touchstart, { passive: true })
    document.addEventListener('touchmove', window.__touchTraceHandlers.touchmove, { passive: true })
    document.addEventListener('touchend', window.__touchTraceHandlers.touchend, { passive: true })

    console.info('[touch-trace] started (check window.__touchTrace for recent events)')
  }

  window.stopTouchTrace = () => {
    if (!window.__touchTraceRunning) return console.info('[touch-trace] not running')
    document.removeEventListener('touchstart', window.__touchTraceHandlers.touchstart)
    document.removeEventListener('touchmove', window.__touchTraceHandlers.touchmove)
    document.removeEventListener('touchend', window.__touchTraceHandlers.touchend)
    window.__touchTraceRunning = false
    console.info('[touch-trace] stopped')
  }
}
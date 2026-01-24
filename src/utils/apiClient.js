const inFlight = new Map();
const cache = new Map();

function buildUrl(url) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const origin = import.meta.env.VITE_API_URL || '';
  return `${origin}${url}`;
}

async function request(method, url, opts = {}) {
  const {
    cache: useCache = true,
    ttl = 30 * 1000,
    timeout = 8000,
    dedupe = true,
    retry = 0,
    retryDelay = 500,
    body,
    headers,
    raw = false,
    responseType = 'json',
    // dispatch: whether to dispatch client-side events after non-GET mutations
    // dispatchEvent: string or array of events to dispatch (overrides auto-mapping)
    dispatch = true,
    dispatchEvent = null,
  } = opts;

  const bodyKey = body && !(body instanceof FormData) && !raw ? JSON.stringify(body) : (body instanceof FormData ? '[FormData]' : '');
  const key = `${method}:${url}:${bodyKey}`;

  if (useCache && cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.ts < (entry.ttl || ttl)) return entry.data;
    cache.delete(key);
  }

  if (dedupe && inFlight.has(key)) {
    return inFlight.get(key);
  }

  const p = (async () => {
    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        let fetchBody;
        const contentTypeHeader = {};

        if (body && !(body instanceof FormData) && !raw) {
          fetchBody = JSON.stringify(body);
          contentTypeHeader['Content-Type'] = 'application/json';
        } else {
          fetchBody = body;
        }

        const mergedHeaders = Object.assign({}, headers || {}, contentTypeHeader);

        const res = await fetch(buildUrl(url), {
          method,
          headers: mergedHeaders,
          body: fetchBody,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const e = new Error(`HTTP ${res.status}`);
          e.status = res.status;
          e.data = errData;
          throw e;
        }

        let data = null;
        if (responseType === 'json') {
          data = await res.json().catch(() => null);
        } else if (responseType === 'blob') {
          data = await res.blob();
        } else if (responseType === 'arrayBuffer') {
          data = await res.arrayBuffer();
        } else if (responseType === 'text') {
          data = await res.text();
        }

        if (useCache && responseType === 'json') {
          cache.set(key, { ts: Date.now(), data, ttl });
        }

        // After successful mutations (non-GET), optionally dispatch client-side events
        try {
          if (method !== 'GET' && dispatch) {
            // Determine events to dispatch
            let events = []
            if (dispatchEvent) {
              events = Array.isArray(dispatchEvent) ? dispatchEvent : [dispatchEvent]
            } else {
              const lower = buildUrl(url).toLowerCase()
              if (lower.includes('/api/marksheets')) events.push('marksheetsUpdated')
              if (lower.includes('/api/leaves')) events.push('notificationsUpdated')
              if (lower.includes('/api/staff-approval')) events.push('notificationsUpdated')
              if (lower.includes('/api/notifications')) events.push('notificationsUpdated')
              if (lower.includes('/api/whatsapp-dispatch')) events.push('marksheetsUpdated', 'notificationsUpdated')
            }

            // Dispatch unique events
            Array.from(new Set(events)).forEach(ev => {
              try { window.dispatchEvent(new Event(ev)) } catch (e) { /* ignore */ }
            })
          }
        } catch (e) {
          // Non-fatal
          console.debug('apiClient dispatch error', e)
        }

        return data;
      } catch (err) {
        attempt += 1;
        // If aborted due to controller or last attempt, rethrow
        const isAbort = err && (err.name === 'AbortError' || err.message && err.message.includes('aborted'));
        if (attempt > retry || isAbort && attempt > retry) {
          throw err;
        }
        // wait with exponential backoff
        const delay = Math.max(0, retryDelay * Math.pow(2, attempt - 1));
        await new Promise(r => setTimeout(r, delay));
        // continue to next attempt
      } finally {
        inFlight.delete(key);
      }
    }
  })();

  inFlight.set(key, p);
  return p;
}

export default {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body, opts = {}) => request('POST', url, Object.assign({}, opts, { body })),
  put: (url, body, opts = {}) => request('PUT', url, Object.assign({}, opts, { body })),
  patch: (url, body, opts = {}) => request('PATCH', url, Object.assign({}, opts, { body })),
  del: (url, opts) => request('DELETE', url, opts),
};

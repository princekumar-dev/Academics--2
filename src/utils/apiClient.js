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

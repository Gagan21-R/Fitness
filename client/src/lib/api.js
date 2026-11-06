const TOKEN_KEY = 'fc_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session simply lasts until the page closes.
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message, { status, code, fields } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

function toQuery(params) {
  const clean = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
}

const RETRIES = 4;
const RETRY_DELAY_MS = 1500;
const UNREACHABLE = 'The server is not responding. It may be restarting, so wait a few seconds and try again. If this keeps happening, check that "npm run dev" is still running.';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches, retrying while the API can't be reached at all. That happens for a few seconds
 * whenever the dev server restarts. Such a request never reached the API, so retrying it
 * can't apply anything twice.
 */
async function fetchWithRetry(url, options) {
  for (let attempt = 0; ; attempt += 1) {
    let res = null;
    let data = null;
    try {
      res = await fetch(url, options);
    } catch {
      // Network error: the request didn't get through.
    }
    if (res && res.status !== 204) data = await res.clone().json().catch(() => null);
    // A 5xx without our error body (or the dev proxy's SERVER_UNAVAILABLE) means the API wasn't reached.
    const unreachable =
      !res || data?.error?.code === 'SERVER_UNAVAILABLE' || (res.status >= 500 && !data?.error);
    if (!unreachable) return { res, data };
    if (attempt >= RETRIES) throw new ApiError(UNREACHABLE, { status: res?.status ?? 0, code: 'SERVER_UNAVAILABLE' });
    await wait(RETRY_DELAY_MS);
  }
}

async function send(path, { method = 'GET', body, params, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const { res, data } = await fetchWithRetry(`/api${path}${toQuery(params)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.ok && raw) return res;
  if (res.status === 204) return null;
  if (res.ok) return data;

  const err = data?.error || {};
  if (res.status === 401 && err.code === 'UNAUTHENTICATED') onUnauthorized();
  throw new ApiError(err.message || 'Something went wrong.', {
    status: res.status,
    code: err.code,
    fields: err.fields,
  });
}

export const api = {
  get: (path, params) => send(path, { params }),
  post: (path, body, params) => send(path, { method: 'POST', body, params }),
  put: (path, body) => send(path, { method: 'PUT', body }),
  patch: (path, body, params) => send(path, { method: 'PATCH', body, params }),
  delete: (path) => send(path, { method: 'DELETE' }),
  download: async (path, params, filename) => {
    const res = await send(path, { params, raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

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

async function send(path, { method = 'GET', body, params, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}${toQuery(params)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check that it is running.', { status: 0, code: 'NETWORK' });
  }

  if (res.ok && raw) return res;
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
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

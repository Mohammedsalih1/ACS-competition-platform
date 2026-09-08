// Points at the local backend by default; override with VITE_API_URL per
// environment (see .env.example). Must stay in sync with the backend's
// API_PREFIX and CORS_ORIGINS.
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

// Access token is kept in memory only; never persisted to storage.
let accessToken = null;
// Single-flight: shares one in-flight refresh across concurrent 401s.
let refreshPromise = null;

export const setAccessToken = (token) => { accessToken = token; };
export const clearAccessToken = () => { accessToken = null; };

// Refresh the access token via an httpOnly cookie. Concurrent callers
// reuse the same in-flight request (single-flight pattern).
async function refreshTokens() {
  refreshPromise ??= fetch(`${API}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw body.error;
      accessToken = body.data.accessToken;
      return body.data;
    })
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}

export async function api(path, options = {}) {
  // FormData must set its own Content-Type: the multipart boundary is generated
  // by the browser, and overriding the header leaves the server unable to parse
  // the body (multer sees no file at all).
  const isFormData = options.body instanceof FormData;

  const send = () =>
    fetch(API + path, {
      ...options,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

  let response = await send();
  let body = response.status === 204 ? null : await response.json();

  // On an expired token, refresh once and retry the original request.
  if (response.status === 401 && body?.error?.code === 'TOKEN_EXPIRED') {
    try {
      await refreshTokens();
      response = await send();
      body = response.status === 204 ? null : await response.json();
    } catch {
      accessToken = null;
      window.location.assign('/login');
      throw new Error('Session expired');
    }
  }

  // Any other 401 (e.g. missing/invalid credentials) → send user to login.
  if (response.status === 401) {
    accessToken = null;
    window.location.assign('/login');
    throw Object.assign(new Error(body.error.message), body.error);
  }

  if (!response.ok) throw Object.assign(new Error(body.error.message), body.error);
  return body.data;
}

export { refreshTokens };

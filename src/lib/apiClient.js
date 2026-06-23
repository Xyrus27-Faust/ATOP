// Thin fetch wrapper around the ATOP backend API.
//
// Responsibilities:
//   - prefix requests with VITE_API_BASE_URL
//   - JSON encode/decode
//   - attach the Bearer access token for authed requests
//   - normalise ASP.NET ProblemDetails errors into a usable ApiError
//   - on 401, transparently refresh the access token ONCE and retry
//
// Refresh is single-flight (one in-flight /auth/refresh at a time) because the
// backend rotates refresh tokens with reuse detection — two concurrent
// refreshes would replay a revoked token and revoke every session.

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './tokenStorage'

const BASE = import.meta.env.VITE_API_BASE_URL

if (!BASE) {
  // Fail loudly in dev rather than firing requests at the Vite origin.
  console.error('VITE_API_BASE_URL is not set. Create a .env with VITE_API_BASE_URL=http://localhost:5134')
}

/** Error carrying the parsed ProblemDetails so the UI can render it. */
export class ApiError extends Error {
  constructor({ status, message, fieldErrors, raw }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.message = message
    this.fieldErrors = fieldErrors || null // { fieldName: [msg, ...] }
    this.raw = raw
  }
}

/** Thrown when the session can no longer be refreshed; listeners route to /login. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.')
    this.name = 'SessionExpiredError'
  }
}

// --- session-expiry notification (AuthContext subscribes) ---
const sessionExpiredListeners = new Set()
export function onSessionExpired(cb) {
  sessionExpiredListeners.add(cb)
  return () => sessionExpiredListeners.delete(cb)
}
function notifySessionExpired() {
  for (const cb of sessionExpiredListeners) cb()
}

async function parseBody(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toApiError(status, body) {
  // ProblemDetails: { type, title, status, errors?: { field: [msgs] } }
  if (body && typeof body === 'object') {
    const fieldErrors = body.errors && typeof body.errors === 'object' ? body.errors : null
    const message =
      body.title ||
      body.detail ||
      body.message ||
      'Something went wrong. Please try again.'
    return new ApiError({ status, message, fieldErrors, raw: body })
  }
  return new ApiError({
    status,
    message: typeof body === 'string' && body ? body : 'Something went wrong. Please try again.',
    raw: body,
  })
}

async function rawRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const parsed = await parseBody(res)
  if (!res.ok) throw toApiError(res.status, parsed)
  return parsed
}

// --- single-flight refresh ---
let refreshPromise = null

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new SessionExpiredError()
    // No Bearer header, no auto-retry — this call must never recurse.
    const tokens = await rawRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    })
    setTokens(tokens) // persist the rotated tokens immediately
    return tokens.accessToken
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/**
 * Make a request. With { auth: true } it attaches the Bearer token and, on a
 * 401, refreshes once and retries. A failed refresh clears the session and
 * notifies listeners.
 */
async function request(path, { method = 'GET', body, auth = false } = {}) {
  if (!auth) return rawRequest(path, { method, body })

  try {
    return await rawRequest(path, { method, body, token: getAccessToken() })
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err
    // Access token likely expired — refresh once and retry.
    try {
      const newAccess = await refreshAccessToken()
      return await rawRequest(path, { method, body, token: newAccess })
    } catch {
      clearTokens()
      notifySessionExpired()
      throw new SessionExpiredError()
    }
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
}

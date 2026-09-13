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

    // When `errors` is present the payload is a ValidationProblemDetails, and its
    // `title` is always ASP.NET's placeholder — "One or more validation errors
    // occurred." The sentence a person actually needs is down in `errors`, and
    // reading the title instead threw it away: a delegation refused at checkout
    // because the convention was full was told "One or more validation errors
    // occurred." and nothing else, while "The convention is fully booked. No
    // further seats can be confirmed." sat unread in the body.
    //
    // Keyed on the presence of `errors` rather than on matching that English
    // string, which is a server-side detail we do not control.
    const detailed = fieldErrors ? Object.values(fieldErrors).flat().filter(Boolean) : []

    const message =
      detailed.length > 0
        ? detailed.join(' ')
        : body.title ||
          body.detail ||
          body.message ||
          'Something went wrong. Please try again.'

    // `fieldErrors` is left intact: forms still render each message against its
    // own field, and only fall back to `message` when they have nowhere to put it.
    return new ApiError({ status, message, fieldErrors, raw: body })
  }
  return new ApiError({
    status,
    message: typeof body === 'string' && body ? body : 'Something went wrong. Please try again.',
    raw: body,
  })
}

// A bare fetch() waits forever. On the venue wifi and on provincial mobile data
// it regularly does: the connection stalls, no response and no error ever
// arrives, and every `finally` waiting on it never runs. That is what left the
// tour picker on its spinner permanently and the shirt-size select greyed out
// after a delegate had chosen a size — the request was still "in flight" an hour
// later. A request that cannot finish has to fail so the UI can say so.
const REQUEST_TIMEOUT_MS = 20_000

/** status 0 — the request never reached the server, so there is no HTTP status to report. */
const NO_RESPONSE = 0

async function rawRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    // Reaching the server and being refused is an ApiError with a status; never
    // reaching it is this. Both are ApiError so callers keep one catch, and the
    // status tells them apart — the refresh path below depends on that.
    throw new ApiError({
      status: NO_RESPONSE,
      message:
        cause?.name === 'TimeoutError'
          ? 'The server took too long to answer. Check your connection and try again.'
          : 'Could not reach the server. Check your connection and try again.',
      raw: cause,
    })
  }

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
    } catch (refreshErr) {
      // A refresh that never reached the server says nothing about the session.
      // Now that a stalled request fails instead of hanging, treating that as
      // expiry would sign people out for a tunnel or a dropped bar of signal —
      // and take their rotated refresh token with it. Only the server rejecting
      // the token ends a session; a network failure is just a network failure.
      if (refreshErr instanceof ApiError && refreshErr.status === NO_RESPONSE) throw refreshErr

      clearTokens()
      notifySessionExpired()
      throw new SessionExpiredError()
    }
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}

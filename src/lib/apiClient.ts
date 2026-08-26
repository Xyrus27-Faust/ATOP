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
// backend rotates refresh tokens with reuse detection - two concurrent
// refreshes would replay a revoked token and revoke every session.

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './tokenStorage'
import type { TokenSet } from '@/types'

const BASE = import.meta.env.VITE_API_BASE_URL as string

if (!BASE) {
  // Fail loudly in dev rather than firing requests at the Vite origin.
  console.error('VITE_API_BASE_URL is not set. Create a .env with VITE_API_BASE_URL=http://localhost:5134')
}

/** Error carrying the parsed ProblemDetails so the UI can render it. */
export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string[]> | null
  raw: unknown

  constructor({ status, message, fieldErrors, raw }: { status: number; message: string; fieldErrors?: Record<string, string[]> | null; raw?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.message = message
    this.fieldErrors = fieldErrors || null
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
const sessionExpiredListeners = new Set<() => void>()
export function onSessionExpired(cb: () => void): () => void {
  sessionExpiredListeners.add(cb)
  return () => sessionExpiredListeners.delete(cb)
}
function notifySessionExpired(): void {
  for (const cb of sessionExpiredListeners) cb()
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toApiError(status: number, body: unknown): ApiError {
  // ProblemDetails: { type, title, status, errors?: { field: [msgs] } }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    const fieldErrors =
      b.errors && typeof b.errors === 'object'
        ? (b.errors as Record<string, string[]>)
        : null
    const message =
      (b.title as string) ||
      (b.detail as string) ||
      (b.message as string) ||
      'Something went wrong. Please try again.'
    return new ApiError({ status, message, fieldErrors, raw: body })
  }
  return new ApiError({
    status,
    message: typeof body === 'string' && body ? body : 'Something went wrong. Please try again.',
    raw: body,
  })
}

interface RawRequestOptions {
  method?: string
  body?: unknown
  token?: string | null
}

async function rawRequest<T = any>(path: string, { method = 'GET', body, token }: RawRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const parsed = await parseBody(res)
  if (!res.ok) throw toApiError(res.status, parsed)
  return parsed as T
}

// --- single-flight refresh ---
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new SessionExpiredError()
    // No Bearer header, no auto-retry - this call must never recurse.
    const tokens = await rawRequest<TokenSet>('/auth/refresh', {
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

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
}

/**
 * Make a request. With { auth: true } it attaches the Bearer token and, on a
 * 401, refreshes once and retries. A failed refresh clears the session and
 * notifies listeners.
 */
async function request<T = any>(path: string, { method = 'GET', body, auth = false }: RequestOptions = {}): Promise<T> {
  if (!auth) return rawRequest<T>(path, { method, body })

  try {
    return await rawRequest<T>(path, { method, body, token: getAccessToken() })
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err
    // Access token likely expired - refresh once and retry.
    try {
      const newAccess = await refreshAccessToken()
      return await rawRequest<T>(path, { method, body, token: newAccess })
    } catch {
      clearTokens()
      notifySessionExpired()
      throw new SessionExpiredError()
    }
  }
}

export const api = {
  get: <T = any>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T = any>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T = any>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T = any>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
}


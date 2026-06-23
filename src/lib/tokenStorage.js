// Single source of truth for persisting the auth session in localStorage.
//
// The backend rotates refresh tokens on every /auth/refresh and has reuse
// detection: replaying a revoked refresh token revokes ALL of the user's
// sessions. So we always write the three values together and never hold an
// old refresh token anywhere but here.

const KEYS = {
  access: 'atop.accessToken',
  refresh: 'atop.refreshToken',
  expiresAt: 'atop.accessTokenExpiresAt',
}

/** @returns {{ accessToken: string|null, refreshToken: string|null, accessTokenExpiresAt: string|null }} */
export function getTokens() {
  return {
    accessToken: localStorage.getItem(KEYS.access),
    refreshToken: localStorage.getItem(KEYS.refresh),
    accessTokenExpiresAt: localStorage.getItem(KEYS.expiresAt),
  }
}

export function getAccessToken() {
  return localStorage.getItem(KEYS.access)
}

export function getRefreshToken() {
  return localStorage.getItem(KEYS.refresh)
}

export function getExpiresAt() {
  return localStorage.getItem(KEYS.expiresAt)
}

/**
 * Persist a fresh token set atomically. Accepts the shape returned by
 * /auth/login, /auth/google and /auth/refresh.
 */
export function setTokens({ accessToken, refreshToken, accessTokenExpiresAt }) {
  if (accessToken) localStorage.setItem(KEYS.access, accessToken)
  if (refreshToken) localStorage.setItem(KEYS.refresh, refreshToken)
  if (accessTokenExpiresAt) localStorage.setItem(KEYS.expiresAt, accessTokenExpiresAt)
}

export function clearTokens() {
  localStorage.removeItem(KEYS.access)
  localStorage.removeItem(KEYS.refresh)
  localStorage.removeItem(KEYS.expiresAt)
}

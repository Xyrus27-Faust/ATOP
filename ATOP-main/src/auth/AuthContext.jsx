import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, onSessionExpired } from '@/lib/apiClient'
import {
  getRefreshToken,
  setTokens,
  clearTokens,
} from '@/lib/tokenStorage'

const AuthContext = createContext(null)

/**
 * Holds the signed-in user and exposes the auth operations the pages call.
 *
 * status: 'loading'        — bootstrapping the session on first paint
 *         'authenticated'  — user is present
 *         'unauthenticated'— no valid session
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const navigate = useNavigate()
  const bootstrapped = useRef(false)

  // Restore the session on load. If a refresh token is stored, fetch the
  // profile (the api client refreshes the access token automatically on 401).
  useEffect(() => {
    if (bootstrapped.current) return // guard StrictMode's double-invoke
    bootstrapped.current = true

    async function bootstrap() {
      if (!getRefreshToken()) {
        setStatus('unauthenticated')
        return
      }
      try {
        const me = await api.get('/auth/me', { auth: true })
        setUser(me)
        setStatus('authenticated')
      } catch {
        clearTokens()
        setUser(null)
        setStatus('unauthenticated')
      }
    }
    bootstrap()
  }, [])

  // If the api client can't refresh, drop the user and send them to sign in.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null)
        setStatus('unauthenticated')
        navigate('/login', { replace: true })
      }),
    [navigate],
  )

  async function login(email, password) {
    const tokens = await api.post('/auth/login', { email, password })
    setTokens(tokens)
    const me = await api.get('/auth/me', { auth: true })
    setUser(me)
    setStatus('authenticated')
    return me
  }

  // Exchange a Google ID token (from Google Identity Services) for our own
  // session. The backend validates the token's audience server-side and
  // provisions/links the account; a Google account is already email-verified,
  // so this signs the user straight in.
  async function googleSignIn(idToken) {
    const tokens = await api.post('/auth/google', { idToken })
    setTokens(tokens)
    const me = await api.get('/auth/me', { auth: true })
    setUser(me)
    setStatus('authenticated')
    return me
  }

  function register({ email, password, firstName, lastName }) {
    return api.post('/auth/register', { email, password, firstName, lastName })
  }

  // Update the signed-in user's profile and keep the cached user in sync.
  async function updateProfile({ firstName, lastName, designation, office }) {
    const me = await api.put('/auth/me', { firstName, lastName, designation, office }, { auth: true })
    setUser(me)
    return me
  }

  function verifyEmail(userId, token) {
    return api.post('/auth/verify-email', { userId, token })
  }

  function resendVerification(email) {
    return api.post('/auth/resend-verification', { email })
  }

  async function logout() {
    try {
      await api.post('/auth/logout', { refreshToken: getRefreshToken() })
    } catch {
      // best-effort; clear locally regardless
    } finally {
      clearTokens()
      setUser(null)
      setStatus('unauthenticated')
      navigate('/', { replace: true })
    }
  }

  const value = {
    user,
    status,
    login,
    googleSignIn,
    register,
    updateProfile,
    verifyEmail,
    resendVerification,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

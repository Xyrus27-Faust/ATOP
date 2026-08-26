import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, onSessionExpired } from '@/lib/apiClient'
import {
  getRefreshToken,
  setTokens,
  clearTokens,
} from '@/lib/tokenStorage'
import type { User, TokenSet } from '@/types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<User>
  googleSignIn: (idToken: string) => Promise<User>
  register: (params: { email: string; password: string; firstName: string; lastName: string }) => Promise<unknown>
  updateProfile: (params: { firstName: string; lastName: string; designation?: string; office?: string }) => Promise<User>
  verifyEmail: (userId: string, token: string) => Promise<unknown>
  resendVerification: (email: string) => Promise<unknown>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Holds the signed-in user and exposes the auth operations the pages call.
 *
 * status: 'loading'        - bootstrapping the session on first paint
 *         'authenticated'  - user is present
 *         'unauthenticated'- no valid session
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
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
        const me = await api.get<User>('/auth/me', { auth: true })
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

  async function login(email: string, password: string): Promise<User> {
    const tokens = await api.post<TokenSet>('/auth/login', { email, password })
    setTokens(tokens)
    const me = await api.get<User>('/auth/me', { auth: true })
    setUser(me)
    setStatus('authenticated')
    return me
  }

  // Exchange a Google ID token (from Google Identity Services) for our own
  // session. The backend validates the token's audience server-side and
  // provisions/links the account; a Google account is already email-verified,
  // so this signs the user straight in.
  async function googleSignIn(idToken: string): Promise<User> {
    const tokens = await api.post<TokenSet>('/auth/google', { idToken })
    setTokens(tokens)
    const me = await api.get<User>('/auth/me', { auth: true })
    setUser(me)
    setStatus('authenticated')
    return me
  }

  function register({ email, password, firstName, lastName }: { email: string; password: string; firstName: string; lastName: string }): Promise<unknown> {
    return api.post('/auth/register', { email, password, firstName, lastName })
  }

  // Update the signed-in user's profile and keep the cached user in sync.
  async function updateProfile({ firstName, lastName, designation, office }: { firstName: string; lastName: string; designation?: string; office?: string }): Promise<User> {
    const me = await api.put<User>('/auth/me', { firstName, lastName, designation, office }, { auth: true })
    setUser(me)
    return me
  }

  function verifyEmail(userId: string, token: string): Promise<unknown> {
    return api.post('/auth/verify-email', { userId, token })
  }

  function resendVerification(email: string): Promise<unknown> {
    return api.post('/auth/resend-verification', { email })
  }

  async function logout(): Promise<void> {
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

  const value: AuthContextValue = {
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
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

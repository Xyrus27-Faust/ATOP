import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

// A phone left on a table signs itself out. 30 minutes idle is the NIST 800-63B / OWASP ASVS L2
// figure for a session that can see personal data; signing out also revokes the session on the
// server, so a token copied off the phone dies with it. A scan, a tap or a keypress is activity.
const IDLE_SIGN_OUT_MS = 30 * 60 * 1000
const ACTIVITY = ['pointerdown', 'keydown']

/**
 * Sign a shared venue phone (the marshal's scanner, the Secretariat desk) out after it sits idle.
 * Returns { signOut, touch }: call touch() for activity that isn't a tap or a key — a badge read by
 * the camera touches nothing.
 *
 * <p>Time is checked against the last activity rather than with a single timer: a phone in a pocket
 * throttles timers, and coming back to the screen must not count as activity.</p>
 */
export function useIdleSignOut() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const lastActivity = useRef(0)

  const signOut = useCallback(async () => {
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const touch = useCallback(() => { lastActivity.current = Date.now() }, [])

  useEffect(() => {
    touch()
    const check = () => {
      if (Date.now() - lastActivity.current >= IDLE_SIGN_OUT_MS) signOut()
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') check() }
    ACTIVITY.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
    const timer = setInterval(check, 30_000)
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, touch))
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    }
  }, [signOut, touch])

  return { signOut, touch }
}

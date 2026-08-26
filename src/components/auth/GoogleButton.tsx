import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const CONFIGURED = CLIENT_ID.trim() !== '' && !/YOUR_GOOGLE_CLIENT_ID/i.test(CLIENT_ID)

// Load Google Identity Services once, shared across mounts.
let gisPromise = null
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Could not reach Google. Check your connection and try again.'))
    document.head.appendChild(s)
  })
  return gisPromise
}

/**
 * Renders the official Google sign-in button. On success it exchanges the
 * Google ID token for our session via AuthContext.googleSignIn, then calls
 * onSuccess. Falls back to a setup note when VITE_GOOGLE_CLIENT_ID is unset.
 *
 * Props: onSuccess(user), onError(err), text ('continue_with' | 'signin_with' | 'signup_with')
 */
export default function GoogleButton({ onSuccess, onError, text = 'continue_with' }) {
  const { googleSignIn } = useAuth()
  const containerRef = useRef(null)
  const handlers = useRef({ googleSignIn, onSuccess, onError })
  const [pending, setPending] = useState(false)

  // Keep the latest callbacks reachable from the one-time GIS init below.
  useEffect(() => {
    handlers.current = { googleSignIn, onSuccess, onError }
  }, [googleSignIn, onSuccess, onError])

  useEffect(() => {
    if (!CONFIGURED) return
    let cancelled = false

    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setPending(true)
            try {
              const me = await handlers.current.googleSignIn(credential)
              handlers.current.onSuccess?.(me)
            } catch (err) {
              handlers.current.onError?.(err)
            } finally {
              setPending(false)
            }
          },
        })
        const width = Math.min(Math.max(containerRef.current.offsetWidth || 360, 200), 400)
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
          width,
        })
      })
      .catch((err) => handlers.current.onError?.(err))

    return () => { cancelled = true }
    // Init once; latest callbacks are read through the handlers ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CONFIGURED) {
    return (
      <div className="auth-google-setup">
        <i className="fab fa-google" aria-hidden="true" />
        <div>
          <strong>Google sign-in isn’t configured</strong>
          <p>Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env.local</code> to enable it.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-google" aria-busy={pending}>
      <div ref={containerRef} className="auth-google-btn" />
      {pending && (
        <div className="auth-google-pending">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Signing you in…
        </div>
      )}
    </div>
  )
}

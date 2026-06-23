import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import AuthField from './AuthField'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/apiClient'
import { validateEmail } from '@/lib/validation'

const VERIFY_BRAND = {
  eyebrow: 'Account Verification',
  brandTitle: 'Almost there.',
  brandText:
    'Confirming your email keeps ATOP member accounts secure. This only takes a moment.',
}

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const { verifyEmail, resendVerification } = useAuth()
  const userId = params.get('userId')
  const token = params.get('token')

  const [state, setState] = useState(userId && token ? 'verifying' : 'missing')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  // Resend sub-form (shown on failure)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (state !== 'verifying' || ran.current) return
    ran.current = true // guard StrictMode's double-invoke

    verifyEmail(userId, token)
      .then((res) => {
        setState('success')
        setMessage(res?.message || 'Your email is verified. You can now sign in.')
      })
      .catch((err) => {
        setState('error')
        setMessage(
          err instanceof ApiError
            ? err.message
            : 'We couldn’t verify this link. It may have expired.',
        )
      })
  }, [state, userId, token, verifyEmail])

  async function handleResend(e) {
    e.preventDefault()
    const error = validateEmail(email)
    setEmailError(error)
    if (error) return
    setResending(true)
    try {
      await resendVerification(email.trim())
    } finally {
      setResending(false)
      setResent(true)
    }
  }

  return (
    <AuthLayout
      {...VERIFY_BRAND}
      title="Email verification"
      subtitle={
        state === 'success'
          ? 'Your account is ready.'
          : 'Confirming your ATOP account.'
      }
      footer={
        <>
          Back to <Link to="/login">sign in</Link>
        </>
      }
    >
      {state === 'verifying' && (
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--info">
            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          </div>
          <h2>Verifying…</h2>
          <p>Hang tight while we confirm your email address.</p>
        </div>
      )}

      {state === 'success' && (
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--success">
            <i className="fas fa-circle-check" aria-hidden="true" />
          </div>
          <h2>Email verified</h2>
          <p>{message}</p>
          <Link to="/login" className="btn-gold auth-submit" style={{ display: 'inline-flex' }}>
            Continue to sign in
          </Link>
        </div>
      )}

      {(state === 'error' || state === 'missing') && (
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--error">
            <i className="fas fa-link-slash" aria-hidden="true" />
          </div>
          <h2>{state === 'missing' ? 'Invalid link' : 'Verification failed'}</h2>
          <p>
            {state === 'missing'
              ? 'This verification link is missing information. Request a fresh one below.'
              : message}
          </p>

          {resent ? (
            <div className="auth-banner auth-banner--success" role="status" style={{ marginTop: 22, textAlign: 'left' }}>
              <i className="fas fa-paper-plane" aria-hidden="true" />
              <span>If that email needs verifying, a new link is on its way.</span>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleResend} noValidate style={{ marginTop: 24, textAlign: 'left' }}>
              <AuthField
                id="resend-email"
                label="Resend verification to"
                type="email"
                icon="fas fa-envelope"
                placeholder="you@lgu.gov.ph"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={emailError}
              />
              <button type="submit" className="btn-gold auth-submit" disabled={resending}>
                {resending ? (
                  <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Sending…
                  </>
                ) : (
                  'Resend verification link'
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </AuthLayout>
  )
}

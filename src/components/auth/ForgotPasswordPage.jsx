import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import AuthField from './AuthField'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/apiClient'
import { validateEmail } from '@/lib/validation'

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const location = useLocation()

  // The sign-in page hands over whatever email was already typed.
  const [email, setEmail] = useState(location.state?.email || '')
  const [error, setError] = useState(null)
  const [banner, setBanner] = useState(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBanner(null)
    const err = validateEmail(email)
    setError(err)
    if (err) return

    setSubmitting(true)
    try {
      await forgotPassword(email.trim())
      // The backend answers the same whether or not the email is registered.
      setSent(true)
    } catch (err) {
      setBanner(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts. Please wait a moment and try again.'
          : err instanceof ApiError
            ? err.message
            : 'We couldn’t reach the server. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Account Recovery"
      brandTitle="Locked out? It happens."
      brandText="We’ll email you a link to choose a new password. It can be used once, and it expires in 24 hours."
      title="Forgot password"
      subtitle={sent ? 'Check your inbox.' : 'Enter the email you signed up with.'}
      footer={
        <>
          Remembered it? <Link to="/login">Back to sign in</Link>
        </>
      }
    >
      {sent ? (
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--success">
            <i className="fas fa-paper-plane" aria-hidden="true" />
          </div>
          <h2>Check your email</h2>
          <p>
            If <strong>{email.trim()}</strong> is registered, a link to reset your password is on its way. It can take a
            few minutes — check your spam folder too.
          </p>
          <p style={{ marginTop: 12 }}>
            Signed up with Google? You can keep using the Google button, or use this link to set a password as well.
          </p>
          <button type="button" className="auth-link" style={{ marginTop: 18 }} onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {banner && (
            <div className="auth-banner auth-banner--error" role="alert">
              <i className="fas fa-circle-exclamation" aria-hidden="true" />
              <span>{banner}</span>
            </div>
          )}

          <AuthField
            id="email"
            label="Email"
            type="email"
            icon="fas fa-envelope"
            placeholder="you@lgu.gov.ph"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email && setError(validateEmail(email))}
            error={error}
          />

          <button type="submit" className="btn-gold auth-submit" disabled={submitting}>
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import AuthField from './AuthField'
import GoogleButton from './GoogleButton'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/apiClient'
import { canAccessPath, roleHome } from '@/dashboard/dashboardNav'
import { validateEmail, validateRequired } from '@/lib/validation'

export default function LoginPage() {
  const { login, resendVerification } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Land the user where their role belongs. Honor a remembered deep link (`from`,
  // set by ProtectedRoute) only when this role may actually view it — otherwise a
  // stale link would drop, say, a reviewer on the applicant "My Entries" page.
  function landAfterLogin(roles) {
    const from = location.state?.from?.pathname
    const target = from && canAccessPath(from, roles) ? from : roleHome(roles)
    navigate(target, { replace: true })
  }

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null) // { kind, message, canResend? }
  const [resent, setResent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function validate() {
    const next = {
      email: validateEmail(form.email),
      password: validateRequired(form.password, 'password'),
    }
    setErrors(next)
    return !next.email && !next.password
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBanner(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const me = await login(form.email.trim(), form.password)
      landAfterLogin(me?.roles)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setBanner({ kind: 'unverified', message: err.message })
      } else if (err instanceof ApiError && err.status === 401) {
        setBanner({ kind: 'error', message: 'Invalid email or password.' })
      } else if (err instanceof ApiError && err.status === 429) {
        setBanner({ kind: 'error', message: 'Too many attempts. Please wait a moment and try again.' })
      } else {
        setBanner({
          kind: 'error',
          message: err instanceof ApiError ? err.message : 'We couldn’t reach the server. Please try again.',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    try {
      await resendVerification(form.email.trim())
    } finally {
      // Backend returns a generic message either way; always confirm.
      setResent(true)
    }
  }

  return (
    <AuthLayout
      eyebrow="Member Portal"
      brandTitle="The national network of tourism officers."
      brandText="Sign in to your ATOP member portal — resources, capacity-building, and the people building better Philippine destinations."
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          New to ATOP? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {banner?.kind === 'error' && (
          <div className="auth-banner auth-banner--error" role="alert">
            <i className="fas fa-circle-exclamation" aria-hidden="true" />
            <span>{banner.message}</span>
          </div>
        )}

        {banner?.kind === 'unverified' &&
          (resent ? (
            <div className="auth-banner auth-banner--success" role="status">
              <i className="fas fa-paper-plane" aria-hidden="true" />
              <span>If that email is registered and unverified, a new verification link is on its way. Check your inbox.</span>
            </div>
          ) : (
            <div className="auth-banner auth-banner--info" role="alert">
              <i className="fas fa-envelope-circle-check" aria-hidden="true" />
              <span>
                Your email isn’t verified yet. Check your inbox for the verification link, or{' '}
                <button type="button" className="auth-link" onClick={handleResend}>
                  resend it
                </button>
                .
              </span>
            </div>
          ))}

        <AuthField
          id="email"
          label="Email"
          type="email"
          icon="fas fa-envelope"
          placeholder="you@lgu.gov.ph"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(form.email) }))}
          error={errors.email}
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          icon="fas fa-lock"
          placeholder="Your password"
          autoComplete="current-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
        />

        <button type="submit" className="btn-gold auth-submit" disabled={submitting}>
          {submitting ? (
            <>
              <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="auth-divider">or</div>
      <GoogleButton
        text="signin_with"
        onSuccess={(me) => landAfterLogin(me?.roles)}
        onError={(err) =>
          setBanner({
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'Google sign-in didn’t work. Please try again.',
          })
        }
      />
    </AuthLayout>
  )
}

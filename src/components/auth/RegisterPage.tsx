import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import AuthField from './AuthField'
import GoogleButton from './GoogleButton'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/apiClient'
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateRequired,
  PASSWORD_HINT,
} from '@/lib/validation'

// Map a known backend field name to one of our inputs.
const FIELD_MAP = {
  email: 'email',
  password: 'password',
  firstname: 'firstName',
  lastname: 'lastName',
}

const REGISTER_BRAND = {
  eyebrow: 'Join ATOP',
  brandTitle: 'Help shape the future of Philippine destinations.',
  brandText:
    'Create your member account to reach ATOP resources, capacity-building programs, the Pearl Awards, and a national network of tourism officers.',
}

export default function RegisterPage() {
  const { register, resendVerification } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null) // { email, message } once registered
  const [resent, setResent] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function validate() {
    const next = {
      firstName: validateRequired(form.firstName, 'first name'),
      lastName: validateRequired(form.lastName, 'last name'),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: validatePasswordConfirm(form.password, form.confirm),
    }
    setErrors(next)
    return Object.values(next).every((v) => !v)
  }

  function applyServerErrors(fieldErrors) {
    const next = {}
    const leftovers = []
    for (const [key, messages] of Object.entries(fieldErrors)) {
      const mapped = FIELD_MAP[key.toLowerCase()]
      if (mapped) next[mapped] = messages[0]
      else leftovers.push(...messages)
    }
    setErrors((prev) => ({ ...prev, ...next }))
    if (leftovers.length) setBanner({ kind: 'error', message: leftovers.join(' ') })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBanner(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      const res = await register({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      })
      setDone({ email: form.email.trim(), message: res?.message })
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        applyServerErrors(err.fieldErrors)
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
      await resendVerification(done.email)
    } finally {
      setResent(true)
    }
  }

  // ---- Success state: check your inbox ----
  if (done) {
    return (
      <AuthLayout
        {...REGISTER_BRAND}
        title="Check your inbox"
        subtitle="One quick step before you sign in."
        footer={
          <>
            Already verified? <Link to="/login">Sign in</Link>
          </>
        }
      >
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--info">
            <i className="fas fa-envelope-open-text" aria-hidden="true" />
          </div>
          <h2>Verify your email</h2>
          <p>
            We’ve sent a verification link to <strong>{done.email}</strong>. Open it to activate your
            account, then sign in.
          </p>
          {resent ? (
            <div className="auth-banner auth-banner--success" role="status" style={{ marginTop: 20 }}>
              <i className="fas fa-paper-plane" aria-hidden="true" />
              <span>A new link is on its way if your account still needs verifying.</span>
            </div>
          ) : (
            <p className="auth-hint" style={{ marginTop: 16 }}>
              Didn’t get it?{' '}
              <button type="button" className="auth-link" onClick={handleResend}>
                Resend the link
              </button>
            </p>
          )}
        </div>
      </AuthLayout>
    )
  }

  // ---- Registration form ----
  return (
    <AuthLayout
      {...REGISTER_BRAND}
      title="Create your account"
      subtitle="Join the national network of tourism officers."
      footer={
        <>
          Already a member? <Link to="/login">Sign in</Link>
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

        <div className="auth-row">
          <AuthField
            id="firstName"
            label="First name"
            icon="fas fa-user"
            placeholder="Juan"
            autoComplete="given-name"
            value={form.firstName}
            onChange={set('firstName')}
            onBlur={() => setErrors((p) => ({ ...p, firstName: validateRequired(form.firstName, 'first name') }))}
            error={errors.firstName}
          />
          <AuthField
            id="lastName"
            label="Last name"
            icon="fas fa-user"
            placeholder="Dela Cruz"
            autoComplete="family-name"
            value={form.lastName}
            onChange={set('lastName')}
            onBlur={() => setErrors((p) => ({ ...p, lastName: validateRequired(form.lastName, 'last name') }))}
            error={errors.lastName}
          />
        </div>

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
          placeholder="Create a password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          onBlur={() => setErrors((p) => ({ ...p, password: validatePassword(form.password) }))}
          error={errors.password}
          hint={errors.password ? undefined : PASSWORD_HINT}
        />

        <AuthField
          id="confirm"
          label="Confirm password"
          type="password"
          icon="fas fa-lock"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set('confirm')}
          onBlur={() => setErrors((p) => ({ ...p, confirm: validatePasswordConfirm(form.password, form.confirm) }))}
          error={errors.confirm}
        />

        <button type="submit" className="btn-gold auth-submit" disabled={submitting}>
          {submitting ? (
            <>
              <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <div className="auth-divider">or</div>
      <GoogleButton
        text="signup_with"
        onSuccess={() => navigate('/dashboard', { replace: true })}
        onError={(err) =>
          setBanner({
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'Google sign-up didn’t work. Please try again.',
          })
        }
      />
    </AuthLayout>
  )
}

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import AuthField from './AuthField'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/apiClient'
import { PASSWORD_HINT, validatePassword, validatePasswordConfirm } from '@/lib/validation'

const RESET_BRAND = {
  eyebrow: 'Account Recovery',
  brandTitle: 'A fresh start.',
  brandText: 'Choose a new password for your ATOP account. Any device still signed in will be signed out.',
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const { resetPassword } = useAuth()
  const userId = params.get('userId')
  const token = params.get('token')

  // 'form' | 'success' | 'expired' (a bad, used or expired link)
  const [state, setState] = useState(userId && token ? 'form' : 'expired')
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setBanner(null)
    const next = {
      password: validatePassword(form.password),
      confirm: validatePasswordConfirm(form.password, form.confirm),
    }
    setErrors(next)
    if (next.password || next.confirm) return

    setSubmitting(true)
    try {
      await resetPassword(userId, token, form.password)
      setState('success')
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.newPassword) {
        setErrors({ password: err.fieldErrors.newPassword.join(' ') })
      } else if (err instanceof ApiError && err.status === 400) {
        setState('expired')
      } else if (err instanceof ApiError && err.status === 429) {
        setBanner('Too many attempts. Please wait a moment and try again.')
      } else {
        setBanner(err instanceof ApiError ? err.message : 'We couldn’t reach the server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      {...RESET_BRAND}
      title="Reset password"
      subtitle={state === 'success' ? 'All set.' : 'Choose a new password.'}
      footer={
        <>
          Back to <Link to="/login">sign in</Link>
        </>
      }
    >
      {state === 'form' && (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {banner && (
            <div className="auth-banner auth-banner--error" role="alert">
              <i className="fas fa-circle-exclamation" aria-hidden="true" />
              <span>{banner}</span>
            </div>
          )}

          <AuthField
            id="password"
            label="New password"
            type="password"
            icon="fas fa-lock"
            placeholder="Create a password"
            autoComplete="new-password"
            autoFocus
            value={form.password}
            onChange={set('password')}
            onBlur={() => form.password && setErrors((p) => ({ ...p, password: validatePassword(form.password) }))}
            error={errors.password}
            hint={errors.password ? undefined : PASSWORD_HINT}
          />

          <AuthField
            id="confirm"
            label="Confirm new password"
            type="password"
            icon="fas fa-lock"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            onBlur={() =>
              form.confirm && setErrors((p) => ({ ...p, confirm: validatePasswordConfirm(form.password, form.confirm) }))
            }
            error={errors.confirm}
          />

          <button type="submit" className="btn-gold auth-submit" disabled={submitting}>
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…
              </>
            ) : (
              'Set new password'
            )}
          </button>
        </form>
      )}

      {state === 'success' && (
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--success">
            <i className="fas fa-circle-check" aria-hidden="true" />
          </div>
          <h2>Password reset</h2>
          <p>Your password has been changed. Sign in with your new password.</p>
          <Link to="/login" className="btn-gold auth-submit" style={{ display: 'inline-flex' }}>
            Continue to sign in
          </Link>
        </div>
      )}

      {state === 'expired' && (
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--error">
            <i className="fas fa-link-slash" aria-hidden="true" />
          </div>
          <h2>Link expired</h2>
          <p>This reset link is invalid, has already been used, or has expired. Request a new one.</p>
          <Link to="/forgot-password" className="btn-gold auth-submit" style={{ display: 'inline-flex' }}>
            Request a new link
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}

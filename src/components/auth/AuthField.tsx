import { useState } from 'react'

/**
 * Labeled input matching the auth design system (styles live in AuthLayout).
 * For password fields it renders a show/hide toggle.
 */
export default function AuthField({
  id,
  label,
  type = 'text',
  icon,
  error,
  hint,
  value,
  onChange,
  onBlur,
  ...rest
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && show ? 'text' : type
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>
      <div className="auth-input-wrap">
        {icon && <i className={`auth-lead ${icon}`} aria-hidden="true" />}
        <input
          id={id}
          name={id}
          type={inputType}
          className={`auth-input${error ? ' has-error' : ''}`}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-toggle"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            <i className={show ? 'fas fa-eye-slash' : 'fas fa-eye'} aria-hidden="true" />
          </button>
        )}
      </div>
      {error ? (
        <span className="auth-error" id={errorId}>
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
        </span>
      ) : (
        hint && <span className="auth-hint">{hint}</span>
      )}
    </div>
  )
}

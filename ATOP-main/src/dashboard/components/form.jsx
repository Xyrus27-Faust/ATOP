// Small form primitives shared by the dashboard pages. They lean on the
// `dash-*` classes defined in DashboardLayout, so they only assemble structure
// (label, control slot, error/hint/counter) — no styles of their own.

export function Field({ label, htmlFor, required, error, hint, counter, children }) {
  const showFoot = error || hint || counter
  return (
    <div className="dash-field">
      {label && (
        <label className="dash-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {showFoot && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          {error ? (
            <span className="dash-error">
              <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
            </span>
          ) : hint ? (
            <span className="dash-help">{hint}</span>
          ) : (
            <span />
          )}
          {counter && <span className={`dash-counter${counter.over ? ' is-over' : ''}`}>{counter.text}</span>}
        </div>
      )}
    </div>
  )
}

// Append the error class to a base control class.
// eslint-disable-next-line react-refresh/only-export-components
export const ctl = (base, error) => `${base}${error ? ' has-error' : ''}`

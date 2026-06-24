// Shared loading and error placeholders for dashboard pages.

export function Loading() {
  return (
    <div className="dash-loading" role="status" aria-live="polite">
      <i className="fas fa-spinner fa-spin" aria-hidden="true" />
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Loading</span>
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this' }) {
  const message = error?.message || 'Something went wrong. Please try again.'
  return (
    <div className="dash-card dash-empty">
      <div className="dash-empty-icon" style={{ color: '#B91C1C', background: '#FEF2F2', borderColor: '#FECACA' }}>
        <i className="fas fa-triangle-exclamation" aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="dash-btn" onClick={onRetry}>
          <i className="fas fa-rotate-right" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  )
}

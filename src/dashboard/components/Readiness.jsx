// Submission-readiness meter + requirement checklist — the dashboard's
// signature element. Mirrors the server's ValidateForSubmission so the
// applicant always sees exactly what's left before an entry can be submitted.
export default function Readiness({ readiness, showList = true }) {
  const { items, completed, total, ready } = readiness
  const pct = total ? Math.round((completed / total) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span className="dash-card-title" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {ready ? 'Ready to submit' : `${completed} of ${total} complete`}
        </span>
        <span className="dash-counter">{pct}%</span>
      </div>
      <div className="dash-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`dash-meter-fill${ready ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
      </div>

      {showList && (
        <div className="dash-reqs" style={{ marginTop: 14 }}>
          {items.map((item) => (
            <div key={item.key} className={`dash-req${item.done ? ' is-done' : ''}`}>
              <span className="dash-req-tick">
                <i className={`fas ${item.done ? 'fa-check' : 'fa-minus'}`} aria-hidden="true" />
              </span>
              <span className="dash-req-label">{item.label}</span>
              {item.detail && <span className="dash-req-detail">{item.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

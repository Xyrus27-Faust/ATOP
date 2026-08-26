import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isReviewer } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import CommentThread from '../components/CommentThread'
import EntryDossier from '../components/EntryDossier'
import { useEntryFiles } from '@/lib/entryFiles'
import { statusMeta, formatDate, labelFor, COVERAGE_OPTIONS, EDITABLE_STATUSES } from '@/lib/pearlAwards'

export default function ReviewEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { loading, error, data, reload } = useAsync(async () => {
    const [entry, catalog] = await Promise.all([api.get(`/review/entries/${id}`, { auth: true }), api.get('/award-categories/')])
    const category = catalog.categories.find((c) => c.number === entry.categoryNumber) || null
    return { entry, category }
  }, [id])

  const [override, setOverride] = useState(null) // { status, decisionReason } after a decision
  const [action, setAction] = useState(null) // 'return' | 'disqualify'
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState(null)
  const files = useEntryFiles(`/review/entries/${id}`)

  if (!isReviewer(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t open this entry" />

  const { entry, category } = data
  const status = override?.status || entry.status
  const decisionReason = override ? override.decisionReason : entry.decisionReason
  const underReview = status === 'Submitted' || status === 'UnderValidation'

  async function decide(type) {
    setSubmitting(true); setBanner(null)
    try {
      let res
      if (type === 'validate') res = await api.post(`/review/entries/${id}/validate`, undefined, { auth: true })
      else res = await api.post(`/review/entries/${id}/${type}`, { reason: reason.trim() }, { auth: true })
      setOverride({ status: res.status, decisionReason: type === 'return' || type === 'disqualify' ? reason.trim() : null })
      setAction(null); setReason('')
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t record that decision. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const m = statusMeta(status)

  return (
    <>
      <button type="button" className="dash-btn is-ghost is-sm" onClick={() => navigate('/dashboard/review')} style={{ paddingLeft: 0, marginBottom: 10 }}>
        <i className="fas fa-arrow-left" aria-hidden="true" /> Review queue
      </button>

      <header className="dash-card dash-card-pad rv-head">
        <div>
          <div className="rv-head-top">
            <span className="dash-badge tone-progress">Category #{entry.categoryNumber}</span>
            <StatusBadge status={status} />
          </div>
          <h1 className="rv-title">{entry.title}</h1>
          <p className="rv-sub">
            {category?.name} · {entry.lguName} ({entry.lguLevel} · {entry.lguRegion}) · {labelFor(COVERAGE_OPTIONS, entry.coverage)}
          </p>
          {entry.submittedAt && <p className="dash-help" style={{ marginTop: 4 }}>Submitted {formatDate(entry.submittedAt, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </div>
      </header>

      {decisionReason && (
        <div className={`dash-banner tone-${status === 'Disqualified' ? 'error' : status === 'ReturnedForRevision' ? 'warn' : 'info'}`} style={{ marginTop: 14 }}>
          <i className="fas fa-circle-info" aria-hidden="true" />
          <span><strong>Decision note.</strong> {decisionReason}</span>
        </div>
      )}

      {banner && <div className="dash-banner tone-error" style={{ marginTop: 14 }}><i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{banner}</span></div>}

      <div className="rv-stack">
        {/* The bidbook itself — one shared renderer, identical for reviewers, assessors and adjudicators. */}
        <EntryDossier entry={entry} category={category} files={files} />

        {!underReview && (
          <div className={`dash-banner tone-${status === 'Validated' ? 'success' : status === 'Disqualified' ? 'error' : status === 'ReturnedForRevision' ? 'warn' : 'info'}`}>
            <i className={`fas ${m.icon}`} aria-hidden="true" />
            <span>This entry is <strong>{m.label.toLowerCase()}</strong>{EDITABLE_STATUSES.includes(status) ? ' — it’s back with the applicant.' : '.'}</span>
          </div>
        )}
      </div>

      {/* Decision bar */}
      {underReview && (
        <div className="rv-decide">
          {action ? (
            <div className="rv-reason">
              <label className="dash-label">{action === 'return' ? 'Why are you returning this entry?' : 'Why are you disqualifying this entry?'}</label>
              <textarea className="dash-textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The applicant will see this note." autoFocus />
              <div className="rv-reason-actions">
                <button type="button" className="dash-btn" onClick={() => { setAction(null); setReason('') }}>Cancel</button>
                <button type="button" className={`dash-btn ${action === 'disqualify' ? 'is-danger' : 'is-primary'}`} disabled={!reason.trim() || submitting} onClick={() => decide(action)}>
                  {submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : action === 'return' ? 'Return for revision' : 'Disqualify entry'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rv-buttons">
              <button type="button" className="dash-btn is-danger is-sm" disabled={submitting} onClick={() => setAction('disqualify')}>Disqualify</button>
              <button type="button" className="dash-btn is-sm" disabled={submitting} onClick={() => setAction('return')}>Return for revision</button>
              <button type="button" className="dash-btn is-primary is-sm" disabled={submitting} onClick={() => decide('validate')}>
                {submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> …</> : <><i className="fas fa-circle-check" aria-hidden="true" /> Validate</>}
              </button>
            </div>
          )}
        </div>
      )}

      <CommentThread entryId={entry.id} />

      <style>{`
        .rv-head-top { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
        .rv-title { font-family: var(--font-heading); font-size: clamp(1.3rem, 2.4vw, 1.7rem); font-weight: 800; color: var(--navy); line-height: 1.18; }
        .rv-sub { color: var(--gray-600); font-size: 0.9rem; margin-top: 6px; }
        .rv-stack { display: flex; flex-direction: column; gap: 18px; margin-top: 18px; padding-bottom: 72px; }
        .rv-decide { position: sticky; bottom: 12px; margin-top: 16px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-md); padding: 9px 12px; }
        .rv-buttons { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .rv-reason { display: flex; flex-direction: column; gap: 10px; }
        .rv-reason-actions { display: flex; justify-content: flex-end; gap: 10px; }
        @media (max-width: 620px) { .rv-buttons .dash-btn { flex: 1; } }
      `}</style>
    </>
  )
}


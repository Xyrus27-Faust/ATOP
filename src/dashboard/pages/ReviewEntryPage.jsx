import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isReviewer } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
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

  if (!isReviewer(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t open this entry" />

  const { entry, category } = data
  const status = override?.status || entry.status
  const decisionReason = override ? override.decisionReason : entry.decisionReason
  const underReview = status === 'Submitted' || status === 'UnderValidation'
  const bb = entry.bidbook || { executiveSummary: '', narratives: [], supportingDocuments: [] }

  async function decide(type) {
    setSubmitting(true); setBanner(null)
    try {
      let res
      if (type === 'validate') res = await api.post(`/review/entries/${id}/validate`, undefined, { auth: true })
      else if (type === 'begin') res = await api.post(`/review/entries/${id}/begin`, undefined, { auth: true })
      else res = await api.post(`/review/entries/${id}/${type}`, { reason: reason.trim() }, { auth: true })
      setOverride({ status: res.status, decisionReason: type === 'return' || type === 'disqualify' ? reason.trim() : null })
      setAction(null); setReason('')
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t record that decision. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function viewDoc(label) {
    try {
      const { url } = await api.get(`/review/entries/${id}/documents/url?label=${encodeURIComponent(label)}`, { auth: true })
      window.open(url, '_blank', 'noopener')
    } catch {
      setBanner('We couldn’t open that document.')
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
        {/* Nominator */}
        <Section icon="fa-user-tie" title="Nominator">
          <Grid items={[
            ['Name', entry.nominator.name],
            ['Designation', entry.nominator.designation],
            ['Office', entry.nominator.office],
            ['Email', entry.nominator.email],
            ['Mobile', entry.nominator.mobile],
            ['Official LGU email', entry.nominator.officialLguEmail],
            ['Official address', entry.nominator.officialAddress],
            ['Third-party nominator', entry.nominator.isThirdParty ? 'Yes' : 'No'],
          ]} />
        </Section>

        {/* Bidbook */}
        <Section icon="fa-book-open" title="Executive summary">
          <p className="rv-prose">{bb.executiveSummary || <em className="rv-empty">Not provided.</em>}</p>
        </Section>

        <Section icon="fa-list-check" title="Criteria narratives">
          {bb.narratives.length === 0 ? <p className="rv-empty">No narratives provided.</p> : bb.narratives.map((n) => (
            <div key={n.criterionId} className="rv-narr">
              <div className="rv-narr-head">
                <span className="rv-narr-name">{n.criterionName}</span>
                <span className="dash-badge tone-progress">{n.criterionPoints} pts</span>
              </div>
              <p className="rv-prose">{n.text}</p>
            </div>
          ))}
        </Section>

        <Section icon="fa-paperclip" title="Supporting documents">
          {bb.supportingDocuments.length === 0 ? <p className="rv-empty">No documents attached.</p> : bb.supportingDocuments.map((d) => (
            <div key={d.label} className="rv-doc">
              <span className="rv-doc-label">{d.label}</span>
              <button type="button" className="dash-btn is-ghost is-sm" onClick={() => viewDoc(d.label)}>
                <i className={`fas ${d.fileKey ? 'fa-file-lines' : 'fa-link'}`} aria-hidden="true" /> {d.fileName || (d.fileKey ? 'View file' : 'Open link')}
              </button>
            </div>
          ))}
        </Section>

        {/* Declaration & endorsement */}
        <Section icon="fa-file-signature" title="Declaration">
          {entry.declaration ? (
            <Grid items={[
              ['Certified', entry.declaration.certified ? 'Yes' : 'No'],
              ['Signatory', entry.declaration.signatoryName],
              ['Designation', entry.declaration.signatoryDesignation],
              ['E-signature', entry.declaration.eSignature],
              ['Signed', formatDate(entry.declaration.signedAt, { dateStyle: 'medium', timeStyle: 'short' })],
            ]} />
          ) : <p className="rv-empty">Not signed.</p>}
        </Section>

        <Section icon="fa-stamp" title="LCE endorsement">
          {entry.lceEndorsement ? (
            <Grid items={[
              ['Endorsed', entry.lceEndorsement.endorsed ? 'Yes' : 'No'],
              ['LCE', entry.lceEndorsement.lceName],
              ['Designation', entry.lceEndorsement.lceDesignation],
              ['E-signature', entry.lceEndorsement.eSignature],
              ['Signed', formatDate(entry.lceEndorsement.signedAt, { dateStyle: 'medium', timeStyle: 'short' })],
            ]} />
          ) : <p className="rv-empty">Not endorsed.</p>}
        </Section>

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
              {status === 'Submitted' && (
                <button type="button" className="dash-btn" disabled={submitting} onClick={() => decide('begin')}>
                  <i className="fas fa-play" aria-hidden="true" /> Start review
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className="dash-btn is-danger" disabled={submitting} onClick={() => setAction('disqualify')}>Disqualify</button>
              <button type="button" className="dash-btn" disabled={submitting} onClick={() => setAction('return')}>Return for revision</button>
              <button type="button" className="dash-btn is-primary" disabled={submitting} onClick={() => decide('validate')}>
                {submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> …</> : <><i className="fas fa-circle-check" aria-hidden="true" /> Validate</>}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .rv-head-top { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
        .rv-title { font-family: var(--font-heading); font-size: clamp(1.3rem, 2.4vw, 1.7rem); font-weight: 800; color: var(--navy); line-height: 1.18; }
        .rv-sub { color: var(--gray-600); font-size: 0.9rem; margin-top: 6px; }
        .rv-stack { display: flex; flex-direction: column; gap: 18px; margin-top: 18px; padding-bottom: 90px; }
        .rv-section-title { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--navy); display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
        .rv-section-title i { color: var(--gold-dark); }
        .rv-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; }
        .rv-grid dt { font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 2px; }
        .rv-grid dd { color: var(--navy); font-size: 0.9rem; word-break: break-word; }
        .rv-prose { color: var(--text-body); line-height: 1.7; white-space: pre-wrap; }
        .rv-empty { color: var(--gray-400); font-style: italic; }
        .rv-narr { padding: 14px 0; border-top: 1px solid var(--gray-100); }
        .rv-narr:first-of-type { border-top: none; padding-top: 0; }
        .rv-narr-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .rv-narr-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; }
        .rv-doc { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--gray-100); }
        .rv-doc:first-of-type { border-top: none; padding-top: 0; }
        .rv-doc-label { font-family: var(--font-heading); font-weight: 600; color: var(--navy); font-size: 0.9rem; }
        .rv-decide { position: sticky; bottom: 14px; margin-top: 18px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 14px 16px; }
        .rv-buttons { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .rv-reason { display: flex; flex-direction: column; gap: 10px; }
        .rv-reason-actions { display: flex; justify-content: flex-end; gap: 10px; }
        @media (max-width: 620px) {
          .rv-grid { grid-template-columns: 1fr; }
          .rv-buttons { justify-content: stretch; }
          .rv-buttons .dash-btn { flex: 1; }
          .rv-buttons > div { display: none; }
        }
      `}</style>
    </>
  )
}

function Section({ icon, title, children }) {
  return (
    <section className="dash-card dash-card-pad">
      <div className="rv-section-title"><i className={`fas ${icon}`} aria-hidden="true" /> {title}</div>
      {children}
    </section>
  )
}

function Grid({ items }) {
  return (
    <dl className="rv-grid">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || <span className="rv-empty">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

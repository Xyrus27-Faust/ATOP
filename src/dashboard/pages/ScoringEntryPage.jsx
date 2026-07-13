import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isAssessor } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import {
  EvidenceRow, ExecutiveSummarySection, DocumentsSection,
  DeclarationSection, EndorsementSection, DOSSIER_CSS,
} from '../components/EntryDossier'
import { useEntryFiles } from '@/lib/entryFiles'
import { labelFor, COVERAGE_OPTIONS } from '@/lib/pearlAwards'
import { DASH_CSS } from '../DashboardLayout'

const SCALE = [0, 1, 2, 3, 4, 5]

// A 0–5 segmented rating control — the core scoring gesture. One tap per criterion.
function RatingScale({ value, onChange, disabled }) {
  return (
    <div className="sc-scale" role="radiogroup" aria-label="Score 0 to 5">
      {SCALE.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`sc-dot${value === v ? ' is-on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

// One criterion: the applicant's narrative + evidence, then the 0–5 scale. No weighting shown —
// assessors judge each criterion on its merits; the weighting is applied downstream (admin board).
function Criterion({ index, c, narrative, evidence, rating, onRate, disabled, onViewEvidence }) {
  return (
    <section id={`crit-${c.criterionId}`} className={`dash-card dash-card-pad sc-crit${rating != null ? ' is-scored' : ''}`}>
      <div className="sc-crit-head">
        <div className="sc-crit-heading">
          <span className="sc-crit-idx">{index + 1}</span>
          <h3 className="sc-crit-name">{c.name}</h3>
        </div>
        <span className={`sc-crit-mark${rating != null ? ' is-on' : ''}`}>
          {rating != null ? <><i className="fas fa-circle-check" aria-hidden="true" /> Rated {rating}</> : 'Not scored'}
        </span>
      </div>

      {c.indicators && <p className="sc-crit-indicators">{c.indicators}</p>}

      <div className="sc-crit-narr">
        <span className="sc-crit-narr-label">Applicant’s narrative</span>
        <p className="sc-prose">{narrative?.text || <em className="sc-emptytext">No narrative provided.</em>}</p>
      </div>

      <EvidenceRow files={evidence} onViewEvidence={onViewEvidence} />

      <div className="sc-rate">
        <RatingScale value={rating} onChange={onRate} disabled={disabled} />
        <div className="sc-rate-legend"><span>Poor</span><span>Excellent</span></div>
      </div>
    </section>
  )
}

// Focused full-screen shell (no dashboard chrome). Injects the shared dash-* system like
// SubmissionLayout so the cards/buttons/badges style correctly outside the dashboard.
function Shell({ children }) {
  return (
    <div className="scf">
      {children}
      <style>{DASH_CSS}</style>
      <style>{DOSSIER_CSS}</style>
      <style>{SCF_CSS}</style>
    </div>
  )
}

export default function ScoringEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { loading, error, data, reload } = useAsync(
    async () => {
      const [detail, catalog] = await Promise.all([
        api.get(`/scoring/entries/${id}`, { auth: true }),
        api.get('/award-categories/'),
      ])
      // The rubric's requiredSubmissions say which links are *meant* to be videos, so an unplayable
      // one can flag itself rather than failing silently.
      const category = catalog.categories.find((c) => c.number === detail.entry.categoryNumber) || null
      return { ...detail, category }
    },
    [id],
  )
  const files = useEntryFiles(`/scoring/entries/${id}`)

  const [scores, setScores] = useState({}) // criterionId -> rating (0..5)
  const [myStatus, setMyStatus] = useState('NotStarted')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState(null)
  const dirty = useRef(false)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!data || hydrated.current) return
    hydrated.current = true
    setScores(Object.fromEntries((data.myScores || []).map((s) => [s.criterionId, s.rating])))
    setMyStatus(data.myAssessmentStatus || 'NotStarted')
  }, [data])

  const entry = data?.entry
  const criteria = useMemo(() => data?.criteria || [], [data])
  const readOnly = myStatus === 'Submitted' || (entry && entry.status !== 'Validated')

  const ratedPayload = () =>
    Object.entries(scores)
      .filter(([, v]) => v != null)
      .map(([criterionId, rating]) => ({ criterionId, rating }))

  async function persist() {
    await api.put(`/scoring/entries/${id}/scores`, { scores: ratedPayload() }, { auth: true })
    dirty.current = false
  }

  useEffect(() => {
    if (!dirty.current || readOnly) return
    setSaveState('saving')
    const t = setTimeout(async () => {
      try { await persist(); setSaveState('saved') } catch { setSaveState('error') }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores])

  function setRating(criterionId, val) {
    if (readOnly) return
    dirty.current = true
    setBanner(null)
    setScores((s) => ({ ...s, [criterionId]: val }))
  }

  const scoredCount = useMemo(
    () => criteria.reduce((n, c) => n + (scores[c.criterionId] != null ? 1 : 0), 0),
    [criteria, scores],
  )
  const allScored = criteria.length > 0 && scoredCount === criteria.length

  async function submit() {
    setSubmitting(true)
    setBanner(null)
    try {
      await persist()
      await api.post(`/scoring/entries/${id}/scores/submit`, undefined, { auth: true })
      setMyStatus('Submitted')
      setConfirming(false)
      setSaveState('idle')
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t submit your scores. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function scrollToCrit(cid) {
    document.getElementById(`crit-${cid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!isAssessor(user?.roles)) return <Navigate to="/dashboard" replace />

  const back = (
    <button type="button" className="scf-back" onClick={() => navigate('/dashboard/scoring')}>
      <i className="fas fa-arrow-left" aria-hidden="true" /> Back to queue
    </button>
  )

  if (loading) return <Shell><header className="scf-top">{back}</header><div className="scf-loadwrap"><Loading /></div></Shell>
  if (error) return <Shell><header className="scf-top">{back}</header><div className="scf-loadwrap"><ErrorState error={error} onRetry={reload} title="We couldn’t open this entry" /></div></Shell>

  const bb = entry.bidbook || { executiveSummary: '', narratives: [], supportingDocuments: [], evidence: [] }
  const narrativeByCriterion = new Map(bb.narratives.map((n) => [n.criterionId, n]))
  const evidenceByCriterion = (bb.evidence || []).reduce((m, e) => { (m[e.criterionId] ||= []).push(e); return m }, {})
  const pct = criteria.length ? Math.round((scoredCount / criteria.length) * 100) : 0

  const saveIndicator = !readOnly && saveState !== 'idle' && (
    <span className={`sc-save sc-save-${saveState}`}>
      {saveState === 'saving' && <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</>}
      {saveState === 'saved' && <><i className="fas fa-cloud" aria-hidden="true" /> Saved</>}
      {saveState === 'error' && <><i className="fas fa-triangle-exclamation" aria-hidden="true" /> Save failed</>}
    </span>
  )

  const submitControl = readOnly ? (
    <span className="sc-locked"><i className="fas fa-lock" aria-hidden="true" /> {myStatus === 'Submitted' ? 'Submitted' : 'Scoring closed'}</span>
  ) : confirming ? (
    <div className="sc-confirm">
      <span className="sc-confirm-q">Submit final scores? You can’t change them afterwards.</span>
      <div className="sc-confirm-btns">
        <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setConfirming(false)} disabled={submitting}>Cancel</button>
        <button type="button" className="dash-btn is-primary is-sm" onClick={submit} disabled={submitting}>
          {submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Submitting…</> : 'Confirm'}
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      className="dash-btn is-primary sc-submit-btn"
      disabled={!allScored}
      onClick={() => setConfirming(true)}
      title={allScored ? 'Submit and lock your scoresheet' : 'Score every criterion to submit'}
    >
      <i className="fas fa-paper-plane" aria-hidden="true" /> Submit scores
    </button>
  )

  return (
    <Shell>
      <header className="scf-top">
        {back}
        <div className="scf-id">
          <span className="scf-cat">#{entry.categoryNumber}</span>
          <div className="scf-id-main">
            <span className="scf-title">{entry.title}</span>
            <span className="scf-meta">{entry.lguName} · {entry.lguLevel} · {entry.lguRegion} · {labelFor(COVERAGE_OPTIONS, entry.coverage)}</span>
          </div>
        </div>
        <div className="scf-top-r">
          <StatusBadge status={entry.status} />
          {myStatus === 'Submitted' && <span className="dash-badge tone-success"><i className="fas fa-lock" aria-hidden="true" /> Submitted</span>}
          <span className="scf-progress"><b>{scoredCount}</b> / {criteria.length}</span>
        </div>
      </header>

      <div className="scf-body">
        <div className="scf-main">
          {myStatus === 'Submitted' && (
            <div className="dash-banner tone-success">
              <i className="fas fa-circle-check" aria-hidden="true" />
              <span><strong>Your scoresheet is submitted and locked.</strong> Ask an admin to reopen it if you need to make a change.</span>
            </div>
          )}
          {myStatus !== 'Submitted' && entry.status !== 'Validated' && (
            <div className="dash-banner tone-info"><i className="fas fa-circle-info" aria-hidden="true" /> <span>Scoring for this entry is closed.</span></div>
          )}
          {banner && <div className="dash-banner tone-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{banner}</span></div>}

          {files.fileError && (
            <div className="dash-banner tone-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{files.fileError}</span></div>
          )}

          <ExecutiveSummarySection entry={entry} />

          <div className="sc-rubric-intro">
            <div className="sc-section-title" style={{ marginBottom: 4 }}><i className="fas fa-list-check" aria-hidden="true" /> Score the criteria</div>
            <p className="dash-help">Read each narrative and rate it 0 (poor) to 5 (excellent). Your ratings autosave.</p>
          </div>

          {criteria.map((c, i) => (
            <Criterion
              key={c.criterionId}
              index={i}
              c={c}
              narrative={narrativeByCriterion.get(c.criterionId)}
              evidence={evidenceByCriterion[c.criterionId] || []}
              rating={scores[c.criterionId]}
              onRate={(v) => setRating(c.criterionId, v)}
              disabled={readOnly}
              onViewEvidence={files.viewEvidence}
            />
          ))}

          {/* The same evidence a reviewer sees — inline video, documents, declaration, endorsement. */}
          <DocumentsSection entry={entry} category={data.category} onViewDoc={files.viewDoc} />
          <DeclarationSection entry={entry} />
          <EndorsementSection entry={entry} onViewEndorsement={files.viewEndorsement} />
        </div>

        {/* Rail: criteria checklist + progress + submit. Condenses to a sticky bottom bar on mobile. */}
        <aside className="scf-rail">
          <div className="dash-card sc-rail-card">
            <div className="sc-rail-title">Your scoring</div>
            <ul className="sc-rail-list">
              {criteria.map((c, i) => {
                const r = scores[c.criterionId]
                return (
                  <li key={c.criterionId}>
                    <button type="button" className={`sc-rail-item${r != null ? ' is-scored' : ''}`} onClick={() => scrollToCrit(c.criterionId)}>
                      <span className="sc-rail-idx">{i + 1}</span>
                      <span className="sc-rail-name">{c.name}</span>
                      <span className={`sc-rail-mark${r != null ? ' is-on' : ''}`}>{r != null ? r : '—'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="sc-rail-foot">
              <div className="sc-rail-count"><b>{scoredCount}</b> / {criteria.length} scored {saveIndicator}</div>
              <div className="dash-meter sc-rail-meter"><div className={`dash-meter-fill${allScored ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} /></div>
              {submitControl}
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  )
}

const SCF_CSS = `
  .scf { min-height: 100vh; background: var(--off-white); display: flex; flex-direction: column; }
  .scf * { box-sizing: border-box; }

  .scf-top {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: 16px;
    padding: 10px clamp(16px, 3vw, 36px);
    background: rgba(255,255,255,0.92); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--gray-200);
  }
  .scf-back { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; background: none; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); color: var(--gray-600); font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; padding: 9px 14px; cursor: pointer; transition: var(--transition-fast); white-space: nowrap; }
  .scf-back:hover { border-color: var(--navy); color: var(--navy); background: var(--white); }
  .scf-id { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .scf-cat { flex-shrink: 0; display: inline-grid; place-items: center; min-width: 40px; height: 34px; padding: 0 10px; border-radius: 9px; font-family: var(--font-heading); font-weight: 800; font-size: 0.9rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); }
  .scf-id-main { display: flex; flex-direction: column; min-width: 0; }
  .scf-title { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 1rem; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scf-meta { font-size: 0.76rem; color: var(--gray-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scf-top-r { display: flex; align-items: center; gap: 10px; margin-left: auto; flex-shrink: 0; }
  .scf-progress { font-family: var(--font-heading); font-weight: 700; font-size: 0.82rem; color: var(--gray-600); white-space: nowrap; }
  .scf-progress b { color: var(--navy); font-size: 1.05rem; }

  .scf-loadwrap { padding: 40px; max-width: 720px; margin: 0 auto; width: 100%; }

  .scf-body { width: 100%; max-width: 1200px; margin: 0 auto; padding: clamp(20px, 3vw, 36px); display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; }
  .scf-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

  .sc-section-title { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--navy); display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
  .sc-section-title i { color: var(--gold-dark); }
  .sc-prose { color: var(--text-body); line-height: 1.7; white-space: pre-wrap; }
  .sc-emptytext { color: var(--gray-400); font-style: italic; }
  .sc-rubric-intro { margin-top: 4px; }

  .sc-crit { border-left: 3px solid var(--gray-200); scroll-margin-top: 72px; transition: var(--transition-fast); }
  .sc-crit.is-scored { border-left-color: var(--gold); }
  .sc-crit-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .sc-crit-heading { display: flex; gap: 12px; align-items: flex-start; min-width: 0; }
  .sc-crit-idx { flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-family: var(--font-heading); font-weight: 800; font-size: 0.82rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); margin-top: 1px; }
  .sc-crit-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 1rem; line-height: 1.3; }
  .sc-crit-mark { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--gray-400); white-space: nowrap; }
  .sc-crit-mark.is-on { color: #15803D; }
  .sc-crit-indicators { color: var(--gray-600); font-size: 0.84rem; line-height: 1.55; margin-top: 10px; }
  .sc-crit-narr { margin-top: 12px; padding: 13px 15px; background: var(--off-white); border: 1px solid var(--gray-100); border-radius: var(--radius-sm); }
  .sc-crit-narr-label { display: block; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 6px; }
  .sc-crit-evidence { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .sc-evidence-label { font-family: var(--font-heading); font-weight: 700; font-size: 0.72rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gray-600); display: inline-flex; align-items: center; gap: 6px; }
  .sc-evidence-label i { color: var(--gold-dark); }

  .sc-rate { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--gray-100); }
  .sc-scale { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; max-width: 520px; }
  .sc-dot { height: 58px; border-radius: var(--radius-sm); border: 1.5px solid var(--gray-200); background: var(--white); font-family: var(--font-heading); font-weight: 800; font-size: 1.3rem; color: var(--gray-600); cursor: pointer; transition: var(--transition-fast); }
  .sc-dot:hover:not(:disabled) { border-color: var(--gold); color: var(--navy); transform: translateY(-2px); }
  .sc-dot.is-on { background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%); color: var(--white); border-color: var(--gold); box-shadow: 0 5px 16px rgba(200,168,75,0.36); }
  .sc-dot:disabled { cursor: default; opacity: 0.75; }
  .sc-dot.is-on:disabled { opacity: 1; }
  .sc-rate-legend { display: flex; justify-content: space-between; max-width: 520px; margin-top: 8px; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gray-400); }

  .sc-doc { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--gray-100); }
  .sc-doc:first-of-type { border-top: none; }
  .sc-doc-label { font-family: var(--font-heading); font-weight: 600; color: var(--navy); font-size: 0.9rem; }

  .scf-rail { position: sticky; top: 72px; }
  .sc-rail-card { padding: 16px; }
  .sc-rail-title { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 10px; }
  .sc-rail-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .sc-rail-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 8px; border-radius: var(--radius-sm); transition: var(--transition-fast); }
  .sc-rail-item:hover { background: var(--gray-100); }
  .sc-rail-idx { flex-shrink: 0; width: 20px; font-family: var(--font-heading); font-weight: 700; font-size: 0.74rem; color: var(--gray-400); }
  .sc-rail-name { flex: 1; min-width: 0; font-family: var(--font-body); font-size: 0.82rem; color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-rail-mark { flex-shrink: 0; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gray-400); background: var(--gray-100); border: 1px solid var(--gray-200); }
  .sc-rail-mark.is-on { color: var(--white); background: linear-gradient(135deg, var(--gold), var(--gold-dark)); border-color: var(--gold); }
  .sc-rail-foot { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--gray-100); display: flex; flex-direction: column; gap: 10px; }
  .sc-rail-count { font-family: var(--font-body); font-size: 0.84rem; color: var(--gray-600); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sc-rail-count b { font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
  .sc-submit-btn { width: 100%; }
  .sc-save { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; }
  .sc-save-saving { color: var(--gray-400); }
  .sc-save-saved { color: #15803D; }
  .sc-save-error { color: #B91C1C; }
  .sc-locked { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-size: 0.8rem; font-weight: 700; color: var(--gray-600); }
  .sc-confirm { display: flex; flex-direction: column; gap: 10px; }
  .sc-confirm-q { font-family: var(--font-body); font-size: 0.84rem; color: var(--navy); line-height: 1.4; }
  .sc-confirm-btns { display: flex; gap: 8px; }
  .sc-confirm-btns .dash-btn { flex: 1; }

  @media (max-width: 980px) {
    .scf-body { grid-template-columns: 1fr; }
    .scf-main { padding-bottom: 12px; }
    .scf-rail { position: sticky; bottom: 12px; top: auto; z-index: 20; }
    .sc-rail-list, .sc-rail-title { display: none; }
    .sc-rail-card { box-shadow: var(--shadow-lg, 0 18px 44px rgba(15,25,46,0.16)); }
    .sc-rail-foot { margin-top: 0; padding-top: 0; border-top: none; }
  }
  @media (max-width: 620px) {
    .scf-meta { display: none; }
    .sc-scale, .sc-rate-legend { max-width: none; }
  }
`

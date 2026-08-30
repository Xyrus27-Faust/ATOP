import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isAssessor } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import {
  EvidenceRow, ExecutiveSummarySection, VideoSection, DocumentsReferenceSection,
  DeclarationSection, EndorsementSection, DOSSIER_CSS,
} from '../components/EntryDossier'
import { useEntryFiles } from '@/lib/entryFiles'
import {
  labelFor, COVERAGE_OPTIONS,
  RATING_MIN, RATING_MAX, RATING_STEP, RATING_BANDS,
  toRatingStep, formatRating, ratingBand, bandRange,
  weightedScore, formatWeighted, weightedTotal,
} from '@/lib/pearlAwards'
import { DASH_CSS } from '../DashboardLayout'

// Matches Assessment.MaxFeedbackLength on the API — the textarea stops there rather than letting a
// long note travel only to bounce back as a 400.
const FEEDBACK_MAX = 4000

// The rating control. The manual's scale is 0–5 in 0.2 increments — 26 stops, not six buttons — so
// a slider is the honest control for it, with the exact value shown in a box beside it (and typeable,
// because dragging to a precise 3.4 is fiddly). The band label reads out what the number *means*
// under the manual's rubric, so the assessor sees "Very Good" as they land on it.
function RatingScale({ value, onChange, disabled, inputId, points }) {
  const band = ratingBand(value)
  const weighted = weightedScore(value, points)
  // The slider needs a concrete position; an unscored criterion sits at 0 but stays visually "unset".
  const sliderValue = value ?? RATING_MIN

  return (
    <div className="sc-rating">
      <div className="sc-rating-controls">
        <input
          id={inputId}
          className={`sc-slider${value == null ? ' is-unset' : ''}`}
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={RATING_STEP}
          value={sliderValue}
          disabled={disabled}
          onChange={(e) => onChange(toRatingStep(Number(e.target.value)))}
          aria-label={`Rating, ${RATING_MIN} to ${RATING_MAX} in steps of ${RATING_STEP}`}
          aria-valuetext={value == null ? 'Not scored' : `${formatRating(value)} — ${band.label}`}
        />
        <input
          className={`sc-ratebox${value == null ? ' is-unset' : ''}`}
          type="number"
          min={RATING_MIN}
          max={RATING_MAX}
          step={RATING_STEP}
          value={value == null ? '' : formatRating(value)}
          disabled={disabled}
          placeholder="—"
          aria-label="Rating value"
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') return
            onChange(toRatingStep(Number(raw)))
          }}
        />
      </div>

      <div className="sc-rating-foot">
        <span className="sc-ticks" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((n) => <span key={n}>{n}</span>)}
        </span>
        <div className="sc-rating-readout">
          {value == null
            ? <span className="sc-band is-unset">Not scored</span>
            : <span className="sc-band"><b>{band.label}</b> <span className="sc-band-mean">{band.meaning}</span></span>}
          {points != null && (
            <span className={`sc-weighted${value == null ? ' is-unset' : ''}`}>
              <span className="sc-weighted-val">{formatWeighted(weighted)}</span>
              <span className="sc-weighted-max">of {points}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// The manual's descriptor table, shown once at the top of the scoresheet so the assessor can
// calibrate before they start rating rather than guessing what a 3.4 means.
function RatingGuide() {
  return (
    <details className="dash-card dash-card-pad sc-guide">
      <summary className="sc-guide-summary">
        <span className="sc-section-title" style={{ margin: 0 }}>
          <i className="fas fa-ruler" aria-hidden="true" /> Rating scale: 0 to 5, in 0.2 increments
        </span>
        <i className="fas fa-chevron-down sc-guide-chev" aria-hidden="true" />
      </summary>
      <table className="sc-guide-table">
        <tbody>
          {RATING_BANDS.map((b) => (
            <tr key={b.label}>
              <td className="sc-guide-range">{bandRange(b)}</td>
              <td className="sc-guide-label">{b.label}</td>
              <td className="sc-guide-mean">{b.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sc-guide-note">
        Weighted score = rating ÷ 5 × criterion points. A 4.0 on a 20-point criterion earns 16.
      </p>
    </details>
  )
}

// One criterion: the applicant's narrative + evidence, then the 0–5 scale. The criterion's weight is
// shown up front and its earned share under the slider, so the assessor can see what a rating is
// worth as they set it — the rating is still the only thing they choose, and the arithmetic below is
// the same rating ÷ 5 × points the server applies.
function Criterion({ index, c, narrative, evidence, rating, onRate, disabled, onViewEvidence }) {
  return (
    <section id={`crit-${c.criterionId}`} className="dash-card dash-card-pad sc-crit">
      <div className="sc-crit-head">
        <div className="sc-crit-heading">
          <span className="sc-crit-idx">{index + 1}</span>
          <h3 className="sc-crit-name">{c.name}</h3>
          {c.points != null && <span className="sc-crit-pts">{c.points} pts</span>}
        </div>
        <span className={`sc-crit-mark${rating != null ? ' is-on' : ''}`}>
          {rating != null
            ? <><i className="fas fa-circle-check" aria-hidden="true" /> Rated {formatRating(rating)}</>
            : 'Not scored'}
        </span>
      </div>

      {c.indicators && <p className="sc-crit-indicators">{c.indicators}</p>}

      <div className="sc-crit-narr">
        <span className="sc-crit-narr-label">Applicant’s narrative</span>
        <p className="sc-prose">{narrative?.text || <em className="sc-emptytext">No narrative provided.</em>}</p>
      </div>

      <EvidenceRow files={evidence} onViewEvidence={onViewEvidence} showEmpty />

      <div className="sc-rate">
        <RatingScale value={rating} onChange={onRate} disabled={disabled} inputId={`rate-${c.criterionId}`} points={c.points} />
      </div>
    </section>
  )
}

// The assessor's private note on the entry — the qualitative "why" a 0–5 can't carry. Deliberately
// one-way: only ATOP admins read it, the entrant never sees it and can't reply, so the wording says
// so plainly rather than leaving an assessor to guess who's on the other end.
function FeedbackSection({ value, onChange, disabled }) {
  const left = FEEDBACK_MAX - value.length

  return (
    <section className="dash-card dash-card-pad sc-fb">
      <div className="sc-section-title" style={{ marginBottom: 6 }}>
        <i className="fas fa-comment-dots" aria-hidden="true" /> Feedback <span className="sc-fb-opt">optional</span>
      </div>
      <p className="dash-help sc-fb-help">
        <i className="fas fa-eye-slash" aria-hidden="true" />
        Seen by ATOP admins only. The entrant is never shown this and can’t reply to it.
      </p>

      {disabled && !value ? (
        <p className="sc-emptytext">No feedback given.</p>
      ) : disabled ? (
        <p className="sc-prose sc-fb-read">{value}</p>
      ) : (
        <>
          <textarea
            className="dash-textarea sc-fb-input"
            rows={5}
            maxLength={FEEDBACK_MAX}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="What stood out, what was thin, anything the ratings alone don’t capture…"
            aria-label="Private feedback on this entry"
          />
          <div className={`sc-fb-count${left <= 200 ? ' is-low' : ''}`}>{left.toLocaleString()} characters left</div>
        </>
      )}
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
  const [feedback, setFeedback] = useState('') // private note, admin-visible only
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
    setFeedback(data.myFeedback || '')
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
    await api.put(`/scoring/entries/${id}/scores`, { scores: ratedPayload(), feedback }, { auth: true })
    dirty.current = false
  }

  // One debounce covers ratings and the note — both are the same draft scoresheet, and typing a
  // note shouldn't save on every keystroke any more than dragging a slider should.
  useEffect(() => {
    if (!dirty.current || readOnly) return
    setSaveState('saving')
    const t = setTimeout(async () => {
      try { await persist(); setSaveState('saved') } catch { setSaveState('error') }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, feedback])

  function setRating(criterionId, val) {
    if (readOnly) return
    dirty.current = true
    setBanner(null)
    setScores((s) => ({ ...s, [criterionId]: val }))
  }

  function setFeedbackText(text) {
    if (readOnly) return
    dirty.current = true
    setBanner(null)
    setFeedback(text)
  }

  const scoredCount = useMemo(
    () => criteria.reduce((n, c) => n + (scores[c.criterionId] != null ? 1 : 0), 0),
    [criteria, scores],
  )
  const allScored = criteria.length > 0 && scoredCount === criteria.length
  // Running weighted total. Partial until every criterion is rated, so it's labelled "so far" —
  // an assessor comparing a half-finished 40 against the manual's 80 floor would be reading a
  // number that doesn't mean what it looks like.
  const total = useMemo(() => weightedTotal(criteria, scores), [criteria, scores])

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

  // The way out is a breadcrumb, not a button: it sits above the entry title so the
  // top bar leads with the entry itself. `trailing` draws the chevron only when a
  // title actually follows it (i.e. not on the loading/error shells).
  const crumb = (trailing) => (
    <button type="button" className={`scf-crumb${trailing ? '' : ' is-alone'}`} onClick={() => navigate('/dashboard/scoring')}>
      {!trailing && <i className="fas fa-arrow-left" aria-hidden="true" />}
      <span>Scoring queue</span>
      {trailing && <i className="fas fa-chevron-right" aria-hidden="true" />}
    </button>
  )

  if (loading) return <Shell><header className="scf-top">{crumb(false)}</header><div className="scf-loadwrap"><Loading /></div></Shell>
  if (error) return <Shell><header className="scf-top">{crumb(false)}</header><div className="scf-loadwrap"><ErrorState error={error} onRetry={reload} title="We couldn’t open this entry" /></div></Shell>

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
        <div className="scf-id">
          <span className="scf-cat">#{entry.categoryNumber}</span>
          <div className="scf-id-main">
            {crumb(true)}
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

          {/* Video first: it's the closest an assessor gets to seeing the work itself, so it leads
              the scoresheet rather than sitting under the criteria they've already rated. */}
          <VideoSection entry={entry} category={data.category} onViewDoc={files.viewDoc} />

          <ExecutiveSummarySection entry={entry} />

          {/* What else the entrant attached, collapsed and ahead of the rubric so it's reference an
              assessor can open while they read — not a block that competes with the work itself.
              Whether the required set is complete stays the reviewer's call at validation. */}
          <DocumentsReferenceSection entry={entry} category={data.category} onViewDoc={files.viewDoc} />

          <RatingGuide />

          <div className="sc-rubric-intro">
            <div className="sc-section-title" style={{ marginBottom: 4 }}><i className="fas fa-list-check" aria-hidden="true" /> Score the criteria</div>
            <p className="dash-help">
              Read each narrative, then set a rating from 0 to 5 in steps of 0.2 — drag the slider or type the
              exact value. Your ratings autosave.
            </p>
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

          {/* Feedback sits after the ratings: it's the assessor's read of the whole entry, written
              once they've formed one, and it never affects the total. */}
          <FeedbackSection value={feedback} onChange={setFeedbackText} disabled={readOnly} />

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
                      <span className="sc-rail-weighted">{r != null ? formatWeighted(weightedScore(r, c.points)) : '—'}</span>
                      <span className={`sc-rail-mark${r != null ? ' is-on' : ''}`}>{r != null ? formatRating(r) : '—'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="sc-rail-foot">
              <div className="sc-rail-total">
                <span className="sc-rail-total-label">{allScored ? 'Weighted total' : 'Weighted total so far'}</span>
                <span className="sc-rail-total-val">
                  <b>{formatWeighted(total.earned)}</b> <span className="sc-rail-total-max">/ {total.max}</span>
                </span>
              </div>
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
  .scf-crumb { display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; background: none; border: none; padding: 0; cursor: pointer; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gray-600); transition: var(--transition-fast); white-space: nowrap; }
  .scf-crumb i { font-size: 0.58rem; color: var(--gray-400); transition: var(--transition-fast); }
  .scf-crumb:hover, .scf-crumb:hover i { color: var(--gold-dark); }
  .scf-crumb:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 3px; }
  .scf-crumb.is-alone { font-size: 0.76rem; padding: 6px 0; }
  .scf-id { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .scf-cat { flex-shrink: 0; display: inline-grid; place-items: center; min-width: 40px; height: 34px; padding: 0 10px; border-radius: 9px; font-family: var(--font-heading); font-weight: 800; font-size: 0.9rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); }
  .scf-id-main { display: flex; flex-direction: column; min-width: 0; }
  .scf-id-main .scf-crumb { margin-bottom: 4px; }
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

  .sc-crit { scroll-margin-top: 72px; transition: var(--transition-fast); }
  .sc-crit-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .sc-crit-heading { display: flex; gap: 12px; align-items: flex-start; min-width: 0; }
  .sc-crit-idx { flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-family: var(--font-heading); font-weight: 800; font-size: 0.82rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); margin-top: 1px; }
  .sc-crit-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 1rem; line-height: 1.3; }
  .sc-crit-pts { flex-shrink: 0; align-self: center; padding: 2px 9px; border-radius: 999px; background: var(--gray-100); border: 1px solid var(--gray-200); font-family: var(--font-heading); font-weight: 700; font-size: 0.7rem; color: var(--gray-600); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .sc-crit-mark { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--gray-400); white-space: nowrap; }
  .sc-crit-mark.is-on { color: #15803D; }
  .sc-crit-indicators { color: var(--gray-600); font-size: 0.84rem; line-height: 1.55; margin-top: 10px; }
  .sc-crit-narr { margin-top: 12px; padding: 13px 15px; background: var(--off-white); border: 1px solid var(--gray-100); border-radius: var(--radius-sm); }
  .sc-crit-narr-label { display: block; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 6px; }
  .sc-rate { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--gray-100); }

  /* 0–5 in 0.2 steps: a slider for the gesture, a number box for the exact value. */
  /* Full width: the slider is the control the whole card exists for, and a longer track makes the
     0.2 steps easier to land on — 26 stops across 560px is ~21px each, across the full card ~29px. */
  .sc-rating-controls { display: flex; align-items: center; gap: 16px; }

  .sc-slider { flex: 1; -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; background: var(--gray-200); cursor: pointer; }
  .sc-slider:disabled { cursor: default; opacity: 0.6; }
  .sc-slider.is-unset { background: var(--gray-200); }
  .sc-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%); border: 2px solid var(--white); box-shadow: 0 2px 8px rgba(15,25,46,0.28); cursor: grab; }
  .sc-slider::-webkit-slider-thumb:active { cursor: grabbing; }
  .sc-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%); border: 2px solid var(--white); box-shadow: 0 2px 8px rgba(15,25,46,0.28); cursor: grab; }
  .sc-slider.is-unset::-webkit-slider-thumb { background: var(--gray-300); }
  .sc-slider.is-unset::-moz-range-thumb { background: var(--gray-300); }
  .sc-slider:focus-visible { outline: 2px solid var(--gold-dark); outline-offset: 4px; }

  .sc-ratebox { flex: 0 0 auto; width: 82px; padding: 10px 8px; text-align: center; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); background: var(--white); font-family: var(--font-heading); font-weight: 800; font-size: 1.35rem; color: var(--navy); font-variant-numeric: tabular-nums; }
  .sc-ratebox:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,168,75,0.18); }
  .sc-ratebox.is-unset { color: var(--gray-300); }
  .sc-ratebox:disabled { background: var(--gray-100); opacity: 0.8; }

  .sc-rating-foot { margin-top: 8px; }
  .sc-ticks { display: flex; justify-content: space-between; padding-right: 98px; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; color: var(--gray-400); font-variant-numeric: tabular-nums; }
  /* Band on the left, what it earned on the right — the descriptor is the judgement, the number
     is its consequence, so they read in that order. */
  .sc-rating-readout { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .sc-weighted { flex-shrink: 0; margin-top: 8px; display: inline-flex; align-items: baseline; gap: 5px; padding: 4px 10px; border-radius: 999px; background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); font-variant-numeric: tabular-nums; }
  .sc-weighted-val { font-family: var(--font-heading); font-weight: 800; font-size: 1rem; color: var(--gold-dark); }
  .sc-weighted-max { font-size: 0.74rem; color: var(--gray-600); }
  .sc-weighted.is-unset { background: var(--gray-100); border-color: var(--gray-200); }
  .sc-weighted.is-unset .sc-weighted-val { color: var(--gray-300); }
  .sc-band { display: block; margin-top: 8px; font-size: 0.82rem; color: var(--gray-600); line-height: 1.5; }
  .sc-band b { font-family: var(--font-heading); color: var(--gold-dark); font-size: 0.86rem; }
  .sc-band-mean { color: var(--gray-600); }
  .sc-band.is-unset { color: var(--gray-400); font-style: italic; }

  /* The manual's descriptor table, collapsed by default — calibration, not clutter. */
  .sc-guide { padding: 0; margin-bottom: 4px; }
  .sc-guide-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; cursor: pointer; list-style: none; }
  .sc-guide-summary::-webkit-details-marker { display: none; }
  .sc-guide-chev { color: var(--gray-400); font-size: 0.8rem; transition: transform 0.15s ease; }
  .sc-guide[open] .sc-guide-chev { transform: rotate(180deg); }
  .sc-guide-table { width: 100%; border-collapse: collapse; }
  .sc-guide-table td { padding: 8px 12px; border-top: 1px solid var(--gray-100); font-size: 0.84rem; vertical-align: top; }
  .sc-guide-table tr td:first-child { padding-left: 20px; }
  .sc-guide-table tr td:last-child { padding-right: 20px; }
  .sc-guide-range { white-space: nowrap; font-family: var(--font-heading); font-weight: 800; color: var(--gold-dark); font-variant-numeric: tabular-nums; }
  .sc-guide-label { white-space: nowrap; font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
  .sc-guide-mean { color: var(--gray-600); }
  .sc-guide-note { padding: 12px 20px 16px; font-size: 0.8rem; color: var(--gray-600); border-top: 1px solid var(--gray-100); }

  /* Private feedback. Reads as an aside to the rubric, not another scored item — no index chip,
     and the privacy line sits right under the title where it can't be missed. */
  .sc-fb-opt { font-family: var(--font-body); font-size: 0.7rem; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--gray-400); }
  .sc-fb-help { display: flex; align-items: center; gap: 7px; margin-bottom: 12px; }
  .sc-fb-help i { color: var(--gray-400); }
  .sc-fb-input { width: 100%; resize: vertical; min-height: 108px; }
  .sc-fb-count { margin-top: 6px; text-align: right; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; color: var(--gray-400); font-variant-numeric: tabular-nums; }
  .sc-fb-count.is-low { color: #B45309; }
  .sc-fb-read { padding: 13px 15px; background: var(--off-white); border: 1px solid var(--gray-100); border-radius: var(--radius-sm); }

  .scf-rail { position: sticky; top: 72px; }
  .sc-rail-card { padding: 16px; }
  .sc-rail-title { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 10px; }
  .sc-rail-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .sc-rail-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 8px; border-radius: var(--radius-sm); transition: var(--transition-fast); }
  .sc-rail-item:hover { background: var(--gray-100); }
  .sc-rail-idx { flex-shrink: 0; width: 20px; font-family: var(--font-heading); font-weight: 700; font-size: 0.74rem; color: var(--gray-400); }
  .sc-rail-name { flex: 1; min-width: 0; font-family: var(--font-body); font-size: 0.82rem; color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-rail-mark { flex-shrink: 0; min-width: 34px; height: 24px; padding: 0 5px; display: grid; place-items: center; border-radius: 7px; font-family: var(--font-heading); font-weight: 800; font-size: 0.76rem; color: var(--gray-400); background: var(--gray-100); border: 1px solid var(--gray-200); font-variant-numeric: tabular-nums; }
  .sc-rail-mark.is-on { color: var(--white); background: linear-gradient(135deg, var(--gold), var(--gold-dark)); border-color: var(--gold); }
  .sc-rail-weighted { flex-shrink: 0; min-width: 26px; text-align: right; font-family: var(--font-heading); font-weight: 700; font-size: 0.74rem; color: var(--gray-600); font-variant-numeric: tabular-nums; }
  .sc-rail-foot { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--gray-100); display: flex; flex-direction: column; gap: 10px; }
  /* The number the tally actually uses, so it's the biggest thing in the rail. */
  .sc-rail-total { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .sc-rail-total-label { font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gray-600); }
  .sc-rail-total-val { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sc-rail-total-val b { font-family: var(--font-heading); font-weight: 800; font-size: 1.5rem; color: var(--navy); letter-spacing: -0.02em; }
  .sc-rail-total-max { font-size: 0.8rem; color: var(--gray-400); }
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
    .sc-ticks { padding-right: 90px; }
  }
`

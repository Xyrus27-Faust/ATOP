import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isAdjudicator } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import EntryDossier, { EntryFacts } from '../components/EntryDossier'
import { useEntryFiles } from '@/lib/entryFiles'
import { bracketLabel } from '@/lib/pearlAwards'
import { DASH_CSS } from '../DashboardLayout'

// Focused full-screen shell (no dashboard chrome) — ranking a bracket is a single sustained task.
// Injects the shared dash-* system like SubmissionLayout / ScoringEntryPage.
function Shell({ children }) {
  return (
    <div className="fb">
      {children}
      <style>{DASH_CSS}</style>
      <style>{FB_CSS}</style>
    </div>
  )
}

// The finalist's bidbook — what the ranking is actually made on. Opened on demand so the ranking
// stays the focus. Renders the shared dossier in its "judging" layout, the same shape the 3PIC
// assessor scores against: the entry video first, then the narratives with each criterion's own
// evidence, then declaration and LCE endorsement.
function Dossier({ entryId, onClose }) {
  const { loading, error, data, reload } = useAsync(
    () =>
      api.get(`/finals/entries/${entryId}`, { auth: true }).then(async (detail) => {
        // The rubric's requiredSubmissions tell us which links are *meant* to be videos, so an
        // unplayable one can say so instead of failing silently.
        const catalog = await api.get('/award-categories/')
        const category = catalog.categories.find((c) => c.number === detail.entry.categoryNumber) || null
        return { ...detail, category }
      }),
    [entryId],
  )
  const files = useEntryFiles(`/finals/entries/${entryId}`)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const entry = data?.entry

  return (
    <div className="fb-drawer" role="dialog" aria-modal="true" aria-label="Finalist dossier" onMouseDown={onClose}>
      <aside className="fb-drawer-panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="fb-drawer-head">
          <div className="fb-drawer-id">
            <span className="dash-eyebrow">Finalist dossier</span>
            <h2 className="fb-drawer-title">{entry?.title || 'Loading…'}</h2>
            {entry && <EntryFacts entry={entry} category={data.category} />}
          </div>
          <button type="button" className="fb-drawer-x" onClick={onClose} aria-label="Close dossier">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="fb-drawer-body">
          {loading ? <Loading />
            : error ? <ErrorState error={error} onRetry={reload} title="We couldn’t open this dossier" />
              : <EntryDossier entry={entry} category={data.category} criteria={data.criteria} files={files} layout="judging" />}
        </div>
      </aside>
    </div>
  )
}

export default function FinalsBracketPage() {
  const { categoryNumber, bracket } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { loading, error, data, reload } = useAsync(
    () => api.get(`/finals/${categoryNumber}/${encodeURIComponent(bracket)}`, { auth: true }),
    [categoryNumber, bracket],
  )

  const [order, setOrder] = useState([])       // entryIds, best first — the list order IS the ranking
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('NotStarted')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [dragIndex, setDragIndex] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState(null)
  const [dossier, setDossier] = useState(null) // entryId whose bidbook is open
  // Did they actually change the order, or are they about to submit the order we handed them?
  // Drives the confirm copy, so it has to be state, not a ref.
  const [reordered, setReordered] = useState(false)
  const dirty = useRef(false)
  const hydrated = useRef(false)

  const finalists = useMemo(() => data?.finalists || [], [data])
  const byId = useMemo(() => new Map(finalists.map((f) => [f.entryId, f])), [finalists])

  // Seed the list from a saved ballot when there is one; otherwise take the order the API returned.
  useEffect(() => {
    if (!data || hydrated.current) return
    hydrated.current = true
    const saved = (data.myRanks || []).slice().sort((a, b) => a.rank - b.rank).map((r) => r.entryId)
    const seeded = saved.length === data.finalists.length && saved.length > 0
    setOrder(seeded ? saved : data.finalists.map((f) => f.entryId))
    setNotes(data.notes || '')
    setStatus(data.myBallotStatus || 'NotStarted')
    setReordered(seeded) // a saved ballot is already a deliberate order; a fresh list is not
  }, [data])

  const readOnly = status === 'Submitted'
  const autoWin = !!data?.singleFinalistAutoWin

  // The list is always a strict 1..N permutation by construction, so the payload can never be
  // rejected for a duplicate or missing rank — the whole class of errors the API guards is designed out.
  const payload = () => ({ ranks: order.map((entryId, i) => ({ entryId, rank: i + 1 })), notes: notes || null })

  async function persist() {
    await api.put(`/finals/${categoryNumber}/${encodeURIComponent(bracket)}/ranks`, payload(), { auth: true })
    dirty.current = false
  }

  useEffect(() => {
    if (!dirty.current || readOnly || autoWin) return
    setSaveState('saving')
    const t = setTimeout(async () => {
      try { await persist(); setSaveState('saved') } catch { setSaveState('error') }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, notes])

  function move(from, to) {
    if (readOnly || to < 0 || to >= order.length || from === to) return
    dirty.current = true
    setReordered(true)
    setBanner(null)
    setOrder((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  async function submit() {
    setSubmitting(true)
    setBanner(null)
    try {
      await persist()
      await api.post(`/finals/${categoryNumber}/${encodeURIComponent(bracket)}/ranks/submit`, undefined, { auth: true })
      setStatus('Submitted')
      setConfirming(false)
      setSaveState('idle')
    } catch (err) {
      setConfirming(false)
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t submit your ranking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAdjudicator(user?.roles)) return <Navigate to="/dashboard" replace />

  // The way out is a breadcrumb above the bracket title rather than a button on the
  // left. `trailing` draws the chevron only when a title follows it — the loading and
  // error shells have none, so there it reads as a plain back link.
  const crumb = (trailing) => (
    <button type="button" className={`fb-crumb${trailing ? '' : ' is-alone'}`} onClick={() => navigate('/dashboard/finals')}>
      {!trailing && <i className="fas fa-arrow-left" aria-hidden="true" />}
      <span>Finals</span>
      {trailing && <i className="fas fa-chevron-right" aria-hidden="true" />}
    </button>
  )

  if (loading) return <Shell><header className="fb-top">{crumb(false)}</header><div className="fb-loadwrap"><Loading /></div></Shell>
  if (error) return <Shell><header className="fb-top">{crumb(false)}</header><div className="fb-loadwrap"><ErrorState error={error} onRetry={reload} title="We couldn’t open this bracket" /></div></Shell>

  const ballot = order.map((id) => byId.get(id)).filter(Boolean)

  return (
    <Shell>
      <header className="fb-top">
        <div className="fb-top-id">
          {crumb(true)}
          <span className="fb-top-cat">#{data.categoryNumber} · {data.categoryName}</span>
          <span className="fb-top-bracket"><i className="fas fa-layer-group" aria-hidden="true" /> {bracketLabel(data.bracket)}</span>
        </div>
        <div className="fb-top-right">
          {!readOnly && !autoWin && saveState !== 'idle' && (
            <span className={`fb-save is-${saveState}`}>
              {saveState === 'saving' && <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</>}
              {saveState === 'saved' && <><i className="fas fa-cloud-arrow-up" aria-hidden="true" /> Draft saved</>}
              {saveState === 'error' && <><i className="fas fa-triangle-exclamation" aria-hidden="true" /> Not saved</>}
            </span>
          )}
          {readOnly && <span className="dash-badge tone-success"><i className="fas fa-lock" aria-hidden="true" /> Ranking submitted</span>}
        </div>
      </header>

      <main className="fb-main">
        {/* A real back button at the head of the page — the crumb in the bar is the trail,
            this is the affordance you reach for before you start ranking. */}
        <button type="button" className="fb-back" onClick={() => navigate('/dashboard/finals')}>
          <i className="fas fa-arrow-left" aria-hidden="true" /> Back to finals
        </button>

        {banner && (
          <div className="dash-banner tone-error fb-banner">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {banner}
          </div>
        )}

        {autoWin ? (
          // The manual: a bracket with a single finalist is declared Grand Winner outright — no
          // interview, no ballot. Say so plainly rather than showing a one-item list to "rank".
          <section className="dash-card fb-auto">
            <div className="fb-auto-icon"><i className="fas fa-trophy" aria-hidden="true" /></div>
            <h1 className="fb-auto-title">Automatic Grand Winner</h1>
            <p className="fb-auto-sub">
              This bracket has only one finalist, so under the Guidelines Manual they are declared
              Grand Winner automatically. There is nothing to rank — no interview or ballot is needed.
            </p>
            <div className="fb-auto-name">
              <span className="fb-rank-badge is-gold">1</span>
              <span>
                <b>{finalists[0]?.title}</b>
                <em>{finalists[0]?.lguName}</em>
              </span>
            </div>
            <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setDossier(finalists[0]?.entryId)}>
              <i className="fas fa-folder-open" aria-hidden="true" /> Review dossier
            </button>
          </section>
        ) : (
          <>
            <div className="fb-head">
              <h1 className="fb-h1">Rank the finalists</h1>
              <p className="fb-sub">
                Drag them into your order of merit, best at the top — or use the arrows.
              </p>
            </div>

            {readOnly && (
              <div className="dash-banner tone-info fb-banner">
                <i className="fas fa-lock" aria-hidden="true" /> Your ranking is submitted and locked. Ask an admin to reopen it if you need to change it.
              </div>
            )}

            <ol className="fb-list">
              {order.map((id, i) => {
                const f = byId.get(id)
                if (!f) return null
                return (
                  <li
                    key={id}
                    className={`fb-item${dragIndex === i ? ' is-dragging' : ''}`}
                    draggable={!readOnly}
                    onDragStart={() => setDragIndex(i)}
                    onDragEnd={() => setDragIndex(null)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragIndex !== null && dragIndex !== i) { move(dragIndex, i); setDragIndex(i) }
                    }}
                  >
                    <span className="fb-ord">{i + 1}</span>

                    <div className="fb-item-body">
                      <span className="fb-item-title">{f.title}</span>
                      <span className="fb-item-lgu">{f.lguName}{f.lguLevel ? ` · ${f.lguLevel}` : ''}</span>
                    </div>

                    <button type="button" className="dash-btn is-ghost is-sm fb-review" onClick={() => setDossier(id)}>
                      <i className="fas fa-folder-open" aria-hidden="true" /> Review
                    </button>

                    {!readOnly && (
                      <span className="fb-moves">
                        <button
                          type="button"
                          className="fb-move"
                          onClick={() => move(i, i - 1)}
                          disabled={i === 0}
                          aria-label={`Move ${f.title} up to rank ${i}`}
                        >
                          <i className="fas fa-chevron-up" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="fb-move"
                          onClick={() => move(i, i + 1)}
                          disabled={i === order.length - 1}
                          aria-label={`Move ${f.title} down to rank ${i + 2}`}
                        >
                          <i className="fas fa-chevron-down" aria-hidden="true" />
                        </button>
                        <i className="fas fa-grip-vertical fb-grip" aria-hidden="true" title="Drag to reorder" />
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>

            <section className="dash-card dash-card-pad fb-notes">
              <label className="dash-label" htmlFor="fb-notes">
                Interview notes <span className="fb-optional">optional — private to you</span>
              </label>
              <textarea
                id="fb-notes"
                className="dash-input"
                rows={3}
                placeholder="Anything from the online interview that informed your ranking…"
                value={notes}
                disabled={readOnly}
                onChange={(e) => { dirty.current = true; setNotes(e.target.value) }}
              />
            </section>

            {/* Sits below the list, not above it: the cards are the task, this is the fine print you
                want in view at the moment you commit. Said once, never on the cards themselves. */}
            <p className="fb-caveat">
              <i className="fas fa-circle-info" aria-hidden="true" />
              <span>
                <b>This is your ballot, not the result.</b> Every adjudicator ranks independently, and no
                one else sees yours. The Grand Winner is the finalist with the lowest average position
                across all of them — so it may not be your first choice.
              </span>
            </p>

            {!readOnly && (
              <div className="fb-submitbar">
                <p className="fb-submitnote">
                  <i className="fas fa-lock" aria-hidden="true" />
                  Your ranking locks once submitted.
                </p>
                <button type="button" className="dash-btn is-primary" onClick={() => setConfirming(true)}>
                  <i className="fas fa-check" aria-hidden="true" /> Submit ranking
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {confirming && (
        <div className="fb-modal" role="dialog" aria-modal="true" aria-label="Confirm ranking" onMouseDown={() => !submitting && setConfirming(false)}>
          <div className="fb-modal-card" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="fb-modal-title">Submit your ranking?</h3>
            <p className="fb-modal-sub">
              {reordered
                ? 'Your ballot locks once submitted — only an admin can reopen it.'
                : 'You haven’t changed the order. Confirm this really is your intended ranking — it locks once submitted.'}
            </p>

            {/* A read-back of the ballot, in full. No placements: they aren't decided here. */}
            <ol className="fb-review">
              {ballot.map((f, i) => (
                <li key={f.entryId}>
                  <span className="fb-ord is-sm">{i + 1}</span>
                  <span className="fb-review-title">{f.title}</span>
                </li>
              ))}
            </ol>

            <div className="fb-modal-foot">
              <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setConfirming(false)} disabled={submitting}>
                Keep editing
              </button>
              <button type="button" className="dash-btn is-primary is-sm" onClick={submit} disabled={submitting}>
                {submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Submitting…</> : 'Submit ranking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dossier && <Dossier entryId={dossier} onClose={() => setDossier(null)} />}
    </Shell>
  )
}

const FB_CSS = `
  .fb { min-height: 100vh; background: var(--off-white); }
  .fb-top { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 16px; padding: 12px 24px; background: var(--white); border-bottom: 1px solid var(--gray-200); }
  .fb-crumb { display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; background: none; border: none; cursor: pointer; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gray-600); padding: 0; margin-bottom: 4px; transition: var(--transition-fast); white-space: nowrap; }
  .fb-crumb i { font-size: 0.58rem; color: var(--gray-400); transition: var(--transition-fast); }
  .fb-crumb:hover, .fb-crumb:hover i { color: var(--gold-dark); }
  .fb-crumb:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 3px; }
  .fb-crumb.is-alone { font-size: 0.76rem; margin-bottom: 0; padding: 6px 0; }
  .fb-back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; background: none; border: 1px solid var(--gray-200); border-radius: 999px; color: var(--gray-600); font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; padding: 8px 15px; cursor: pointer; transition: var(--transition-fast); }
  .fb-back i { font-size: 0.75rem; transition: var(--transition-fast); }
  .fb-back:hover { border-color: var(--navy); color: var(--navy); background: var(--white); }
  .fb-back:hover i { transform: translateX(-2px); }
  .fb-top-id { display: flex; flex-direction: column; min-width: 0; }
  .fb-top-cat { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fb-top-bracket { display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; color: var(--gray-600); font-family: var(--font-heading); font-weight: 600; }
  .fb-top-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .fb-save { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 0.75rem; font-weight: 700; color: var(--gray-600); }
  .fb-save.is-saved { color: #15803D; }
  .fb-save.is-error { color: #B91C1C; }
  .fb-loadwrap { padding: 60px 24px; }

  .fb-main { max-width: 880px; margin: 0 auto; padding: 28px 24px 80px; }
  .fb-banner { margin-bottom: 18px; }
  .fb-head { margin-bottom: 20px; }
  .fb-h1 { font-family: var(--font-heading); font-size: 1.6rem; font-weight: 800; color: var(--navy); }
  .fb-sub { color: var(--gray-600); font-size: 0.92rem; line-height: 1.6; margin-top: 6px; max-width: 64ch; }
  .fb-sub b { color: var(--navy); }
  /* Fine print, not a callout — no bar, no tint, nothing competing with the cards above it. */
  .fb-caveat { display: flex; gap: 10px; align-items: flex-start; max-width: 70ch; margin: 0 2px 18px; color: var(--gray-600); font-size: 0.84rem; line-height: 1.65; }
  .fb-caveat i { color: var(--gray-400); margin-top: 4px; flex-shrink: 0; }
  .fb-caveat b { color: var(--navy); font-weight: 700; }

  /* The ranked list — order IS the ranking, so a valid 1..N permutation is impossible to get wrong. */
  .fb-list { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 0 0 22px; padding: 0; }
  .fb-item { display: flex; align-items: center; gap: 16px; padding: 16px 18px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: 0 1px 2px rgba(15,25,46,0.04); transition: var(--transition-fast); cursor: grab; }
  .fb-item:hover { border-color: var(--gold); box-shadow: 0 4px 14px rgba(15,25,46,0.08); }
  .fb-item.is-dragging { opacity: 0.55; cursor: grabbing; border-style: dashed; border-color: var(--gold-dark); }
  /* The rank IS the value being set, so it carries the card — big, tabular, in the brand's primary
     gold. Every ordinal is gold *equally*: what implied a podium before was gold on #1 alone, not
     the hue itself. Uniform means no row is privileged, which is exactly true of a ballot.
     gold-dark (not gold) because #C8A84B on white is ~2.3:1 — unreadable; gold-dark is 3.9:1, which
     clears AA for large text, so both sizes below stay in large-text territory (>=19px bold). */
  .fb-ord { flex: 0 0 auto; min-width: 44px; text-align: center; font-family: var(--font-heading); font-weight: 800; font-size: 2rem; line-height: 1; color: var(--gold-dark); font-variant-numeric: tabular-nums; letter-spacing: -0.04em; }
  .fb-ord.is-sm { min-width: 26px; font-size: 1.2rem; letter-spacing: -0.02em; }

  /* Kept for the single-finalist auto-win, where the outcome IS decided and gold is earned. */
  .fb-rank-badge { flex-shrink: 0; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; font-family: var(--font-heading); font-weight: 800; font-size: 1rem; color: var(--gray-600); background: var(--gray-100); border: 1px solid var(--gray-200); }
  .fb-rank-badge.is-gold { color: var(--navy); background: linear-gradient(135deg, var(--gold-light), var(--gold)); border-color: var(--gold-dark); }

  .fb-item-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .fb-item-title { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.95rem; }
  .fb-item-lgu { color: var(--gray-600); font-size: 0.8rem; }

  .fb-review { flex-shrink: 0; }
  .fb-moves { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
  .fb-move { width: 30px; height: 28px; display: grid; place-items: center; background: none; border: 1px solid transparent; border-radius: 7px; cursor: pointer; color: var(--gray-400); }
  .fb-move:hover:not(:disabled) { color: var(--navy); background: var(--gray-100); border-color: var(--gray-200); }
  .fb-move:disabled { opacity: 0.3; cursor: not-allowed; }
  .fb-grip { color: var(--gray-300); margin-left: 4px; cursor: grab; }

  .fb-notes { margin-bottom: 20px; }
  .fb-optional { font-weight: 500; color: var(--gray-400); text-transform: none; letter-spacing: 0; }
  .fb-notes textarea { resize: vertical; }

  .fb-submitbar { position: sticky; bottom: 0; display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: 0 -6px 24px rgba(15,25,46,0.08); }
  .fb-submitnote { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--gray-600); margin: 0; }
  .fb-submitbar .dash-btn { margin-left: auto; }

  /* Single-finalist bracket → automatic Grand Winner (no ballot). */
  .fb-auto { text-align: center; padding: 42px 28px; }
  .fb-auto-icon { width: 64px; height: 64px; margin: 0 auto 16px; display: grid; place-items: center; border-radius: 50%; font-size: 1.6rem; color: var(--navy); background: linear-gradient(135deg, var(--gold-light), var(--gold)); }
  .fb-auto-title { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800; color: var(--navy); }
  .fb-auto-sub { color: var(--gray-600); font-size: 0.92rem; line-height: 1.6; max-width: 52ch; margin: 8px auto 20px; }
  .fb-auto-name { display: inline-flex; align-items: center; gap: 12px; text-align: left; padding: 12px 18px; border: 1px solid var(--gold); background: rgba(200,168,75,0.08); border-radius: var(--radius-md); margin-bottom: 16px; }
  .fb-auto-name b { display: block; font-family: var(--font-heading); color: var(--navy); font-size: 0.98rem; }
  .fb-auto-name em { display: block; font-style: normal; color: var(--gray-600); font-size: 0.8rem; }

  /* Confirm modal — a plain read-back of the ballot, so they submit what they meant to. */
  .fb-modal { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 20px; background: rgba(15,25,46,0.55); backdrop-filter: blur(2px); }
  .fb-modal-card { width: 100%; max-width: 480px; background: var(--white); border-radius: var(--radius-md); box-shadow: 0 30px 70px rgba(15,25,46,0.4); padding: 24px; }
  .fb-modal-title { font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800; color: var(--navy); }
  .fb-modal-sub { color: var(--gray-600); font-size: 0.86rem; line-height: 1.55; margin-top: 6px; }
  .fb-review { list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-direction: column; }
  .fb-review li { display: flex; align-items: center; gap: 12px; padding: 9px 2px; border-top: 1px solid var(--gray-100); }
  .fb-review li:first-child { border-top: none; }
  .fb-review-title { font-family: var(--font-heading); font-size: 0.88rem; font-weight: 600; color: var(--navy); }
  .fb-modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

  /* Dossier drawer — the bidbook the ranking is actually made on. */
  .fb-drawer { position: fixed; inset: 0; z-index: 400; display: flex; justify-content: flex-end; background: rgba(15,25,46,0.5); backdrop-filter: blur(2px); }
  .fb-drawer-panel { width: min(680px, 100%); height: 100%; display: flex; flex-direction: column; background: var(--white); box-shadow: -20px 0 60px rgba(15,25,46,0.3); animation: fb-slide 0.18s ease-out; }
  @keyframes fb-slide { from { transform: translateX(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
  .fb-drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 24px; border-bottom: 1px solid var(--gray-200); }
  .fb-drawer-title { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; color: var(--navy); margin-top: 2px; }
  .fb-drawer-x { background: none; border: none; cursor: pointer; color: var(--gray-400); font-size: 1.05rem; padding: 4px 8px; border-radius: 6px; line-height: 1; }
  .fb-drawer-x:hover { color: var(--navy); background: var(--gray-100); }
  .fb-drawer-body { flex: 1; overflow-y: auto; padding: 20px 24px 40px; background: var(--off-white); }

  @media (max-width: 640px) {
    .fb-item { flex-wrap: wrap; }
    .fb-review { order: 3; }
    /* Drop the category/bracket detail, but never the crumb — it's the only way out. */
    .fb-top-cat, .fb-top-bracket { display: none; }
    .fb-crumb { margin-bottom: 0; }
    .fb-submitbar { flex-direction: column; align-items: stretch; }
    .fb-submitbar .dash-btn { margin-left: 0; }
  }
`

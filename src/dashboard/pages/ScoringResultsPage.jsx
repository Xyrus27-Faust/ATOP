import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import { formatDate, formatRating } from '@/lib/pearlAwards'

const LEVEL_ORDER = ['All', 'Province', 'HUC', 'ComponentCity', 'Municipality']
const bracketRank = (b) => { const i = LEVEL_ORDER.indexOf(b); return i === -1 ? 99 : i }
const fmt = (n) => (n == null ? '—' : Number(n).toFixed(2))

// A total this far from the group's median is flagged as a possible outlier.
const OUTLIER_DELTA = 12
function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Per-assessor score matrix for one entry: rows = assessors, columns = each criterion (0–5) + total.
function AssessorMatrix({ data, entryId, entryTitle, finalized, onReopened }) {
  const totals = data.assessors.map((a) => a.total)
  const med = median(totals)
  const [asking, setAsking] = useState(null)   // assessorUserId awaiting confirmation
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  async function reopen(assessor) {
    setBusy(assessor.assessorUserId)
    setError(null)
    try {
      // No body, like finalize: the endpoint takes none.
      await api.post(
        `/admin/scoring/entries/${entryId}/assessors/${assessor.assessorUserId}/reopen`,
        undefined, { auth: true })
      setAsking(null)
      await onReopened()
    } catch (e) {
      setError(e?.message || 'Could not reopen that scoresheet.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sr-bd">
      <div className="sr-bd-wrap">
        <table className="sr-bd-table">
          <thead>
            <tr>
              <th className="sr-bd-name">Assessor</th>
              {data.criteria.map((c, i) => <th key={c.criterionId} title={c.name}>C{i + 1}</th>)}
              <th className="sr-bd-total">Total</th>
              <th className="sr-bd-act" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {data.assessors.map((a) => {
              const byCrit = new Map(a.scores.map((s) => [s.criterionId, s.rating]))
              const diverges = totals.length >= 3 && Math.abs(a.total - med) >= OUTLIER_DELTA
              const above = a.total > med
              return (
                <tr key={a.assessorUserId}>
                  <td className="sr-bd-name">
                    {a.name}
                    {a.status !== 'Submitted' && <span className="sr-bd-status">{a.status}</span>}
                  </td>
                  {data.criteria.map((c) => (
                    <td key={c.criterionId}>{byCrit.has(c.criterionId) ? formatRating(byCrit.get(c.criterionId)) : '—'}</td>
                  ))}
                  <td className="sr-bd-total">
                    {Math.round(a.total)}
                    {diverges && (
                      <i
                        className={`fas fa-arrow-${above ? 'up' : 'down'} sr-bd-div`}
                        title={`Notably ${above ? 'above' : 'below'} the other assessors`}
                        aria-hidden="true"
                      />
                    )}
                  </td>

                  {/* Only a submitted sheet is locked, so only a submitted sheet can be reopened.
                      A finalized category is closed to everyone, including this. */}
                  <td className="sr-bd-act">
                    {a.status === 'Submitted' && !finalized && (
                      asking === a.assessorUserId ? (
                        <span className="sr-bd-confirm">
                          <span className="sr-bd-q">Let {a.name.split(' ')[0]} edit this again?</span>
                          <button
                            type="button"
                            className="dash-btn is-primary sr-bd-btn"
                            disabled={busy === a.assessorUserId}
                            onClick={() => reopen(a)}
                          >
                            {busy === a.assessorUserId ? 'Reopening…' : 'Reopen'}
                          </button>
                          <button type="button" className="dash-btn sr-bd-btn" onClick={() => setAsking(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="dash-btn sr-bd-btn"
                          onClick={() => { setError(null); setAsking(a.assessorUserId) }}
                          title={`Unlock ${a.name}'s scoresheet for ${entryTitle}`}
                        >
                          <i className="fas fa-lock-open" aria-hidden="true" /> Reopen
                        </button>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {error && (
        <div className="sr-bd-msg is-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
        </div>
      )}

      <div className="sr-bd-legend">
        {data.criteria.map((c, i) => <span key={c.criterionId}><b>C{i + 1}</b> {c.name}</span>)}
        <span className="sr-bd-legend-note">
          <i className="fas fa-arrow-up sr-bd-div" aria-hidden="true" /><i className="fas fa-arrow-down sr-bd-div" aria-hidden="true" /> notably above / below the group
        </span>
      </div>

      <AssessorFeedback assessors={data.assessors} />
    </div>
  )
}

// The assessors' private notes on this entry. Admin-only and one-way — nothing here is ever shown
// to the entrant, so the header says so, since this is the one screen where the text is readable.
function AssessorFeedback({ assessors }) {
  const notes = assessors.filter((a) => a.feedback)
  if (notes.length === 0) return null

  return (
    <div className="sr-bd-fb">
      <div className="sr-bd-fb-title">
        <i className="fas fa-comment-dots" aria-hidden="true" /> Assessor feedback
        <span className="sr-bd-fb-priv"><i className="fas fa-eye-slash" aria-hidden="true" /> not shown to the entrant</span>
      </div>
      {notes.map((a) => (
        <div key={a.assessorUserId} className="sr-bd-fb-note">
          <span className="sr-bd-fb-who">{a.name}</span>
          <p>{a.feedback}</p>
        </div>
      ))}
    </div>
  )
}

// A small click-to-open info popover. Portaled to <body> so the table's overflow container
// can't clip it; closes on outside click, Escape, or any scroll/resize.
function InfoPopover({ title, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const WIDTH = 276

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(r.left, window.innerWidth - WIDTH - 12)) })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onMove = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  return (
    <>
      <button type="button" ref={btnRef} className="sr-info-btn" aria-label={title} onClick={toggle}>
        <i className="fas fa-circle-info" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={popRef} className="sr-info-pop" role="tooltip" style={{ top: pos.top, left: pos.left, width: WIDTH }}>
          <span className="sr-info-title">{title}</span>
          <p>{children}</p>
        </div>,
        document.body,
      )}
    </>
  )
}

export default function ScoringResultsPage() {
  const { user } = useAuth()
  const [cat, setCat] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [banner, setBanner] = useState(null) // { tone, text }
  const [missing, setMissing] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set()) // entryIds whose breakdown is open
  const [breakdowns, setBreakdowns] = useState({}) // entryId -> { loading | error | data }

  const catalogQ = useAsync(() => api.get('/award-categories/'), [])

  // The effective category defaults to the first one until the admin picks another — derived, so no
  // state-sync effect is needed.
  const categories = catalogQ.data?.categories || []
  const selected = cat ?? categories[0]?.number ?? null

  const resultsQ = useAsync(
    () => (selected == null ? Promise.resolve(null) : api.get(`/admin/scoring/${selected}/results`, { auth: true })),
    [selected],
  )

  const results = resultsQ.data
  const brackets = useMemo(() => {
    if (!results) return []
    const groups = new Map()
    for (const r of results.rows) {
      if (!groups.has(r.bracket)) groups.set(r.bracket, [])
      groups.get(r.bracket).push(r)
    }
    return [...groups.entries()]
      .sort((a, b) => bracketRank(a[0]) - bracketRank(b[0]))
      .map(([bracket, rows]) => ({ bracket, rows: rows.slice().sort((x, y) => (x.rank ?? 1e9) - (y.rank ?? 1e9)) }))
  }, [results])

  if (!isAdmin(user?.roles)) return <Navigate to="/dashboard" replace />
  if (catalogQ.loading) return <Loading />
  if (catalogQ.error) return <ErrorState error={catalogQ.error} onRetry={catalogQ.reload} />

  function onPickCategory(n) {
    setCat(Number(n))
    setBanner(null)
    setMissing(null)
    setConfirming(false)
    setExpanded(new Set())
  }

  async function refreshBreakdown(entryId) {
    const data = await api.get(`/admin/scoring/entries/${entryId}/breakdown`, { auth: true })
    setBreakdowns((b) => ({ ...b, [entryId]: { data } }))
    // The entry's own totals and its projected-finalist standing move with it.
    await resultsQ.reload()
  }

  async function loadBreakdown(entryId) {
    if (breakdowns[entryId]?.data || breakdowns[entryId]?.loading) return
    setBreakdowns((b) => ({ ...b, [entryId]: { loading: true } }))
    try {
      const data = await api.get(`/admin/scoring/entries/${entryId}/breakdown`, { auth: true })
      setBreakdowns((b) => ({ ...b, [entryId]: { data } }))
    } catch (e) {
      setBreakdowns((b) => ({ ...b, [entryId]: { error: e?.message || 'Could not load the assessor scores.' } }))
    }
  }

  function toggleRow(entryId) {
    const isOpen = expanded.has(entryId)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(entryId)
      else next.add(entryId)
      return next
    })
    if (!isOpen) loadBreakdown(entryId)
  }

  async function finalize() {
    setFinalizing(true); setBanner(null); setMissing(null)
    try {
      await api.post(`/admin/scoring/${selected}/finalize`, undefined, { auth: true })
      setConfirming(false)
      await resultsQ.reload()
      setBanner({ tone: 'success', text: 'Scoring finalized — finalists are set for this category.' })
    } catch (e) {
      setConfirming(false)
      if (e instanceof ApiError && e.status === 409 && e.raw?.missing) {
        setMissing(e.raw.missing)
        setBanner({ tone: 'warn', text: e.raw.detail || e.message })
      } else {
        setBanner({ tone: 'error', text: e?.message || 'We couldn’t finalize this category.' })
      }
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Admin · Scoring</span>
          <h1 className="dash-h1">Scoring results</h1>
          <p className="dash-sub">
            Review the 3PIC tally per category and close scoring to set finalists. Within each bracket,
            entries are ranked by highest average score (head-to-head only breaks exact ties) and must
            clear the score floor. Finalize is re-runnable.
          </p>
        </div>
      </div>

      <div className="sr-pick">
        <label className="dash-label" htmlFor="sr-cat">Category</label>
        <select id="sr-cat" className="dash-select" value={selected ?? ''} onChange={(e) => onPickCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c.number} value={c.number}>#{c.number} · {c.name}</option>
          ))}
        </select>
      </div>

      {resultsQ.loading ? (
        <Loading />
      ) : resultsQ.error ? (
        <ErrorState error={resultsQ.error} onRetry={resultsQ.reload} />
      ) : results ? (
        <>
          {/* Status + finalize action */}
          <div className="dash-card sr-action">
            <div className="sr-action-info">
              <div className="sr-status-row">
                {results.finalized ? (
                  <span className="dash-badge tone-success"><i className="fas fa-lock" aria-hidden="true" /> Finalized</span>
                ) : results.complete ? (
                  <span className="dash-badge tone-progress"><i className="fas fa-circle-check" aria-hidden="true" /> Ready to finalize</span>
                ) : (
                  <span className="dash-badge tone-warn"><i className="fas fa-hourglass-half" aria-hidden="true" /> Scoring in progress</span>
                )}
                {results.finalized && results.finalizedAt && (
                  <span className="sr-finalized-at">Finalized {formatDate(results.finalizedAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                )}
              </div>
              <p className="sr-rules">
                Top <b>{results.maxFinalists}</b> per bracket · floor <b>≥ {results.finalistThreshold}</b> mean · ranked by highest average (ties admitted)
              </p>
            </div>

            <div className="sr-action-btns">
              {confirming ? (
                <div className="sr-confirm">
                  <span className="sr-confirm-q">{results.finalized ? 'Re-run finalize?' : 'Finalize this category?'}</span>
                  <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setConfirming(false)} disabled={finalizing}>Cancel</button>
                  <button type="button" className="dash-btn is-primary is-sm" onClick={finalize} disabled={finalizing}>
                    {finalizing ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Working…</> : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="dash-btn is-primary"
                  disabled={!results.complete || results.rows.length === 0}
                  onClick={() => setConfirming(true)}
                  title={results.complete ? 'Compute finalists and freeze scoring' : 'All assigned scoresheets must be submitted first'}
                >
                  <i className="fas fa-flag-checkered" aria-hidden="true" /> {results.finalized ? 'Re-finalize' : 'Finalize category'}
                </button>
              )}
            </div>
          </div>

          {banner && (
            <div className={`dash-banner tone-${banner.tone}`} style={{ marginTop: 14 }}>
              <i className={`fas ${banner.tone === 'success' ? 'fa-circle-check' : banner.tone === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-exclamation'}`} aria-hidden="true" />
              <span>{banner.text}</span>
            </div>
          )}

          {missing && missing.length > 0 && (
            <div className="dash-card sr-missing">
              <div className="sc-section-title" style={{ marginBottom: 10 }}><i className="fas fa-user-clock" aria-hidden="true" /> Awaiting scoresheets</div>
              <ul className="sr-missing-list">
                {missing.map((m, i) => (
                  <li key={`${m.entryId}-${m.assessorUserId}-${i}`}>
                    <span className="sr-missing-name">{m.assessorName || m.assessorUserId}</span>
                    <span className="sr-missing-entry">{m.title}</span>
                  </li>
                ))}
              </ul>
              <p className="dash-help" style={{ marginTop: 10 }}>Have these assessors submit, or enter their scores via override, then finalize.</p>
            </div>
          )}

          {results.rows.length === 0 ? (
            <div className="dash-card dash-empty">
              <div className="dash-empty-icon"><i className="fas fa-ranking-star" aria-hidden="true" /></div>
              <h3>Nothing to tally yet</h3>
              <p>No validated entries in this category have been scored. Results appear once scoring is under way.</p>
            </div>
          ) : (
            brackets.map(({ bracket, rows }) => (
              <div key={bracket} className="sr-bracket">
                <div className="sr-bracket-head">
                  <span className="sr-bracket-name">{bracket === 'All' ? 'All entries' : bracket}</span>
                  <span className="sr-bracket-count">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                <div className="dash-card sr-tablecard">
                  <div className="sr-scroll">
                    <table className="sr-table">
                      <thead>
                        <tr>
                          <th className="sr-th-rank">Rank</th>
                          <th>Entry</th>
                          <th className="sr-th-num">Mean</th>
                          <th className="sr-th-num">Wins <InfoPopover title="Wins — head-to-head">How many other entries in this bracket this one beat one-on-one — an entry beats another when more than half the assessors scored it higher. Entries are ranked by average score; wins only break a tie between entries with an exactly equal average.</InfoPopover></th>
                          <th className="sr-th-num">Assessors</th>
                          <th>Outcome</th>
                          <th aria-hidden="true" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const isFinalist = results.finalized ? r.status === 'Finalist' : r.projectedFinalist
                          const short = r.submittedAssessments < r.assignedAssessors
                          const isOpen = expanded.has(r.entryId)
                          const bd = breakdowns[r.entryId]
                          return (
                            <Fragment key={r.entryId}>
                              <tr
                                className={`sr-row${isFinalist ? ' is-finalist' : ''}${isOpen ? ' is-open' : ''}`}
                                onClick={() => toggleRow(r.entryId)}
                                aria-expanded={isOpen}
                                title="Show each assessor's scores"
                              >
                                <td className="sr-rank">{r.rank ?? '—'}</td>
                                <td className="sr-entry">
                                  <span className="sr-title">{isFinalist && <i className="fas fa-trophy sr-trophy" aria-hidden="true" />}{r.title}</span>
                                  <span className="sr-lgu">{r.lguName}</span>
                                </td>
                                <td className="sr-num sr-mean">{fmt(r.mean)}</td>
                                <td className="sr-num">{r.copeland ?? '—'}</td>
                                <td className={`sr-num${short ? ' is-short' : ''}`}>{r.submittedAssessments}/{r.assignedAssessors}</td>
                                <td>
                                  {results.finalized ? (
                                    <StatusBadge status={r.status} />
                                  ) : isFinalist ? (
                                    <span className="dash-badge tone-progress"><i className="fas fa-trophy" aria-hidden="true" /> Projected finalist</span>
                                  ) : (
                                    <span className="sr-dash">—</span>
                                  )}
                                </td>
                                <td className="sr-caretcell"><i className={`fas fa-chevron-down sr-caret${isOpen ? ' is-open' : ''}`} aria-hidden="true" /></td>
                              </tr>
                              {isOpen && (
                                <tr className="sr-detail-row">
                                  <td colSpan={7}>
                                    {bd?.loading ? (
                                      <div className="sr-bd-msg"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading assessor scores…</div>
                                    ) : bd?.error ? (
                                      <div className="sr-bd-msg is-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {bd.error}</div>
                                    ) : bd?.data ? (
                                      bd.data.assessors.length === 0
                                        ? <div className="sr-bd-msg">No scoresheets yet for this entry.</div>
                                        : (
                                          <AssessorMatrix
                                            data={bd.data}
                                            entryId={r.entryId}
                                            entryTitle={r.title}
                                            finalized={results.finalized}
                                            onReopened={() => refreshBreakdown(r.entryId)}
                                          />
                                        )
                                    ) : null}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      ) : null}

      <style>{`
        .sr-pick { display: flex; flex-direction: column; gap: 7px; max-width: 460px; margin-bottom: 20px; }
        .sr-pick .dash-select { width: 100%; }

        .sr-action { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px 20px; }
        .sr-status-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .sr-finalized-at { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 600; color: var(--gray-600); }
        .sr-rules { margin-top: 9px; color: var(--gray-600); font-size: 0.85rem; }
        .sr-rules b { color: var(--navy); font-family: var(--font-heading); }
        .sr-confirm { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .sr-confirm-q { font-family: var(--font-heading); font-size: 0.84rem; font-weight: 700; color: var(--navy); }

        .sr-missing { padding: 16px 20px; margin-top: 14px; }
        .sc-section-title { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--navy); display: flex; align-items: center; gap: 9px; }
        .sc-section-title i { color: var(--gold-dark); }
        .sr-missing-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
        .sr-missing-list li { display: flex; gap: 12px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid var(--gray-100); font-size: 0.88rem; }
        .sr-missing-list li:last-child { border-bottom: none; }
        .sr-missing-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
        .sr-missing-entry { color: var(--gray-600); }

        .sr-bracket { margin-top: 22px; }
        .sr-bracket-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
        .sr-bracket-name { font-family: var(--font-heading); font-weight: 800; font-size: 0.92rem; color: var(--navy); }
        .sr-bracket-count { font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gray-400); }
        .sr-tablecard { padding: 0; overflow: hidden; }
        .sr-scroll { overflow-x: auto; }
        .sr-table { width: 100%; border-collapse: collapse; }
        .sr-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 11px 16px; text-align: left; white-space: nowrap; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
        .sr-th-rank { width: 64px; }
        .sr-table thead th.sr-th-num { text-align: right; }
        .sr-info-btn { background: none; border: none; padding: 0 0 0 5px; cursor: pointer; color: var(--gray-400); font-size: 0.82rem; vertical-align: middle; line-height: 1; }
        .sr-info-btn:hover { color: var(--gold-dark); }
        .sr-info-pop { position: fixed; z-index: 100; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: 0 18px 44px rgba(15,25,46,0.18); padding: 12px 14px; }
        .sr-info-title { display: block; font-family: var(--font-heading); font-weight: 800; font-size: 0.78rem; letter-spacing: 0; text-transform: none; color: var(--navy); margin-bottom: 5px; }
        .sr-info-pop p { font-family: var(--font-body); font-size: 0.82rem; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--gray-600); line-height: 1.5; }
        .sr-table td { padding: 12px 16px; vertical-align: middle; border-bottom: 1px solid var(--gray-100); }
        .sr-table tbody tr:last-child td { border-bottom: none; }
        .sr-row.is-finalist { background: rgba(200,168,75,0.07); }
        .sr-rank { font-family: var(--font-heading); font-weight: 800; font-size: 1rem; color: var(--navy); }
        .sr-entry { min-width: 200px; }
        .sr-title { display: block; font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; }
        .sr-trophy { color: var(--gold-dark); margin-right: 7px; }
        .sr-lgu { display: block; color: var(--gray-600); font-size: 0.8rem; margin-top: 1px; }
        .sr-num { text-align: right; font-family: var(--font-heading); font-weight: 600; font-size: 0.88rem; color: var(--navy); white-space: nowrap; }
        .sr-mean { font-weight: 800; }
        .sr-num.is-short { color: #C2410C; }
        .sr-dash { color: var(--gray-300); }

        /* Expandable row → per-assessor breakdown */
        .sr-row { cursor: pointer; }
        .sr-caretcell { width: 40px; text-align: right; }
        .sr-caret { color: var(--gray-300); font-size: 0.74rem; transition: transform 0.15s ease; }
        .sr-row:hover .sr-caret { color: var(--gold-dark); }
        .sr-caret.is-open { transform: rotate(180deg); color: var(--gold-dark); }
        .sr-row.is-open { background: rgba(200,168,75,0.06); }
        .sr-row.is-open td { border-bottom-color: transparent; }
        .sr-detail-row > td { padding: 0; background: var(--off-white); border-bottom: 1px solid var(--gray-200); }
        .sr-bd { padding: 16px; }
        .sr-bd-wrap { overflow-x: auto; }
        .sr-bd-table { width: 100%; border-collapse: collapse; background: var(--white); border: 1px solid var(--gray-200); }
        .sr-detail-row .sr-bd-table td.sr-bd-name, .sr-detail-row .sr-bd-table th.sr-bd-name { width: 30%; }
        /* Scoped to .sr-detail-row so the outer .sr-table descendant rules can't leak into this nested table. */
        .sr-detail-row .sr-bd-table th,
        .sr-detail-row .sr-bd-table td { padding: 9px 16px; text-align: center; vertical-align: middle; white-space: nowrap; border: 0; border-bottom: 1px solid var(--gray-100); font-family: var(--font-heading); }
        .sr-detail-row .sr-bd-table th { background: var(--off-white); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gray-600); border-bottom: 1px solid var(--gray-200); }
        .sr-detail-row .sr-bd-table td { font-size: 0.9rem; font-weight: 700; color: var(--navy); }
        .sr-detail-row .sr-bd-table tbody tr:last-child td { border-bottom: 0; }
        .sr-detail-row .sr-bd-table th.sr-bd-name,
        .sr-detail-row .sr-bd-table td.sr-bd-name { text-align: left; }
        .sr-detail-row .sr-bd-table th.sr-bd-total,
        .sr-detail-row .sr-bd-table td.sr-bd-total { border-left: 1px solid var(--gray-200); }
        .sr-detail-row .sr-bd-table td.sr-bd-total { font-size: 0.95rem; font-weight: 800; }
        .sr-bd-div { margin-left: 7px; font-size: 0.66rem; color: var(--gold-dark); }
        .sr-bd-status { margin-left: 8px; font-family: var(--font-heading); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #C2410C; background: #FFF7ED; border: 1px solid #FED7AA; padding: 1px 7px; border-radius: 999px; }
        .sr-bd-act { text-align: right; white-space: nowrap; }
        .sr-bd-btn { padding: 4px 10px; font-size: 0.76rem; }
        .sr-bd-confirm { display: inline-flex; align-items: center; gap: 8px; }
        .sr-bd-q { font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--navy); }
        .sr-bd-legend { display: flex; flex-wrap: wrap; gap: 5px 16px; margin-top: 12px; font-family: var(--font-body); font-size: 0.74rem; color: var(--gray-600); }
        .sr-bd-legend b { color: var(--gold-dark); font-family: var(--font-heading); margin-right: 2px; }
        .sr-bd-legend-note { display: inline-flex; align-items: center; gap: 4px; color: var(--gray-600); }
        .sr-bd-msg { display: flex; align-items: center; gap: 8px; padding: 16px; font-family: var(--font-body); font-size: 0.86rem; color: var(--gray-600); }
        .sr-bd-msg.is-error { color: #B91C1C; }

        /* Assessors' private notes, under the score matrix. Prose, not a table cell — it's read,
           not compared, so it gets line length and leading rather than tabular numerals. */
        .sr-bd-fb { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--gray-200); }
        .sr-bd-fb-title { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--navy); }
        .sr-bd-fb-title > i { color: var(--gold-dark); }
        .sr-bd-fb-priv { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-body); font-size: 0.7rem; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--gray-600); background: var(--gray-100); border: 1px solid var(--gray-200); border-radius: 999px; padding: 1px 9px; }
        .sr-bd-fb-note { margin-top: 12px; padding: 11px 14px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
        .sr-bd-fb-who { display: block; font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--navy); margin-bottom: 4px; }
        .sr-bd-fb-note p { font-family: var(--font-body); font-size: 0.86rem; line-height: 1.6; color: var(--text-body); white-space: pre-wrap; }

        @media (max-width: 620px) { .sr-action { flex-direction: column; align-items: stretch; } }
      `}</style>
    </>
  )
}

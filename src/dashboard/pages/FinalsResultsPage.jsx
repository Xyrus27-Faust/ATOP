import { Fragment, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { bracketLabel, placementMeta, formatDate } from '@/lib/pearlAwards'

const LEVEL_ORDER = ['All', 'Province', 'HUC', 'ComponentCity', 'Municipality']
const bracketRank = (b) => { const i = LEVEL_ORDER.indexOf(b); return i === -1 ? 99 : i }
// Average rank is the headline number — 2 dp is enough and reads cleanly (e.g. 1.33).
const avg = (n) => (n == null ? '—' : Number(n).toFixed(2))

// Each adjudicator's position for one finalist — the transparency view behind the average.
function BallotBreakdown({ state }) {
  if (state?.loading) return <div className="fr-bd fr-bd-note"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading ballots…</div>
  if (state?.error) return <div className="fr-bd fr-bd-note fr-bd-err">{state.error}</div>
  const data = state?.data
  if (!data) return null

  return (
    <div className="fr-bd">
      {data.adjudicators.length === 0 ? (
        <p className="fr-bd-note">No ballots yet for this bracket.</p>
      ) : (
        <ul className="fr-bd-list">
          {data.adjudicators.map((a) => (
            <li key={a.adjudicatorUserId}>
              <span className="fr-bd-name">{a.name}</span>
              {a.status !== 'Submitted' && <span className="fr-bd-status">{a.status}</span>}
              <span className="fr-bd-rank">{a.rank == null ? '—' : `#${a.rank}`}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="fr-bd-legend">The position each adjudicator gave this finalist. Their average is the rank that decides the placement.</p>
    </div>
  )
}

export default function FinalsResultsPage() {
  const { user } = useAuth()
  const [cat, setCat] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [banner, setBanner] = useState(null)   // { tone, text }
  const [missing, setMissing] = useState(null) // ballots still owed
  const [tied, setTied] = useState(null)       // finalists tied on every automatic key
  const [expanded, setExpanded] = useState(() => new Set())
  const [breakdowns, setBreakdowns] = useState({})
  // The tiebreak dialog: the tied set of one bracket, in the order the admin is putting them.
  const [tb, setTb] = useState(null) // { bracket, rows, order: entryId[], reason, saving, error }

  const catalogQ = useAsync(() => api.get('/award-categories/'), [])
  const categories = catalogQ.data?.categories || []
  const selected = cat ?? categories[0]?.number ?? null

  const resultsQ = useAsync(
    () => (selected == null ? Promise.resolve(null) : api.get(`/admin/finals/${selected}/results`, { auth: true })),
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
    setBanner(null); setMissing(null); setTied(null); setConfirming(false)
    setExpanded(new Set())
  }

  async function loadBreakdown(entryId) {
    if (breakdowns[entryId]?.data || breakdowns[entryId]?.loading) return
    setBreakdowns((b) => ({ ...b, [entryId]: { loading: true } }))
    try {
      const data = await api.get(`/admin/finals/entries/${entryId}/breakdown`, { auth: true })
      setBreakdowns((b) => ({ ...b, [entryId]: { data } }))
    } catch (e) {
      setBreakdowns((b) => ({ ...b, [entryId]: { error: e?.message || 'Could not load the ballots.' } }))
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

  // A finalist needs an admin decision if the automatic keys left it tied, or if a pin already placed
  // it (so an existing tiebreak can be revised — the tie itself never goes away, only the decision).
  function tiedRowsOf(rows) {
    return rows.filter((r) => r.tiedUnresolved || r.tiebreakPosition != null)
  }

  function openTiebreak(bracket, rows) {
    const set = tiedRowsOf(rows)
    // Seed the dialog with the standing decision when there is one, else the board's current order.
    const order = set
      .slice()
      .sort((a, b) => (a.tiebreakPosition ?? 1e9) - (b.tiebreakPosition ?? 1e9) || (a.rank ?? 1e9) - (b.rank ?? 1e9))
      .map((r) => r.entryId)
    setTb({ bracket, rows: set, order, reason: set[0]?.tiebreakReason || '', saving: false, error: null })
  }

  function moveTb(from, to) {
    setTb((prev) => {
      if (!prev || to < 0 || to >= prev.order.length) return prev
      const order = [...prev.order]
      const [id] = order.splice(from, 1)
      order.splice(to, 0, id)
      return { ...prev, order }
    })
  }

  async function saveTiebreak() {
    if (!tb) return
    setTb((p) => ({ ...p, saving: true, error: null }))
    try {
      await api.put(
        `/admin/finals/${selected}/${encodeURIComponent(tb.bracket)}/tiebreak`,
        { order: tb.order, reason: tb.reason.trim() },
        { auth: true },
      )
      setTb(null)
      setTied(null)
      await resultsQ.reload()
      setBanner({ tone: 'success', text: 'Tiebreak recorded. Finalize can now close this category.' })
    } catch (e) {
      setTb((p) => ({ ...p, saving: false, error: e?.message || 'We couldn’t record the tiebreak.' }))
    }
  }

  async function clearTiebreak() {
    if (!tb) return
    setTb((p) => ({ ...p, saving: true, error: null }))
    try {
      await api.delete(`/admin/finals/${selected}/${encodeURIComponent(tb.bracket)}/tiebreak`, { auth: true })
      setTb(null)
      await resultsQ.reload()
      setBanner({ tone: 'warn', text: 'Tiebreak withdrawn — the tie is unresolved again and finalize will block.' })
    } catch (e) {
      setTb((p) => ({ ...p, saving: false, error: e?.message || 'We couldn’t withdraw the tiebreak.' }))
    }
  }

  async function finalize() {
    setFinalizing(true); setBanner(null); setMissing(null); setTied(null)
    try {
      await api.post(`/admin/finals/${selected}/finalize`, undefined, { auth: true })
      setConfirming(false)
      await resultsQ.reload()
      setBanner({ tone: 'success', text: 'Finals closed — winners are set for this category.' })
    } catch (e) {
      setConfirming(false)
      // Two distinct blocks: ballots still owed, or a tie no automatic key could break.
      if (e instanceof ApiError && e.status === 409 && e.raw?.missing) {
        setMissing(e.raw.missing)
        setBanner({ tone: 'warn', text: e.raw.detail || e.message })
      } else if (e instanceof ApiError && e.status === 409 && e.raw?.tied) {
        setTied(e.raw.tied)
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
          <span className="dash-eyebrow">Admin · Finals</span>
          <h1 className="dash-h1">Finals results</h1>
          <p className="dash-sub">
            Every adjudicator ranks a bracket’s finalists 1..N. The <b>lowest average rank</b> wins: 1st is the
            Grand Winner, then First and Second Runner-Up. A bracket with a single finalist wins automatically.
            Finalize is re-runnable.
          </p>
        </div>
      </div>

      <div className="fr-pick">
        <label className="dash-label" htmlFor="fr-cat">Category</label>
        <select id="fr-cat" className="dash-select" value={selected ?? ''} onChange={(e) => onPickCategory(e.target.value)}>
          {categories.map((c) => <option key={c.number} value={c.number}>#{c.number} · {c.name}</option>)}
        </select>
      </div>

      {resultsQ.loading ? <Loading />
        : resultsQ.error ? <ErrorState error={resultsQ.error} onRetry={resultsQ.reload} />
          : results ? (
            <>
              <div className="dash-card fr-action">
                <div className="fr-action-info">
                  <div className="fr-status-row">
                    {results.finalized ? (
                      <span className="dash-badge tone-success"><i className="fas fa-lock" aria-hidden="true" /> Finalized</span>
                    ) : results.complete ? (
                      <span className="dash-badge tone-progress"><i className="fas fa-circle-check" aria-hidden="true" /> Ready to finalize</span>
                    ) : (
                      <span className="dash-badge tone-warn"><i className="fas fa-hourglass-half" aria-hidden="true" /> Adjudication in progress</span>
                    )}
                    {results.finalized && results.finalizedAt && (
                      <span className="fr-finalized-at">
                        Finalized {formatDate(results.finalizedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                  <p className="fr-rules">Lowest average rank wins · ties break on first-place votes, then head-to-head</p>
                </div>
                <button
                  type="button"
                  className="dash-btn is-primary"
                  disabled={finalizing || results.rows.length === 0}
                  onClick={() => setConfirming(true)}
                >
                  <i className="fas fa-trophy" aria-hidden="true" />
                  {results.finalized ? ' Re-run finalize' : ' Finalize finals'}
                </button>
              </div>

              {banner && (
                <div className={`dash-banner tone-${banner.tone === 'success' ? 'success' : banner.tone === 'warn' ? 'warn' : 'error'} fr-banner`}>
                  <i className={`fas ${banner.tone === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} aria-hidden="true" /> {banner.text}
                </div>
              )}

              {missing && missing.length > 0 && (
                <div className="dash-card fr-block">
                  <h3 className="fr-block-h"><i className="fas fa-hourglass-half" aria-hidden="true" /> Ballots still owed</h3>
                  <p className="fr-block-sub">Every assigned adjudicator must submit a ranking for each bracket before finals can close.</p>
                  <ul className="fr-block-list">
                    {missing.map((m, i) => (
                      <li key={`${m.bracket}-${m.adjudicatorUserId}-${i}`}>
                        <span className="fr-block-b">{bracketLabel(m.bracket)}</span>
                        <span>{m.adjudicatorName || m.adjudicatorUserId}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tied && tied.length > 0 && (
                <div className="dash-card fr-block">
                  <h3 className="fr-block-h"><i className="fas fa-scale-balanced" aria-hidden="true" /> Unresolved tie</h3>
                  <p className="fr-block-sub">
                    These finalists are level on average rank, first-place votes <em>and</em> head-to-head — no automatic
                    key can separate them. Record a tiebreak on the bracket below (an explicit order, with your reason),
                    then re-run finalize. A tiebreak never rewrites a ballot.
                  </p>
                  <ul className="fr-block-list">
                    {tied.map((t) => (
                      <li key={t.entryId}>
                        <span className="fr-block-b">{bracketLabel(t.bracket)}</span>
                        <span>{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {results.rows.length === 0 ? (
                <div className="dash-card dash-empty">
                  <div className="dash-empty-icon"><i className="fas fa-trophy" aria-hidden="true" /></div>
                  <h3>No finalists in this category</h3>
                  <p>Close pre-finals scoring first — its finalists are what the adjudicators rank here.</p>
                </div>
              ) : (
                brackets.map(({ bracket, rows }) => {
                  const auto = rows.length === 1
                  // Before any ballot lands the tally has nothing to work with — every finalist comes
                  // back tied on a placeholder average. Showing "Grand Winner" then would be a lie, so
                  // hold the projection until at least one adjudicator has submitted.
                  const noBallots = !auto && (rows[0]?.submittedBallots ?? 0) === 0
                  // Only offer a tiebreak once the ballots are actually in — before that, everything is
                  // "tied" on a placeholder average and the button would be meaningless.
                  const needsTiebreak = !noBallots && tiedRowsOf(rows).length > 0
                  const decided = needsTiebreak && rows.some((r) => r.tiebreakPosition != null)
                  return (
                    <div key={bracket} className="dash-card fr-tablecard">
                      <div className="fr-bracket-head">
                        <h3 className="fr-bracket-title"><i className="fas fa-layer-group" aria-hidden="true" /> {bracketLabel(bracket)}</h3>
                        <span className="fr-bracket-meta">
                          {rows.length} finalist{rows.length === 1 ? '' : 's'}
                          {auto ? ' · automatic Grand Winner' : ` · ${rows[0]?.submittedBallots ?? 0}/${rows[0]?.assignedAdjudicators ?? 0} ballots in`}
                        </span>
                        {needsTiebreak && (
                          <button
                            type="button"
                            className={`dash-btn is-sm fr-tb-btn${decided ? '' : ' is-primary'}`}
                            onClick={() => openTiebreak(bracket, rows)}
                          >
                            <i className="fas fa-scale-balanced" aria-hidden="true" />
                            {decided ? ' Revise tiebreak' : ' Resolve tie'}
                          </button>
                        )}
                      </div>
                      <div className="fr-scroll">
                        <table className="fr-table">
                          <thead>
                            <tr>
                              <th className="fr-th-rank">Rank</th>
                              <th>Finalist</th>
                              <th className="fr-num" title="Mean of the positions every adjudicator gave">Avg rank</th>
                              <th className="fr-num" title="How many adjudicators ranked it first">1st</th>
                              <th className="fr-num" title="Head-to-head majority wins — the second tiebreak">H2H</th>
                              <th>Placement</th>
                              <th aria-hidden="true" />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => {
                              const pm = placementMeta(r.placement)
                              const isOpen = expanded.has(r.entryId)
                              const podium = !noBallots && r.rank != null && r.rank <= 3
                              return (
                                <Fragment key={r.entryId}>
                                  <tr className={`fr-row${podium ? ' is-podium' : ''}${!noBallots && r.tiedUnresolved ? ' is-tied' : ''}`} onClick={() => toggleRow(r.entryId)}>
                                    <td>
                                      <span className={`fr-rank${!noBallots && r.rank === 1 ? ' is-gold' : ''}`}>
                                        {noBallots ? '—' : (r.rank ?? '—')}
                                      </span>
                                    </td>
                                    <td className="fr-entry">
                                      <span className="fr-title">{r.title}</span>
                                      <span className="fr-lgu">{r.lguName}</span>
                                    </td>
                                    <td className="fr-num fr-avg">{noBallots ? '—' : avg(r.averageRank)}</td>
                                    <td className="fr-num">{noBallots ? '—' : (r.firstPlaceVotes ?? '—')}</td>
                                    <td className="fr-num">{noBallots ? '—' : (r.copeland ?? '—')}</td>
                                    <td>
                                      {noBallots ? (
                                        <span className="fr-awaiting"><i className="fas fa-hourglass-half" aria-hidden="true" /> Awaiting ballots</span>
                                      ) : (
                                        <>
                                          <span className={`dash-badge tone-${pm.tone}`}>
                                            <i className={`fas ${pm.icon}`} aria-hidden="true" /> {pm.short}
                                          </span>
                                          {r.tiedUnresolved && (
                                            <span className="fr-tiechip" title="Tied on every automatic key">
                                              <i className="fas fa-scale-balanced" aria-hidden="true" /> tied
                                            </span>
                                          )}
                                          {r.tiebreakPosition != null && (
                                            <span
                                              className="fr-pinchip"
                                              title={`Admin tiebreak — placed ${r.tiebreakPosition} within the tie. Reason: ${r.tiebreakReason || '—'}`}
                                            >
                                              <i className="fas fa-thumbtack" aria-hidden="true" /> tiebreak {r.tiebreakPosition}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </td>
                                    <td className="fr-chevcell">
                                      <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} fr-chev`} aria-hidden="true" />
                                    </td>
                                  </tr>
                                  {isOpen && (
                                    <tr className="fr-bdrow">
                                      <td colSpan={7}><BallotBreakdown state={breakdowns[r.entryId]} /></td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          ) : null}

      {confirming && (
        <div className="fr-modal" role="dialog" aria-modal="true" aria-label="Confirm finalize" onMouseDown={() => !finalizing && setConfirming(false)}>
          <div className="fr-modal-card" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="fr-modal-title">{results?.finalized ? 'Re-run finalize?' : 'Close finals for this category?'}</h3>
            <p className="fr-modal-sub">
              {results?.finalized
                ? 'This recomputes the placements from the current ballots and overwrites the recorded winners. The change is visible, never silent.'
                : 'This computes each bracket’s Grand Winner and runners-up from the submitted rankings, and locks adjudicators out of the category. You can re-run it later if a ballot changes.'}
            </p>
            <div className="fr-modal-foot">
              <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setConfirming(false)} disabled={finalizing}>Cancel</button>
              <button type="button" className="dash-btn is-primary is-sm" onClick={finalize} disabled={finalizing}>
                {finalizing ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Finalizing…</> : 'Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tb && (
        <div
          className="fr-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Record a tiebreak"
          onMouseDown={() => !tb.saving && setTb(null)}
        >
          <div className="fr-modal-card is-wide" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="fr-modal-title">Break the tie — {bracketLabel(tb.bracket)}</h3>
            <p className="fr-modal-sub">
              The ballots can’t separate these finalists: they’re level on average rank, first-place votes and
              head-to-head. Put them in the order you’re awarding them, best at the top. This records an
              <b> admin decision</b> — no adjudicator’s ballot is changed.
            </p>

            <ol className="fr-tb-list">
              {tb.order.map((id, i) => {
                const row = tb.rows.find((r) => r.entryId === id)
                return (
                  <li key={id} className="fr-tb-item">
                    <span className={`fr-rank${i === 0 ? ' is-gold' : ''}`}>{i + 1}</span>
                    <span className="fr-tb-id">
                      <span className="fr-title">{row?.title}</span>
                      <span className="fr-lgu">{row?.lguName}</span>
                    </span>
                    <span className="fr-tb-moves">
                      <button
                        type="button"
                        className="fr-tb-move"
                        onClick={() => moveTb(i, i - 1)}
                        disabled={i === 0 || tb.saving}
                        aria-label={`Move ${row?.title} up`}
                      >
                        <i className="fas fa-chevron-up" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="fr-tb-move"
                        onClick={() => moveTb(i, i + 1)}
                        disabled={i === tb.order.length - 1 || tb.saving}
                        aria-label={`Move ${row?.title} down`}
                      >
                        <i className="fas fa-chevron-down" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="dash-field fr-tb-reason">
              <label className="dash-label" htmlFor="fr-tb-reason">
                Reason <span className="req">*</span>
              </label>
              <textarea
                id="fr-tb-reason"
                className="dash-textarea"
                value={tb.reason}
                onChange={(e) => setTb((p) => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Panel deliberated on 12 Jul and agreed to place Baguio first on strength of the interview."
                maxLength={500}
                disabled={tb.saving}
              />
              <span className="dash-help">Recorded with your name and the time. It’s the audit trail for a human decision.</span>
            </div>

            {tb.error && (
              <div className="dash-banner tone-error">
                <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{tb.error}</span>
              </div>
            )}

            <div className="fr-modal-foot">
              {tb.rows.some((r) => r.tiebreakPosition != null) && (
                <button
                  type="button"
                  className="dash-btn is-danger is-sm fr-tb-withdraw"
                  onClick={clearTiebreak}
                  disabled={tb.saving}
                >
                  Withdraw tiebreak
                </button>
              )}
              <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setTb(null)} disabled={tb.saving}>
                Cancel
              </button>
              <button
                type="button"
                className="dash-btn is-primary is-sm"
                onClick={saveTiebreak}
                disabled={tb.saving || !tb.reason.trim()}
                title={tb.reason.trim() ? 'Record this order' : 'A reason is required'}
              >
                {tb.saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : 'Record tiebreak'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fr-pick { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .fr-pick .dash-select { max-width: 420px; }

        .fr-action { display: flex; align-items: center; gap: 16px; padding: 16px 20px; margin-bottom: 16px; flex-wrap: wrap; }
        .fr-action-info { min-width: 0; }
        .fr-status-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .fr-finalized-at { font-size: 0.78rem; color: var(--gray-600); }
        .fr-rules { font-size: 0.8rem; color: var(--gray-600); margin-top: 6px; }
        .fr-action .dash-btn { margin-left: auto; }
        .fr-banner { margin-bottom: 16px; }

        .fr-block { padding: 16px 20px; margin-bottom: 16px; border-left: 3px solid var(--gold); }
        .fr-block-h { display: flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-size: 0.95rem; font-weight: 800; color: var(--navy); }
        .fr-block-h i { color: var(--gold-dark); }
        .fr-block-sub { font-size: 0.84rem; color: var(--gray-600); line-height: 1.55; margin: 6px 0 10px; }
        .fr-block-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
        .fr-block-list li { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: var(--text-body); }
        .fr-block-b { font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.28); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }

        .fr-tablecard { padding: 0; overflow: hidden; margin-bottom: 16px; }
        .fr-bracket-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--gray-100); flex-wrap: wrap; }
        .fr-bracket-title { display: flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-size: 0.95rem; font-weight: 800; color: var(--navy); }
        .fr-bracket-title i { color: var(--gray-400); font-size: 0.82rem; }
        .fr-bracket-meta { font-size: 0.78rem; color: var(--gray-600); font-family: var(--font-heading); font-weight: 600; }

        .fr-scroll { overflow-x: auto; }
        .fr-table { width: 100%; border-collapse: collapse; }
        .fr-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 11px 16px; text-align: left; white-space: nowrap; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
        .fr-th-rank { width: 66px; }
        /* Must out-specify the thead th rule above, which sets text-align: left. */
        .fr-table thead th.fr-num { text-align: right; }
        .fr-num { text-align: right; width: 78px; font-variant-numeric: tabular-nums; }
        .fr-table td { padding: 12px 16px; vertical-align: middle; border-bottom: 1px solid var(--gray-100); }
        .fr-table tbody tr:last-child td { border-bottom: none; }
        .fr-row { cursor: pointer; transition: var(--transition-fast); }
        .fr-row:hover { background: rgba(200,168,75,0.06); }
        .fr-row.is-podium { background: rgba(200,168,75,0.04); }
        .fr-row.is-tied { background: rgba(220,38,38,0.04); }

        .fr-rank { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; font-family: var(--font-heading); font-weight: 800; font-size: 0.88rem; color: var(--gray-600); background: var(--gray-100); border: 1px solid var(--gray-200); }
        .fr-rank.is-gold { color: var(--navy); background: linear-gradient(135deg, var(--gold-light), var(--gold)); border-color: var(--gold-dark); }
        .fr-entry { min-width: 220px; }
        .fr-title { display: block; font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; }
        .fr-lgu { display: block; color: var(--gray-600); font-size: 0.78rem; margin-top: 2px; }
        .fr-avg { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 0.95rem; }
        .fr-tiechip { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; font-size: 0.66rem; font-weight: 700; color: #B91C1C; }
        /* A placement an admin decided, not one the ballots produced — say so on the row. */
        .fr-pinchip { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; font-size: 0.66rem; font-weight: 700; color: var(--gold-dark); cursor: help; }
        .fr-awaiting { display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--gray-400); font-style: italic; }
        .fr-chevcell { width: 38px; text-align: right; }
        .fr-chev { color: var(--gray-300); }

        .fr-bdrow td { background: var(--off-white); padding: 0; }
        .fr-bd { padding: 14px 18px; }
        .fr-bd-note { font-size: 0.84rem; color: var(--gray-600); }
        .fr-bd-err { color: #B91C1C; }
        .fr-bd-list { list-style: none; padding: 0; margin: 0 0 8px; display: flex; flex-wrap: wrap; gap: 6px; }
        .fr-bd-list li { display: inline-flex; align-items: center; gap: 8px; padding: 6px 11px; background: var(--white); border: 1px solid var(--gray-200); border-radius: 999px; font-size: 0.82rem; }
        .fr-bd-name { color: var(--navy); font-family: var(--font-heading); font-weight: 600; }
        .fr-bd-status { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; color: var(--gold-dark); }
        .fr-bd-rank { font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
        .fr-bd-legend { font-size: 0.76rem; color: var(--gray-600); }

        .fr-modal { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 20px; background: rgba(15,25,46,0.55); backdrop-filter: blur(2px); }
        .fr-modal-card { width: 100%; max-width: 460px; background: var(--white); border-radius: var(--radius-md); box-shadow: 0 30px 70px rgba(15,25,46,0.4); padding: 24px; }
        .fr-modal-card.is-wide { max-width: 560px; max-height: 88vh; overflow-y: auto; }

        /* ---- Tiebreak dialog: order the tied set, best at the top ---- */
        .fr-tb-btn { flex-shrink: 0; }
        .fr-tb-list { display: flex; flex-direction: column; gap: 8px; margin: 18px 0 4px; padding: 0; list-style: none; }
        .fr-tb-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--off-white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
        .fr-tb-id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .fr-tb-moves { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
        .fr-tb-move { background: none; border: 1px solid var(--gray-200); border-radius: 6px; width: 26px; height: 20px; display: grid; place-items: center; cursor: pointer; color: var(--gray-600); font-size: 0.6rem; transition: var(--transition-fast); }
        .fr-tb-move:hover:not(:disabled) { border-color: var(--navy); color: var(--navy); background: var(--white); }
        .fr-tb-move:disabled { opacity: 0.35; cursor: not-allowed; }
        .fr-tb-reason { margin-top: 16px; }
        .fr-tb-withdraw { margin-right: auto; }
        .fr-modal-title { font-family: var(--font-heading); font-size: 1.12rem; font-weight: 800; color: var(--navy); }
        .fr-modal-sub { color: var(--gray-600); font-size: 0.86rem; line-height: 1.6; margin-top: 8px; }
        .fr-modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

        @media (max-width: 720px) { .fr-action .dash-btn { margin-left: 0; width: 100%; } }
      `}</style>
    </>
  )
}

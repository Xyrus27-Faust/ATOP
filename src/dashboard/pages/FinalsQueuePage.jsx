import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isAdjudicator, isAdmin } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import { bracketLabel, bracketRank, ballotMeta } from '@/lib/pearlAwards'

const VIEWS = [
  { key: 'todo', label: 'Still to rank' },
  { key: 'done', label: 'Ranked' },
  { key: 'all', label: 'All brackets' },
]

// Work order within a cluster: what still needs a ballot first, then what's done, auto-wins last.
const workOrder = (b) => (b.singleFinalistAutoWin ? 2 : b.myBallotStatus === 'Submitted' ? 1 : 0)

// A bracket is the unit of work in finals — one contest, its own set of finalists, its own winner.
export default function FinalsQueuePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const admin = isAdmin(user?.roles)
  const [view, setView] = useState('todo')
  const [level, setLevel] = useState('all')

  const { loading, error, data, reload } = useAsync(() => api.get('/finals/brackets', { auth: true }), [])

  const brackets = useMemo(() => data || [], [data])

  // The ranking window is edition-wide, so every bracket agrees; read it off the first one.
  const previewOnly = brackets.length > 0 && brackets[0].rankingOpen === false

  // Auto-win brackets need no ballot, so they never count toward "still to rank".
  const progress = useMemo(() => {
    const rankable = brackets.filter((b) => !b.singleFinalistAutoWin)
    const done = rankable.filter((b) => b.myBallotStatus === 'Submitted').length
    return { total: rankable.length, done, pending: rankable.length - done, autoWins: brackets.length - rankable.length }
  }, [brackets])

  // The levels actually present, so the filter never offers an empty one.
  const levelOptions = useMemo(
    () =>
      [...new Set(brackets.map((b) => b.bracket))]
        .sort((a, b) => bracketRank(a) - bracketRank(b))
        .map((value) => ({ value, label: bracketLabel(value) })),
    [brackets],
  )

  const visible = useMemo(
    () =>
      brackets.filter((b) => {
        if (level !== 'all' && b.bracket !== level) return false
        if (b.singleFinalistAutoWin) return view === 'all'
        if (view === 'todo') return b.myBallotStatus !== 'Submitted'
        if (view === 'done') return b.myBallotStatus === 'Submitted'
        return true
      }),
    [brackets, view, level],
  )

  // Every entry competes only inside its own level, so the queue is clustered that way: an
  // adjudicator works one level end-to-end and calibrates against the field they're actually judging.
  const clusters = useMemo(() => {
    const groups = new Map()
    for (const b of visible) {
      if (!groups.has(b.bracket)) groups.set(b.bracket, [])
      groups.get(b.bracket).push(b)
    }
    return [...groups.entries()]
      .sort(([a], [b]) => bracketRank(a) - bracketRank(b))
      .map(([bracket, items]) => {
        const rankable = items.filter((b) => !b.singleFinalistAutoWin)
        return {
          bracket,
          items: items.slice().sort((a, b) => workOrder(a) - workOrder(b) || a.categoryNumber - b.categoryNumber),
          total: rankable.length,
          done: rankable.filter((b) => b.myBallotStatus === 'Submitted').length,
          autoWins: items.length - rankable.length,
        }
      })
  }, [visible])

  if (!isAdjudicator(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const bracketPath = (b) => `/finals/${b.categoryNumber}/${encodeURIComponent(b.bracket)}`

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{admin ? 'Admin · Finals' : 'Adjudicator · Finals'}</span>
          <h1 className="dash-h1">Finals</h1>
          <p className="dash-sub">
            {previewOnly
              ? 'Each bracket is its own contest. Read the finalists now; ranking opens later, and the Grand Winner is the one with the lowest average position across every adjudicator.'
              : 'Each bracket is its own contest. Put its finalists in your order of merit — top of the list is your Grand Winner. Every adjudicator’s positions are averaged, and the lowest average rank wins.'}
          </p>
        </div>
      </div>

      {previewOnly && (
        <div className="dash-banner tone-info">
          <i className="fas fa-eye" aria-hidden="true" /> Ranking hasn’t opened yet. Open any bracket to read
          its finalists’ bidbooks — you’ll be able to place them in order once it does.
        </div>
      )}

      {/* "0 of 14 ranked" is noise while nobody is allowed to rank. */}
      {progress.total > 0 && !previewOnly && (
        <div className="dash-card fq-progress">
          <div className="fq-progress-head">
            <span className="fq-progress-count">
              <b>{progress.done}</b> of <b>{progress.total}</b> brackets ranked
            </span>
            <span className="fq-progress-pending">
              {progress.pending === 0 ? 'All done — thank you!' : `${progress.pending} still to rank`}
            </span>
          </div>
          <div className="dash-meter">
            <div className={`dash-meter-fill${pct === 100 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="fq-controls">
        <select className="dash-select" value={view} onChange={(e) => setView(e.target.value)} aria-label="Progress filter">
          {VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
        {levelOptions.length > 1 && (
          <select className="dash-select" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="LGU level">
            <option value="all">All levels</option>
            {levelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {progress.autoWins > 0 && view !== 'all' && (
          <span className="fq-autowin-note">
            <i className="fas fa-trophy" aria-hidden="true" />
            {progress.autoWins} bracket{progress.autoWins === 1 ? '' : 's'} won automatically (a single finalist) — see “All brackets”.
          </span>
        )}
        <span className="fq-count">{visible.length} shown</span>
      </div>

      {brackets.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-gavel" aria-hidden="true" /></div>
          <h3>No brackets to adjudicate yet</h3>
          <p>
            Once pre-finals scoring closes and finalists are set in your assigned categories, their brackets appear
            here. If this stays empty, an admin may still need to assign you categories.
          </p>
        </div>
      ) : clusters.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-circle-check" aria-hidden="true" /></div>
          <h3>Nothing here</h3>
          <p>No brackets match these filters. Switch to “All brackets” and “All levels” to see everything assigned to you.</p>
        </div>
      ) : (
        clusters.map((c) => (
        <section key={c.bracket} className="fq-cluster">
          <header className="fq-cluster-head">
            <h2 className="fq-cluster-title">
              <i className="fas fa-layer-group" aria-hidden="true" /> {bracketLabel(c.bracket)}
            </h2>
            <span className={`fq-cluster-count${c.total > 0 && c.done === c.total ? ' is-complete' : ''}`}>
              {c.total > 0 && `${c.done} of ${c.total} ranked`}
              {c.total > 0 && c.autoWins > 0 && ' · '}
              {c.autoWins > 0 && `${c.autoWins} automatic`}
            </span>
          </header>
          <div className="dash-card fq-tablecard">
            <div className="fq-scroll">
              <table className="fq-table">
                <thead>
                  <tr>
                    <th className="fq-th-num">#</th>
                    <th>Award</th>
                    <th className="fq-th-finalists">Finalists</th>
                    <th className="fq-th-ballot">My ballot</th>
                    <th aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((b) => {
                    const mm = ballotMeta(b.myBallotStatus)
                    const auto = b.singleFinalistAutoWin
                    const to = bracketPath(b)
                    return (
                      <tr
                        key={`${b.categoryNumber}-${b.bracket}`}
                        className={`fq-row${auto ? ' is-auto' : ''}`}
                        onClick={(ev) => { if (!ev.target.closest('a')) navigate(to) }}
                      >
                        <td className="fq-num"><span className="fq-cat">#{b.categoryNumber}</span></td>
                        <td className="fq-award">
                          <Link to={to} className="fq-title">{b.categoryName}</Link>
                        </td>
                        <td className="fq-finalists">
                          <i className="fas fa-users" aria-hidden="true" />
                          {b.finalistCount} finalist{b.finalistCount === 1 ? '' : 's'}
                        </td>
                        <td>
                          {auto ? (
                            <span className="dash-badge tone-success"><i className="fas fa-trophy" aria-hidden="true" /> Automatic winner</span>
                          ) : previewOnly ? (
                            <span className="dash-badge tone-info"><i className="fas fa-eye" aria-hidden="true" /> Preview only</span>
                          ) : (
                            <span className={`dash-badge tone-${mm.tone}`}><i className={`fas ${mm.icon}`} aria-hidden="true" /> {mm.label}</span>
                          )}
                        </td>
                        <td className="fq-chevcell"><i className="fas fa-chevron-right fq-chev" aria-hidden="true" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        ))
      )}

      <style>{`
        .fq-progress { padding: 16px 20px; margin-bottom: 18px; }
        .fq-progress-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
        .fq-progress-count { font-family: var(--font-body); color: var(--gray-600); font-size: 0.9rem; }
        .fq-progress-count b { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 1.05rem; }
        .fq-progress-pending { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gold-dark); }

        .fq-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
        .fq-controls .dash-select { width: auto; min-width: 160px; }
        .fq-autowin-note { display: inline-flex; align-items: center; gap: 7px; font-size: 0.78rem; color: var(--gray-600); }
        .fq-autowin-note i { color: var(--gold-dark); }
        .fq-count { font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--gray-600); margin-left: auto; white-space: nowrap; }

        .fq-cluster + .fq-cluster { margin-top: 28px; }
        .fq-cluster-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-200); }
        .fq-cluster-title { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-size: 0.82rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--navy); }
        .fq-cluster-title i { color: var(--gold-dark); font-size: 0.76rem; }
        .fq-cluster-count { margin-left: auto; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gray-600); white-space: nowrap; }
        .fq-cluster-count.is-complete { color: #15803D; }

        .fq-tablecard { padding: 0; overflow: hidden; }
        .fq-scroll { overflow-x: auto; }
        .fq-table { width: 100%; border-collapse: collapse; }
        .fq-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 12px 16px; text-align: left; white-space: nowrap; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
        /* Each cluster is its own table, so the columns are pinned — otherwise every section sizes
           independently and the headers stop lining up down the page. */
        .fq-th-num { width: 56px; }
        .fq-th-finalists { width: 150px; }
        .fq-th-ballot { width: 200px; }
        .fq-table tbody tr { border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: var(--transition-fast); }
        .fq-table tbody tr:last-child { border-bottom: none; }
        .fq-row:hover { background: rgba(200,168,75,0.06); }
        .fq-row.is-auto { background: rgba(200,168,75,0.04); }
        .fq-table td { padding: 13px 16px; vertical-align: middle; }
        .fq-cat { display: inline-grid; place-items: center; min-width: 36px; height: 28px; padding: 0 8px; border-radius: 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); }
        .fq-award { min-width: 220px; }
        .fq-title { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; text-decoration: none; }
        .fq-title:hover { color: var(--gold-dark); text-decoration: underline; }
        .fq-finalists { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--gray-600); white-space: nowrap; }
        .fq-chevcell { width: 38px; text-align: right; }
        .fq-chev { color: var(--gray-300); }
      `}</style>
    </>
  )
}

import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isAssessor, isAdmin } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import { formatWeighted, formatDate, bracketLabel, bracketRank } from '@/lib/pearlAwards'

// The caller's own progress on an entry — the state that matters most in this queue.
const MY = {
  NotStarted: { label: 'To score', tone: 'neutral', icon: 'fa-circle-dot' },
  Pending: { label: 'In progress', tone: 'progress', icon: 'fa-pen' },
  Submitted: { label: 'Scored', tone: 'success', icon: 'fa-circle-check' },
}
const myMeta = (s) => MY[s] || MY.NotStarted

const STATUS_VIEWS = [
  { key: 'todo', label: 'Still to score' },
  { key: 'done', label: 'Scored' },
  { key: 'all', label: 'All assigned' },
]

export default function ScoringQueuePage() {
  const { user } = useAuth()
  const admin = isAdmin(user?.roles)
  const [view, setView] = useState('todo')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [level, setLevel] = useState('all')

  const { loading, error, data, reload } = useAsync(
    () =>
      Promise.all([
        api.get('/scoring/entries/', { auth: true }),
        api.get('/award-categories/'),
      ]).then(([entries, catalog]) => ({ entries, catalog })),
    [],
  )

  const entries = data?.entries
  const nameByNumber = useMemo(
    () => new Map((data?.catalog?.categories || []).map((c) => [c.number, c.name])),
    [data],
  )

  const progress = useMemo(() => {
    const all = entries || []
    const scored = all.filter((e) => e.myAssessmentStatus === 'Submitted' && e.myTotal != null)
    const submitted = all.filter((e) => e.myAssessmentStatus === 'Submitted').length
    // Their own marks only — what anyone else scored stays out of sight until finalize.
    const totals = scored.map((e) => Number(e.myTotal))
    return {
      total: all.length,
      submitted,
      pending: all.length - submitted,
      average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
      lowest: totals.length ? Math.min(...totals) : null,
      highest: totals.length ? Math.max(...totals) : null,
    }
  }, [entries])

  const categoryOptions = useMemo(() => {
    const nums = [...new Set((entries || []).map((e) => e.categoryNumber))].sort((a, b) => a - b)
    return nums.map((n) => ({ value: String(n), label: `#${n} · ${nameByNumber.get(n) || `Category ${n}`}` }))
  }, [entries, nameByNumber])

  // The levels actually present, so the filter never offers an empty one.
  const levelOptions = useMemo(
    () =>
      [...new Set((entries || []).map((e) => e.bracket))]
        .sort((a, b) => bracketRank(a) - bracketRank(b))
        .map((value) => ({ value, label: bracketLabel(value) })),
    [entries],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (entries || [])
      .filter((e) => {
        if (view === 'todo' && e.myAssessmentStatus === 'Submitted') return false
        if (view === 'done' && e.myAssessmentStatus !== 'Submitted') return false
        if (category !== 'all' && String(e.categoryNumber) !== category) return false
        if (level !== 'all' && e.bracket !== level) return false
        if (term && !`${e.title} ${e.lguName}`.toLowerCase().includes(term)) return false
        return true
      })
      .sort((a, b) => {
        // Unscored first, then in-progress, then scored; newest submission within each.
        const rank = (e) => (e.myAssessmentStatus === 'Submitted' ? 2 : e.myAssessmentStatus === 'Pending' ? 1 : 0)
        return rank(a) - rank(b) || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
      })
  }, [entries, view, category, level, search])

  // An entry only ever competes inside its own bracket, so the queue clusters that way — scoring a
  // level end-to-end keeps an assessor calibrated against the field the entry is actually judged in.
  const clusters = useMemo(() => {
    const groups = new Map()
    for (const e of rows) {
      if (!groups.has(e.bracket)) groups.set(e.bracket, [])
      groups.get(e.bracket).push(e)
    }
    return [...groups.entries()]
      .sort(([a], [b]) => bracketRank(a) - bracketRank(b))
      .map(([bracket, items]) => ({
        bracket,
        items,
        total: items.length,
        done: items.filter((e) => e.myAssessmentStatus === 'Submitted').length,
      }))
  }, [rows])

  if (!isAssessor(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const pct = progress.total ? Math.round((progress.submitted / progress.total) * 100) : 0

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{admin ? 'Admin · Scoring' : '3PIC · Scoring'}</span>
          <h1 className="dash-h1">Scoring queue</h1>
          <p className="dash-sub">
            Score each validated entry in your categories against its rubric. Open an entry, rate every
            criterion 0–5, then submit — your scoresheet locks once submitted. Everything you have
            scored stays here with the mark you gave; open one to read it back, criterion by criterion.
          </p>
        </div>
      </div>

      {progress.total > 0 && (
        <div className="dash-card sc-progress">
          <div className="sc-progress-head">
            <span className="sc-progress-count">
              <b>{progress.submitted}</b> of <b>{progress.total}</b> scored
            </span>
            <span className="sc-progress-pending">
              {progress.pending === 0 ? 'All done — thank you!' : `${progress.pending} still to score`}
            </span>
          </div>
          <div className="dash-meter">
            <div className={`dash-meter-fill${pct === 100 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
          </div>

          {progress.average != null && (
            <p className="sc-progress-scores">
              Your scores so far — average <b>{formatWeighted(progress.average)}</b>, from{' '}
              <b>{formatWeighted(progress.lowest)}</b> to <b>{formatWeighted(progress.highest)}</b> out of 100.
            </p>
          )}
        </div>
      )}

      <div className="sc-controls">
        <div className="sc-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="dash-input"
            type="search"
            placeholder="Search title or LGU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search entries"
          />
        </div>
        <select className="dash-select" value={view} onChange={(e) => setView(e.target.value)} aria-label="Progress filter">
          {STATUS_VIEWS.map((v) => (
            <option key={v.key} value={v.key}>{v.label}</option>
          ))}
        </select>
        <select className="dash-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Award category">
          <option value="all">All categories</option>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {levelOptions.length > 1 && (
          <select className="dash-select" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="LGU level">
            <option value="all">All levels</option>
            {levelOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        <span className="sc-count">{rows.length} shown</span>
      </div>

      {progress.total === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-star-half-stroke" aria-hidden="true" /></div>
          <h3>Nothing to score yet</h3>
          <p>
            Validated entries in your assigned categories appear here. If this stays empty, an admin may still
            need to assign you categories, or entries are still in validation.
          </p>
        </div>
      ) : clusters.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-magnifying-glass" aria-hidden="true" /></div>
          <h3>Nothing here</h3>
          <p>No entries match your filters.</p>
        </div>
      ) : (
        clusters.map((c) => (
          <section key={c.bracket} className="sc-cluster">
            <header className="sc-cluster-head">
              <h2 className="sc-cluster-title">
                <i className="fas fa-layer-group" aria-hidden="true" /> {bracketLabel(c.bracket)}
              </h2>
              <span className={`sc-cluster-count${c.done === c.total ? ' is-complete' : ''}`}>
                {c.done} of {c.total} scored
              </span>
            </header>
            <div className="dash-card sc-tablecard">
              <div className="sc-scroll">
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th className="sc-th-num">#</th>
                      <th>Entry</th>
                      <th className="sc-th-lgu">LGU</th>
                      <th className="sc-th-sheet">My scoresheet</th>
                      <th className="sc-th-date">Submitted</th>
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {c.items.map((e) => {
                      const mm = myMeta(e.myAssessmentStatus)
                      return (
                        <tr key={e.id} className="sc-row" onClick={(ev) => { if (!ev.target.closest('a')) window.open(`/scoring/${e.id}`, '_blank', 'noopener') }} title="Opens the scoresheet in a new tab">
                          <td className="sc-num"><span className="sc-cat">#{e.categoryNumber}</span></td>
                          <td className="sc-entry">
                            <Link to={`/scoring/${e.id}`} target="_blank" rel="noopener" className="sc-title">{e.title} <i className="fas fa-arrow-up-right-from-square sc-title-ext" aria-hidden="true" /></Link>
                            <span className="sc-catname">{nameByNumber.get(e.categoryNumber) || `Category ${e.categoryNumber}`}</span>
                          </td>
                          <td className="sc-lgu">{e.lguName}</td>
                          <td>
                            <span className={`dash-badge tone-${mm.tone}`}>
                              <i className={`fas ${mm.icon}`} aria-hidden="true" /> {mm.label}
                            </span>
                            {e.myTotal != null && (
                              <span className="sc-my-total">
                                {formatWeighted(e.myTotal)} <span className="sc-my-total-max">/ 100</span>
                              </span>
                            )}
                          </td>
                          <td className="sc-date">{e.submittedAt ? formatDate(e.submittedAt) : '—'}</td>
                          <td className="sc-chevcell"><i className="fas fa-chevron-right sc-chev" aria-hidden="true" /></td>
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
        .sc-progress { padding: 16px 20px; margin-bottom: 18px; }
        .sc-progress-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
        .sc-progress-count { font-family: var(--font-body); color: var(--gray-600); font-size: 0.9rem; }
        .sc-progress-count b { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 1.05rem; }
        .sc-my-total {
          display: block; margin-top: 5px;
          font-family: var(--font-heading); font-size: 0.98rem; font-weight: 800;
          color: var(--navy); font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .sc-my-total-max { font-size: 0.72rem; font-weight: 700; color: var(--gray-400); }
        .sc-progress-scores {
          margin: 10px 0 0; font-family: var(--font-body); font-size: 0.88rem; color: var(--gray-600);
        }
        .sc-progress-scores b { font-family: var(--font-heading); color: var(--navy); font-variant-numeric: tabular-nums; }

        .sc-progress-pending { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gold-dark); }

        .sc-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
        .sc-search { position: relative; flex: 1 1 240px; min-width: 200px; }
        .sc-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .sc-search .dash-input { padding-left: 36px; }
        .sc-controls .dash-select { width: auto; min-width: 150px; }
        .sc-count { font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--gray-600); margin-left: auto; white-space: nowrap; }

        .sc-cluster + .sc-cluster { margin-top: 28px; }
        .sc-cluster-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-200); }
        .sc-cluster-title { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-size: 0.82rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--navy); }
        .sc-cluster-title i { color: var(--gold-dark); font-size: 0.76rem; }
        .sc-cluster-count { margin-left: auto; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gray-600); white-space: nowrap; }
        .sc-cluster-count.is-complete { color: #15803D; }

        .sc-tablecard { padding: 0; overflow: hidden; }
        .sc-scroll { overflow-x: auto; }
        .sc-table { width: 100%; border-collapse: collapse; }
        .sc-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 12px 16px; text-align: left; white-space: nowrap; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
        /* Each cluster is its own table, so the columns are pinned — otherwise every section sizes
           independently and the headers stop lining up down the page. */
        .sc-th-num { width: 56px; }
        .sc-th-lgu { width: 210px; }
        .sc-th-sheet { width: 175px; }
        .sc-th-date { width: 130px; }
        .sc-table tbody tr { border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: var(--transition-fast); }
        .sc-table tbody tr:last-child { border-bottom: none; }
        .sc-row:hover { background: rgba(200,168,75,0.06); }
        .sc-table td { padding: 13px 16px; vertical-align: middle; }
        .sc-cat { display: inline-grid; place-items: center; min-width: 36px; height: 28px; padding: 0 8px; border-radius: 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); }
        .sc-entry { min-width: 220px; }
        .sc-title { display: block; font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; text-decoration: none; }
        .sc-title:hover { color: var(--gold-dark); text-decoration: underline; }
        .sc-title-ext { font-size: 0.68rem; color: var(--gray-300); margin-left: 3px; }
        .sc-row:hover .sc-title-ext { color: var(--gold-dark); }
        .sc-catname { display: block; color: var(--gray-600); font-size: 0.78rem; margin-top: 2px; }
        .sc-lgu { color: var(--text-body); font-size: 0.88rem; white-space: nowrap; }
        .sc-date { color: var(--gray-600); font-size: 0.82rem; white-space: nowrap; font-family: var(--font-heading); font-weight: 600; }
        .sc-chevcell { width: 38px; text-align: right; }
        .sc-chev { color: var(--gray-300); }
        @media (max-width: 680px) { .sc-catname { display: none; } .sc-count { width: 100%; margin-left: 0; } }
      `}</style>
    </>
  )
}

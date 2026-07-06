import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isAssessor, isAdmin } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import { formatDate } from '@/lib/pearlAwards'

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
    const submitted = all.filter((e) => e.myAssessmentStatus === 'Submitted').length
    return { total: all.length, submitted, pending: all.length - submitted }
  }, [entries])

  const categoryOptions = useMemo(() => {
    const nums = [...new Set((entries || []).map((e) => e.categoryNumber))].sort((a, b) => a - b)
    return nums.map((n) => ({ value: String(n), label: `#${n} · ${nameByNumber.get(n) || `Category ${n}`}` }))
  }, [entries, nameByNumber])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (entries || [])
      .filter((e) => {
        if (view === 'todo' && e.myAssessmentStatus === 'Submitted') return false
        if (view === 'done' && e.myAssessmentStatus !== 'Submitted') return false
        if (category !== 'all' && String(e.categoryNumber) !== category) return false
        if (term && !`${e.title} ${e.lguName}`.toLowerCase().includes(term)) return false
        return true
      })
      .sort((a, b) => {
        // Unscored first, then in-progress, then scored; newest submission within each.
        const rank = (e) => (e.myAssessmentStatus === 'Submitted' ? 2 : e.myAssessmentStatus === 'Pending' ? 1 : 0)
        return rank(a) - rank(b) || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
      })
  }, [entries, view, category, search])

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
            criterion 0–5, then submit — your scoresheet locks once submitted.
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
      ) : (
        <div className="dash-card sc-tablecard">
          <div className="sc-scroll">
            <table className="sc-table">
              <thead>
                <tr>
                  <th className="sc-th-num">#</th>
                  <th>Entry</th>
                  <th>LGU</th>
                  <th>My scoresheet</th>
                  <th>Submitted</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="sc-norows">No entries match your filters.</td></tr>
                ) : (
                  rows.map((e) => {
                    const mm = myMeta(e.myAssessmentStatus)
                    return (
                      <tr key={e.id} className="sc-row" onClick={(ev) => { if (!ev.target.closest('a')) window.open(`/scoring/${e.id}`, '_blank', 'noopener') }} title="Opens the scoresheet in a new tab">
                        <td className="sc-num"><span className="sc-cat">#{e.categoryNumber}</span></td>
                        <td className="sc-entry">
                          <Link to={`/scoring/${e.id}`} target="_blank" rel="noopener" className="sc-title">{e.title} <i className="fas fa-arrow-up-right-from-square sc-title-ext" aria-hidden="true" /></Link>
                          <span className="sc-catname">{nameByNumber.get(e.categoryNumber) || `Category ${e.categoryNumber}`}</span>
                        </td>
                        <td className="sc-lgu">{e.lguName}<span className="sc-lgu-level">{e.lguLevel}</span></td>
                        <td><span className={`dash-badge tone-${mm.tone}`}><i className={`fas ${mm.icon}`} aria-hidden="true" /> {mm.label}</span></td>
                        <td className="sc-date">{e.submittedAt ? formatDate(e.submittedAt) : '—'}</td>
                        <td className="sc-chevcell"><i className="fas fa-chevron-right sc-chev" aria-hidden="true" /></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .sc-progress { padding: 16px 20px; margin-bottom: 18px; }
        .sc-progress-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
        .sc-progress-count { font-family: var(--font-body); color: var(--gray-600); font-size: 0.9rem; }
        .sc-progress-count b { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 1.05rem; }
        .sc-progress-pending { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gold-dark); }

        .sc-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
        .sc-search { position: relative; flex: 1 1 240px; min-width: 200px; }
        .sc-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .sc-search .dash-input { padding-left: 36px; }
        .sc-controls .dash-select { width: auto; min-width: 150px; }
        .sc-count { font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--gray-600); margin-left: auto; white-space: nowrap; }

        .sc-tablecard { padding: 0; overflow: hidden; }
        .sc-scroll { overflow-x: auto; }
        .sc-table { width: 100%; border-collapse: collapse; }
        .sc-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 12px 16px; text-align: left; white-space: nowrap; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
        .sc-th-num { width: 56px; }
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
        .sc-lgu-level { display: block; color: var(--gray-400); font-size: 0.74rem; font-family: var(--font-heading); font-weight: 600; }
        .sc-date { color: var(--gray-600); font-size: 0.82rem; white-space: nowrap; font-family: var(--font-heading); font-weight: 600; }
        .sc-chevcell { width: 38px; text-align: right; }
        .sc-chev { color: var(--gray-300); }
        .sc-norows { padding: 40px 16px; text-align: center; color: var(--gray-600); }
        @media (max-width: 680px) { .sc-catname { display: none; } .sc-count { width: 100%; margin-left: 0; } }
      `}</style>
    </>
  )
}

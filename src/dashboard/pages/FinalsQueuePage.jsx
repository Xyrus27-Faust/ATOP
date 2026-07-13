import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isAdjudicator, isAdmin } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import { bracketLabel, ballotMeta } from '@/lib/pearlAwards'

const VIEWS = [
  { key: 'todo', label: 'Still to rank' },
  { key: 'done', label: 'Ranked' },
  { key: 'all', label: 'All brackets' },
]

// A bracket is the unit of work in finals — one contest, its own set of finalists, its own winner.
export default function FinalsQueuePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const admin = isAdmin(user?.roles)
  const [view, setView] = useState('todo')

  const { loading, error, data, reload } = useAsync(() => api.get('/finals/brackets', { auth: true }), [])

  const brackets = useMemo(() => data || [], [data])

  // Auto-win brackets need no ballot, so they never count toward "still to rank".
  const progress = useMemo(() => {
    const rankable = brackets.filter((b) => !b.singleFinalistAutoWin)
    const done = rankable.filter((b) => b.myBallotStatus === 'Submitted').length
    return { total: rankable.length, done, pending: rankable.length - done, autoWins: brackets.length - rankable.length }
  }, [brackets])

  const rows = useMemo(() => {
    return brackets
      .filter((b) => {
        if (b.singleFinalistAutoWin) return view === 'all'
        if (view === 'todo') return b.myBallotStatus !== 'Submitted'
        if (view === 'done') return b.myBallotStatus === 'Submitted'
        return true
      })
      .sort((a, b) => {
        const rank = (x) => (x.singleFinalistAutoWin ? 2 : x.myBallotStatus === 'Submitted' ? 1 : 0)
        return rank(a) - rank(b) || a.categoryNumber - b.categoryNumber || a.bracket.localeCompare(b.bracket)
      })
  }, [brackets, view])

  if (!isAdjudicator(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const open = (b) => navigate(`/finals/${b.categoryNumber}/${encodeURIComponent(b.bracket)}`)

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{admin ? 'Admin · Finals' : 'Adjudicator · Finals'}</span>
          <h1 className="dash-h1">Finals</h1>
          <p className="dash-sub">
            Each bracket is its own contest. Put its finalists in your order of merit — top of the list is your
            Grand Winner. Every adjudicator’s positions are averaged, and the lowest average rank wins.
          </p>
        </div>
      </div>

      {progress.total > 0 && (
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
        {progress.autoWins > 0 && view !== 'all' && (
          <span className="fq-autowin-note">
            <i className="fas fa-trophy" aria-hidden="true" />
            {progress.autoWins} bracket{progress.autoWins === 1 ? '' : 's'} won automatically (a single finalist) — see “All brackets”.
          </span>
        )}
        <span className="fq-count">{rows.length} shown</span>
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
      ) : rows.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-circle-check" aria-hidden="true" /></div>
          <h3>Nothing here</h3>
          <p>No brackets match this filter. Switch to “All brackets” to see everything assigned to you.</p>
        </div>
      ) : (
        <div className="fq-grid">
          {rows.map((b) => {
            const mm = ballotMeta(b.myBallotStatus)
            const auto = b.singleFinalistAutoWin
            const key = `${b.categoryNumber}-${b.bracket}`
            return (
              <article
                key={key}
                className={`dash-card fq-card${auto ? ' is-auto' : ''}`}
                onClick={() => open(b)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(b) } }}
                role="button"
                tabIndex={0}
              >
                <div className="fq-card-top">
                  <span className="fq-cat">#{b.categoryNumber}</span>
                  {auto ? (
                    <span className="dash-badge tone-success"><i className="fas fa-trophy" aria-hidden="true" /> Automatic winner</span>
                  ) : (
                    <span className={`dash-badge tone-${mm.tone}`}><i className={`fas ${mm.icon}`} aria-hidden="true" /> {mm.label}</span>
                  )}
                </div>

                <h3 className="fq-card-title">{b.categoryName}</h3>
                <span className="fq-card-bracket"><i className="fas fa-layer-group" aria-hidden="true" /> {bracketLabel(b.bracket)}</span>

                <div className="fq-card-foot">
                  <span className="fq-finalists">
                    <i className="fas fa-users" aria-hidden="true" />
                    {b.finalistCount} finalist{b.finalistCount === 1 ? '' : 's'}
                  </span>
                  <span className="fq-cta">
                    {auto ? 'View' : b.myBallotStatus === 'Submitted' ? 'View ranking' : 'Rank finalists'}
                    <i className="fas fa-arrow-right" aria-hidden="true" />
                  </span>
                </div>
              </article>
            )
          })}
        </div>
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

        .fq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(288px, 1fr)); gap: 14px; }
        .fq-card { padding: 18px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; transition: var(--transition-fast); }
        .fq-card:hover, .fq-card:focus-visible { border-color: var(--gold); box-shadow: 0 8px 24px rgba(15,25,46,0.1); transform: translateY(-2px); outline: none; }
        .fq-card.is-auto { background: linear-gradient(180deg, rgba(200,168,75,0.07), var(--white) 60%); }
        .fq-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .fq-cat { display: inline-grid; place-items: center; min-width: 36px; height: 28px; padding: 0 8px; border-radius: 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); }
        .fq-card-title { font-family: var(--font-heading); font-size: 1rem; font-weight: 800; color: var(--navy); line-height: 1.35; }
        .fq-card-bracket { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 0.76rem; font-weight: 600; color: var(--gray-600); }
        .fq-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; padding-top: 12px; border-top: 1px solid var(--gray-100); }
        .fq-finalists { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--gray-600); }
        .fq-cta { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gold-dark); }
        .fq-card:hover .fq-cta i { transform: translateX(2px); transition: var(--transition-fast); }
      `}</style>
    </>
  )
}

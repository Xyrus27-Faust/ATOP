import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isReviewer } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import { formatDate } from '@/lib/pearlAwards'

const FILTERS = [
  { key: 'queue', label: 'Awaiting review', status: null },
  { key: 'Validated', label: 'Validated', status: 'Validated' },
  { key: 'ReturnedForRevision', label: 'Returned', status: 'ReturnedForRevision' },
  { key: 'Disqualified', label: 'Disqualified', status: 'Disqualified' },
]

export default function ReviewQueuePage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('queue')

  const { loading, error, data, reload } = useAsync(async () => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0]
    const path = f.status ? `/review/entries/?status=${f.status}` : '/review/entries/'
    const [entries, catalog] = await Promise.all([api.get(path, { auth: true }), api.get('/award-categories/')])
    return { entries, catalog }
  }, [filter])

  if (!isReviewer(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { entries, catalog } = data
  const nameByNumber = new Map(catalog.categories.map((c) => [c.number, c.name]))

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Secretariat · Review</span>
          <h1 className="dash-h1">Review queue</h1>
          <p className="dash-sub">Check submitted entries and validate, return for revision, or disqualify them.</p>
        </div>
      </div>

      <div className="rq-filters">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={`rq-chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-clipboard-check" aria-hidden="true" /></div>
          <h3>Nothing here</h3>
          <p>{filter === 'queue' ? 'No entries are waiting for review right now.' : 'No entries with this status.'}</p>
        </div>
      ) : (
        <div className="rq-list">
          {entries.map((e) => (
            <Link key={e.id} to={`/dashboard/review/${e.id}`} className="dash-card rq-row">
              <span className="rq-cat">#{e.categoryNumber}</span>
              <span className="rq-main">
                <span className="rq-title">{e.title}</span>
                <span className="rq-meta">{nameByNumber.get(e.categoryNumber) || `Category ${e.categoryNumber}`} · {e.lguName}</span>
              </span>
              <span className="rq-side">
                <StatusBadge status={e.status} />
                <span className="rq-date">{e.submittedAt ? `Submitted ${formatDate(e.submittedAt)}` : `Updated ${formatDate(e.updatedAt)}`}</span>
              </span>
              <i className="fas fa-chevron-right rq-chev" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .rq-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
        .rq-chip { font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--gray-200); background: var(--white); color: var(--gray-600); cursor: pointer; transition: var(--transition-fast); }
        .rq-chip:hover { border-color: var(--gold); color: var(--navy); }
        .rq-chip.active { background: var(--navy); color: var(--white); border-color: var(--navy); }
        .rq-list { display: flex; flex-direction: column; gap: 12px; }
        .rq-row { display: flex; align-items: center; gap: 16px; padding: 16px 18px; text-decoration: none; }
        .rq-row:hover { border-color: var(--gold); box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .rq-cat { width: 46px; height: 46px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; font-family: var(--font-heading); font-weight: 800; font-size: 0.95rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); }
        .rq-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .rq-title { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.98rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rq-meta { color: var(--gray-600); font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rq-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .rq-date { font-size: 0.74rem; color: var(--gray-400); font-family: var(--font-heading); font-weight: 600; }
        .rq-chev { color: var(--gray-400); flex-shrink: 0; }
        @media (max-width: 620px) {
          .rq-row { flex-wrap: wrap; }
          .rq-side { align-items: flex-start; width: 100%; flex-direction: row; justify-content: space-between; }
          .rq-chev { display: none; }
        }
      `}</style>
    </>
  )
}

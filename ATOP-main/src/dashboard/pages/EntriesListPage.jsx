import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import { ENTRY_STATUS, formatDate } from '@/lib/pearlAwards'

export default function EntriesListPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const { loading, error, data, reload } = useAsync(async () => {
    const [entries, catalog] = await Promise.all([
      api.get('/entries/', { auth: true }),
      api.get('/award-categories/'),
    ])
    return { entries, catalog }
  }, [])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { entries, catalog } = data
  const nameByNumber = new Map(catalog.categories.map((c) => [c.number, c.name]))
  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter)
  const presentStatuses = [...new Set(entries.map((e) => e.status))]

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Pearl Awards {catalog.year}</span>
          <h1 className="dash-h1">My entries</h1>
          <p className="dash-sub">Every entry you’ve created, and where each one stands in the review.</p>
        </div>
        <button className="dash-btn is-primary" onClick={() => navigate('/entries/new')}>
          <i className="fas fa-plus" aria-hidden="true" /> New entry
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-folder-open" aria-hidden="true" /></div>
          <h3>No entries yet</h3>
          <p>When you create an entry it appears here, with a readiness meter so you always know what’s left before you submit.</p>
          <button className="dash-btn is-primary" onClick={() => navigate('/entries/new')}>
            <i className="fas fa-plus" aria-hidden="true" /> Create your first entry
          </button>
        </div>
      ) : (
        <>
          <div className="el-filters">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={entries.length} />
            {presentStatuses.map((s) => (
              <Chip
                key={s}
                active={filter === s}
                onClick={() => setFilter(s)}
                label={ENTRY_STATUS[s]?.label || s}
                count={entries.filter((e) => e.status === s).length}
              />
            ))}
          </div>

          <div className="el-list">
            {filtered.map((e) => (
              <Link key={e.id} to={`/entries/${e.id}`} className="dash-card el-row">
                <span className="el-cat">#{e.categoryNumber}</span>
                <span className="el-main">
                  <span className="el-title">{e.title}</span>
                  <span className="el-meta">{nameByNumber.get(e.categoryNumber) || `Category ${e.categoryNumber}`} · {e.lguName}</span>
                </span>
                <span className="el-side">
                  <StatusBadge status={e.status} />
                  <span className="el-date">
                    {e.submittedAt ? `Submitted ${formatDate(e.submittedAt)}` : `Updated ${formatDate(e.updatedAt)}`}
                  </span>
                </span>
                <i className="fas fa-chevron-right el-chev" aria-hidden="true" />
              </Link>
            ))}
            {filtered.length === 0 && (
              <div className="dash-card dash-card-pad el-none">No entries with this status.</div>
            )}
          </div>
        </>
      )}

      <style>{`
        .el-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
        .el-chip {
          display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
          font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700;
          padding: 8px 14px; border-radius: 999px; border: 1px solid var(--gray-200);
          background: var(--white); color: var(--gray-600); transition: var(--transition-fast);
        }
        .el-chip:hover { border-color: var(--gold); color: var(--navy); }
        .el-chip.active { background: var(--navy); color: var(--white); border-color: var(--navy); }
        .el-chip-count { font-size: 0.7rem; opacity: 0.7; }
        .el-list { display: flex; flex-direction: column; gap: 12px; }
        .el-row { display: flex; align-items: center; gap: 16px; padding: 16px 18px; text-decoration: none; }
        .el-row:hover { border-color: var(--gold); box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .el-cat {
          width: 46px; height: 46px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center;
          font-family: var(--font-heading); font-weight: 800; font-size: 0.95rem; color: var(--gold-dark);
          background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22);
        }
        .el-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .el-title { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.98rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .el-meta { color: var(--gray-600); font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .el-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .el-date { font-size: 0.74rem; color: var(--gray-400); font-family: var(--font-heading); font-weight: 600; }
        .el-chev { color: var(--gray-400); flex-shrink: 0; }
        .el-none { text-align: center; color: var(--gray-600); }
        @media (max-width: 620px) {
          .el-row { flex-wrap: wrap; }
          .el-side { align-items: flex-start; width: 100%; flex-direction: row; justify-content: space-between; }
          .el-chev { display: none; }
        }
      `}</style>
    </>
  )
}

function Chip({ active, onClick, label, count }) {
  return (
    <button type="button" className={`el-chip${active ? ' active' : ''}`} onClick={onClick}>
      {label} <span className="el-chip-count">{count}</span>
    </button>
  )
}

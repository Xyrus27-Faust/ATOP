import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isReviewer, isAdmin } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import { LGU_LEVELS, REGIONS, labelFor } from '@/lib/pearlAwards'

// The board collapses the six entry statuses into a five-column funnel — the same grouping the
// applicant Overview uses — so a row reads left-to-right as an entry's journey.
const COLUMNS = [
  { key: 'draft', label: 'Draft', statuses: ['Draft'], tone: 'neutral' },
  { key: 'review', label: 'In review', statuses: ['Submitted', 'UnderValidation'], tone: 'info' },
  { key: 'returned', label: 'Returned', statuses: ['ReturnedForRevision'], tone: 'warn' },
  { key: 'validated', label: 'Validated', statuses: ['Validated'], tone: 'success' },
  { key: 'disqualified', label: 'Disqualified', statuses: ['Disqualified'], tone: 'danger' },
]

const DIMENSIONS = [
  { key: 'category', label: 'By category' },
  { key: 'level', label: 'By level' },
  { key: 'region', label: 'By region' },
]

// Group flat buckets into rows keyed by the chosen dimension, tallying per status + a row total.
function pivot(buckets, dim) {
  const rows = new Map()
  for (const b of buckets) {
    const key = dim === 'category' ? b.categoryNumber : dim === 'level' ? b.lguLevel : b.lguRegion
    let row = rows.get(key)
    if (!row) {
      row = { key, counts: {}, total: 0 }
      rows.set(key, row)
    }
    row.counts[b.status] = (row.counts[b.status] || 0) + b.count
    row.total += b.count
  }
  return rows
}

const sumStatuses = (counts, statuses) => statuses.reduce((n, s) => n + (counts[s] || 0), 0)

export default function SummaryPage() {
  const { user } = useAuth()
  const [dim, setDim] = useState('category')

  // One lightweight request: the summary carries its own (scoped) category names, so there's no
  // need to also pull the full award catalog just to label rows.
  const { loading, error, data, reload } = useAsync(
    () => api.get('/review/entries/summary', { auth: true }),
    [],
  )

  if (!isReviewer(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const admin = isAdmin(user?.roles)

  return (
    <SummaryBoard
      buckets={data.buckets || []}
      categories={data.categories || []}
      year={data.year}
      admin={admin}
      dim={dim}
      setDim={setDim}
    />
  )
}

function SummaryBoard({ buckets, categories, year, admin, dim, setDim }) {
  const nameByNumber = useMemo(
    () => new Map(categories.map((c) => [c.number, c.name])),
    [categories],
  )

  // Grand totals (per funnel column + overall) drive the headline cards.
  const totals = useMemo(() => {
    const counts = {}
    let total = 0
    for (const b of buckets) {
      counts[b.status] = (counts[b.status] || 0) + b.count
      total += b.count
    }
    return { counts, total }
  }, [buckets])

  // Ordered rows for the current pivot. Category sorts by number; level/region follow the
  // canonical vocab order so the table reads consistently regardless of what's populated.
  const rows = useMemo(() => {
    const map = pivot(buckets, dim)
    const order = (key) => {
      if (dim === 'category') return key
      const list = dim === 'level' ? LGU_LEVELS : REGIONS
      const i = list.findIndex((o) => o.value === key)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    const label = (key) => {
      if (dim === 'category') return `#${key} · ${nameByNumber.get(key) || `Category ${key}`}`
      return labelFor(dim === 'level' ? LGU_LEVELS : REGIONS, key)
    }
    return [...map.values()]
      .sort((a, b) => order(a.key) - order(b.key))
      .map((r) => ({ ...r, label: label(r.key) }))
  }, [buckets, dim, nameByNumber])

  const cards = [
    { label: 'Total entries', value: totals.total, icon: 'fa-layer-group', tone: 'neutral' },
    { label: 'In review', value: sumStatuses(totals.counts, ['Submitted', 'UnderValidation']), icon: 'fa-hourglass-half', tone: 'info' },
    { label: 'Validated', value: totals.counts.Validated || 0, icon: 'fa-circle-check', tone: 'success' },
    { label: 'Returned', value: totals.counts.ReturnedForRevision || 0, icon: 'fa-rotate-left', tone: 'warn' },
    { label: 'Disqualified', value: totals.counts.Disqualified || 0, icon: 'fa-circle-xmark', tone: 'danger' },
  ]

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Pearl Awards {year || ''} · Summary</span>
          <h1 className="dash-h1">Submissions at a glance</h1>
          <p className="dash-sub">
            Entry counts by status {admin ? 'across all award categories' : 'for your assigned categories'} — pivot by
            category, LGU level, or region.
          </p>
        </div>
      </div>

      {totals.total === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-chart-pie" aria-hidden="true" /></div>
          <h3>Nothing to summarise yet</h3>
          <p>{admin ? 'No entries have been created for this edition.' : 'No entries in your assigned categories yet.'}</p>
        </div>
      ) : (
        <>
          <div className="sum-cards" style={{ marginTop: 20 }}>
            {cards.map((c) => (
              <div key={c.label} className={`dash-card dash-stat sum-card tone-${c.tone}`}>
                <i className={`fas ${c.icon} dash-stat-icon`} aria-hidden="true" />
                <span className="dash-stat-value">{c.value}</span>
                <span className="dash-stat-label">{c.label}</span>
              </div>
            ))}
          </div>

          <div className="sum-toolbar" style={{ marginTop: 22 }}>
            <div className="sum-tabs" role="tablist" aria-label="Break down by">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  role="tab"
                  aria-selected={dim === d.key}
                  className={`sum-tab${dim === d.key ? ' is-active' : ''}`}
                  onClick={() => setDim(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dash-card sum-table-card">
            <div className="sum-scroll">
              <table className="sum-table">
                <thead>
                  <tr>
                    <th className="sum-th-row">{DIMENSIONS.find((d) => d.key === dim).label.replace('By ', '')}</th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="sum-th-num">{col.label}</th>
                    ))}
                    <th className="sum-th-num sum-th-total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td className="sum-rowhead">{r.label}</td>
                      {COLUMNS.map((col) => {
                        const n = sumStatuses(r.counts, col.statuses)
                        return (
                          <td key={col.key} className="sum-num">
                            <span className={n ? `sum-count tone-${col.tone}` : 'sum-zero'}>{n || '—'}</span>
                          </td>
                        )
                      })}
                      <td className="sum-num"><span className="sum-total">{r.total}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="sum-rowhead sum-foot">All</td>
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="sum-num sum-foot">{sumStatuses(totals.counts, col.statuses) || '—'}</td>
                    ))}
                    <td className="sum-num sum-foot"><span className="sum-total">{totals.total}</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        .sum-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
        .sum-card { position: relative; overflow: hidden; }
        .sum-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .sum-card.tone-info::before { background: var(--info, #3b82f6); }
        .sum-card.tone-success::before { background: var(--success, #16a34a); }
        .sum-card.tone-warn::before { background: var(--gold-dark); }
        .sum-card.tone-danger::before { background: var(--danger, #dc2626); }
        .sum-card.tone-neutral::before { background: var(--navy); }

        .sum-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .sum-tabs { display: inline-flex; gap: 4px; padding: 4px; background: var(--off-white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); }
        .sum-tab { background: none; border: none; cursor: pointer; padding: 7px 16px; border-radius: var(--radius-sm); font-family: var(--font-heading); font-weight: 700; font-size: 0.82rem; color: var(--gray-600); transition: var(--transition-fast); }
        .sum-tab:hover { color: var(--navy); }
        .sum-tab.is-active { background: var(--white); color: var(--navy); box-shadow: var(--shadow-sm, 0 1px 3px rgba(15,25,46,0.12)); }

        .sum-table-card { padding: 0; overflow: hidden; margin-top: 14px; }
        .sum-scroll { overflow-x: auto; }
        .sum-table { width: 100%; border-collapse: collapse; }
        .sum-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 12px 16px; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); white-space: nowrap; }
        .sum-th-row { text-align: left; }
        .sum-th-num { text-align: right; }
        .sum-th-total { color: var(--navy); }
        .sum-table tbody tr { border-bottom: 1px solid var(--gray-100); }
        .sum-table tbody tr:last-child { border-bottom: none; }
        .sum-table tbody tr:hover { background: rgba(200,168,75,0.06); }
        .sum-table td { padding: 12px 16px; vertical-align: middle; }
        .sum-rowhead { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; white-space: nowrap; }
        .sum-num { text-align: right; font-variant-numeric: tabular-nums; }
        .sum-count { font-family: var(--font-heading); font-weight: 800; font-size: 0.95rem; }
        .sum-count.tone-info { color: var(--info, #3b82f6); }
        .sum-count.tone-success { color: var(--success, #16a34a); }
        .sum-count.tone-warn { color: var(--gold-dark); }
        .sum-count.tone-danger { color: var(--danger, #dc2626); }
        .sum-count.tone-neutral { color: var(--navy); }
        .sum-zero { color: var(--gray-300); }
        .sum-total { font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
        .sum-table tfoot td { border-top: 2px solid var(--gray-200); }
        .sum-foot { font-family: var(--font-heading); font-weight: 800; color: var(--navy); background: var(--off-white); }
      `}</style>
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isReviewer } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import { formatDate } from '@/lib/pearlAwards'

// Status is a server-side view: "Awaiting review" is the composite queue the API
// returns with no filter; the rest map to a single status query param.
const STATUS_VIEWS = [
  { key: 'queue', label: 'Awaiting review', status: null },
  { key: 'Validated', label: 'Validated', status: 'Validated' },
  { key: 'ReturnedForRevision', label: 'Returned for revision', status: 'ReturnedForRevision' },
  { key: 'Disqualified', label: 'Disqualified', status: 'Disqualified' },
]

const submittedTime = (e) => new Date(e.submittedAt || e.updatedAt).getTime()

function compare(a, b, key) {
  switch (key) {
    case 'categoryNumber': return a.categoryNumber - b.categoryNumber
    case 'title': return (a.title || '').localeCompare(b.title || '')
    case 'lguName': return (a.lguName || '').localeCompare(b.lguName || '')
    case 'status': return (a.status || '').localeCompare(b.status || '')
    case 'submittedAt': return submittedTime(a) - submittedTime(b)
    default: return 0
  }
}

function Th({ label, sortKey, sort, onSort, className }) {
  const active = sort.key === sortKey
  const icon = active ? (sort.dir === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short') : 'fa-sort'
  return (
    <th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`rqt-th${active ? ' is-active' : ''}`} onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <i className={`fas ${icon} rqt-sort`} aria-hidden="true" />
      </button>
    </th>
  )
}

// Type-ahead LGU filter backed by the canonical PSGC table (GET /lgus/search). Picking an LGU
// filters the queue by its code; the province · region context disambiguates same-named towns.
function LguSearchSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const t = setTimeout(() => {
      setLoading(true)
      api.get(`/lgus/search?q=${encodeURIComponent(q)}&limit=20`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function pick(r) {
    onChange({ code: r.code, name: r.name })
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const term = query.trim()
  return (
    <div className="rq-lgu" ref={ref}>
      {value ? (
        <div className="rq-lgu-chip">
          <i className="fas fa-location-dot" aria-hidden="true" />
          <span className="rq-lgu-chip-name">{value.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Clear LGU filter">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="rq-lgu-field">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="dash-input"
            type="search"
            placeholder="Filter by LGU…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            aria-label="Filter by LGU"
          />
        </div>
      )}
      {open && !value && term.length >= 2 && (
        <div className="rq-lgu-menu" role="listbox">
          {loading && <div className="rq-lgu-note">Searching…</div>}
          {!loading && results.length === 0 && <div className="rq-lgu-note">No LGU matches “{term}”.</div>}
          {results.map((r) => (
            <button type="button" key={r.code} className="rq-lgu-opt" role="option" onClick={() => pick(r)}>
              <span className="rq-lgu-opt-name">{r.name}</span>
              <span className="rq-lgu-opt-ctx">{r.context}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReviewQueuePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState('queue')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedLgu, setSelectedLgu] = useState(null) // { code, name } from the LGU search
  const [sort, setSort] = useState({ key: 'submittedAt', dir: 'desc' })

  const { loading, error, data, reload } = useAsync(async () => {
    const v = STATUS_VIEWS.find((x) => x.key === view) || STATUS_VIEWS[0]
    const path = v.status ? `/review/entries/?status=${v.status}` : '/review/entries/'
    const [entries, catalog] = await Promise.all([api.get(path, { auth: true }), api.get('/award-categories/')])
    return { entries, catalog }
  }, [view])

  const entries = data?.entries
  const catalog = data?.catalog

  const nameByNumber = useMemo(
    () => new Map((catalog?.categories || []).map((c) => [c.number, c.name])),
    [catalog],
  )

  // Filter options derive from what's actually in the loaded set, so a filter
  // never offers a value that yields nothing.
  const categoryOptions = useMemo(() => {
    const nums = [...new Set((entries || []).map((e) => e.categoryNumber))].sort((a, b) => a - b)
    return nums.map((n) => ({ value: String(n), label: `#${n} · ${nameByNumber.get(n) || `Category ${n}`}` }))
  }, [entries, nameByNumber])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = (entries || []).filter((e) => {
      if (category !== 'all' && String(e.categoryNumber) !== category) return false
      if (selectedLgu && e.lguCode !== selectedLgu.code) return false
      if (term && !`${e.title} ${e.lguName}`.toLowerCase().includes(term)) return false
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return filtered.sort((a, b) => compare(a, b, sort.key) * dir)
  }, [entries, search, category, selectedLgu, sort])

  if (!isReviewer(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  function onView(next) {
    setView(next)
    setCategory('all') // option sets change with the loaded view
    setSelectedLgu(null)
  }

  function onSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const filtersActive = search.trim() !== '' || category !== 'all' || selectedLgu != null
  const total = entries?.length || 0

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Secretariat · Review</span>
          <h1 className="dash-h1">Review queue</h1>
          <p className="dash-sub">Check submitted entries and validate, return for revision, or disqualify them.</p>
        </div>
      </div>

      <div className="rqt-controls">
        <div className="rqt-search">
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

        <select className="dash-select" value={view} onChange={(e) => onView(e.target.value)} aria-label="Status">
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

        <LguSearchSelect value={selectedLgu} onChange={setSelectedLgu} />

        <div className="rqt-meta">
          <span className="rqt-count">{rows.length} of {total}</span>
          {filtersActive && (
            <button type="button" className="rqt-clear" onClick={() => { setSearch(''); setCategory('all'); setSelectedLgu(null) }}>
              <i className="fas fa-xmark" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-clipboard-check" aria-hidden="true" /></div>
          <h3>Nothing here</h3>
          <p>{view === 'queue' ? 'No entries are waiting for review right now.' : 'No entries with this status.'}</p>
        </div>
      ) : (
        <div className="dash-card rqt-card">
          <div className="rqt-scroll">
            <table className="rqt-table">
              <thead>
                <tr>
                  <Th label="#" sortKey="categoryNumber" sort={sort} onSort={onSort} className="rqt-th-num" />
                  <Th label="Entry" sortKey="title" sort={sort} onSort={onSort} />
                  <Th label="LGU" sortKey="lguName" sort={sort} onSort={onSort} />
                  <Th label="Status" sortKey="status" sort={sort} onSort={onSort} />
                  <Th label="Submitted" sortKey="submittedAt" sort={sort} onSort={onSort} />
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="rqt-norows">No entries match your filters.</td>
                  </tr>
                ) : (
                  rows.map((e) => (
                    <tr
                      key={e.id}
                      className="rqt-row"
                      onClick={(ev) => { if (!ev.target.closest('a')) navigate(`/dashboard/review/${e.id}`) }}
                    >
                      <td className="rqt-num"><span className="rqt-cat">#{e.categoryNumber}</span></td>
                      <td className="rqt-entry">
                        <Link to={`/dashboard/review/${e.id}`} className="rqt-title">{e.title}</Link>
                        <span className="rqt-catname">{nameByNumber.get(e.categoryNumber) || `Category ${e.categoryNumber}`}</span>
                      </td>
                      <td className="rqt-lgu">{e.lguName}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td className="rqt-date">{e.submittedAt ? formatDate(e.submittedAt) : formatDate(e.updatedAt)}</td>
                      <td className="rqt-chevcell"><i className="fas fa-chevron-right rqt-chev" aria-hidden="true" /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        /* position+z-index so the LGU dropdown paints above the table card below it
           (each dash-content child gets its own stacking context via dash-fade). */
        .rqt-controls { position: relative; z-index: 20; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
        .rqt-search { position: relative; flex: 1 1 240px; min-width: 200px; }
        .rqt-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .rqt-search .dash-input { padding-left: 36px; }
        .rqt-controls .dash-select { width: auto; min-width: 152px; }

        /* LGU type-ahead filter */
        .rq-lgu { position: relative; flex: 0 1 240px; min-width: 200px; }
        .rq-lgu-field { position: relative; }
        .rq-lgu-field i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .rq-lgu-field .dash-input { padding-left: 36px; }
        .rq-lgu-chip { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 6px 0 13px; border: 1px solid var(--gold); background: rgba(200,168,75,0.08); border-radius: var(--radius-sm); }
        .rq-lgu-chip > i { color: var(--gold-dark); font-size: 0.82rem; flex-shrink: 0; }
        .rq-lgu-chip-name { font-family: var(--font-heading); font-size: 0.84rem; font-weight: 700; color: var(--navy); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rq-lgu-chip button { margin-left: auto; display: grid; place-items: center; background: none; border: none; color: var(--gray-600); cursor: pointer; padding: 5px; border-radius: 6px; }
        .rq-lgu-chip button:hover { color: var(--navy); background: rgba(0,0,0,0.05); }
        .rq-lgu-menu { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; right: 0; min-width: 264px; max-height: 320px; overflow-y: auto; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-lg, 0 18px 44px rgba(15,25,46,0.18)); padding: 5px; }
        .rq-lgu-note { padding: 11px 12px; color: var(--gray-600); font-size: 0.84rem; font-family: var(--font-body); }
        .rq-lgu-opt { display: flex; flex-direction: column; gap: 1px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 9px 11px; border-radius: var(--radius-sm); }
        .rq-lgu-opt:hover { background: var(--gray-100); }
        .rq-lgu-opt-name { font-family: var(--font-heading); font-weight: 700; font-size: 0.86rem; color: var(--navy); }
        .rq-lgu-opt-ctx { font-size: 0.76rem; color: var(--gray-600); }

        .rqt-meta { display: flex; align-items: center; gap: 12px; margin-left: auto; }
        .rqt-count { font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--gray-600); white-space: nowrap; }
        .rqt-clear { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--gold-dark); font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; cursor: pointer; padding: 0; }
        .rqt-clear:hover { color: var(--navy); }

        .rqt-card { padding: 0; overflow: hidden; }
        .rqt-scroll { overflow-x: auto; }
        .rqt-table { width: 100%; border-collapse: collapse; }
        .rqt-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 0; white-space: nowrap; }
        .rqt-th { display: inline-flex; align-items: center; gap: 7px; width: 100%; background: none; border: none; cursor: pointer; padding: 12px 16px; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); transition: var(--transition-fast); }
        .rqt-th:hover, .rqt-th.is-active { color: var(--navy); }
        .rqt-sort { font-size: 0.7rem; color: var(--gray-300); }
        .rqt-th.is-active .rqt-sort { color: var(--gold-dark); }
        .rqt-th-num .rqt-th { padding-right: 8px; }

        .rqt-table tbody tr { border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: var(--transition-fast); }
        .rqt-table tbody tr:last-child { border-bottom: none; }
        .rqt-row:hover { background: rgba(200,168,75,0.06); }
        .rqt-table td { padding: 13px 16px; vertical-align: middle; }
        .rqt-num { width: 56px; }
        .rqt-cat { display: inline-grid; place-items: center; min-width: 36px; height: 28px; padding: 0 8px; border-radius: 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22); }
        .rqt-entry { min-width: 220px; }
        .rqt-title { display: block; font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; text-decoration: none; }
        .rqt-title:hover { color: var(--gold-dark); text-decoration: underline; }
        .rqt-catname { display: block; color: var(--gray-600); font-size: 0.78rem; margin-top: 2px; }
        .rqt-lgu { color: var(--text-body); font-size: 0.88rem; white-space: nowrap; }
        .rqt-date { color: var(--gray-600); font-size: 0.82rem; white-space: nowrap; font-family: var(--font-heading); font-weight: 600; }
        .rqt-chevcell { width: 38px; text-align: right; }
        .rqt-chev { color: var(--gray-300); }
        .rqt-norows { padding: 40px 16px; text-align: center; color: var(--gray-600); font-family: var(--font-body); }

        @media (max-width: 720px) {
          .rqt-catname { display: none; }
          .rqt-meta { width: 100%; margin-left: 0; justify-content: space-between; }
          .rqt-controls .dash-select, .rq-lgu { flex: 1 1 auto; }
        }
      `}</style>
    </>
  )
}

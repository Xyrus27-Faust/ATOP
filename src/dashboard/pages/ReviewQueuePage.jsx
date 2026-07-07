import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isReviewer, isAdmin } from '../dashboardNav'
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

// Admin-only views: inspect drafts, and every entry at once (all statuses, including
// not-yet-submitted). `all` is a server-side flag that drops the status filter.
const ADMIN_VIEWS = [
  { key: 'Draft', label: 'Drafts', status: 'Draft' },
  { key: 'all', label: 'All submissions', status: 'all' },
]
const ALL_VIEWS = [...STATUS_VIEWS, ...ADMIN_VIEWS]
const PAGE_SIZES = [25, 50, 100]

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
  const admin = isAdmin(user?.roles)

  const [view, setView] = useState(admin ? 'all' : 'queue')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedLgu, setSelectedLgu] = useState(null) // { code, name } from the LGU search
  const [sort, setSort] = useState({ key: 'submittedAt', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [reminding, setReminding] = useState(false)
  const [remindMsg, setRemindMsg] = useState(null)

  // Admins see the oversight "Submissions" framing (every status incl. drafts, defaults to All);
  // other reviewers get the focused review queue.
  const views = admin ? ALL_VIEWS : STATUS_VIEWS

  // Debounce the search box so it fires one request after typing settles; a new term starts at page 1.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  // The category catalog is static — load it once, not on every page/filter change.
  const catalogAsync = useAsync(() => api.get('/award-categories/'), [])

  // The entry list is fully server-driven: status, search, filters, sort and paging are all query
  // params, so each concern spans the whole set rather than just the rows currently on screen.
  const { loading, error, data, reload } = useAsync(() => {
    const v = ALL_VIEWS.find((x) => x.key === view) || ALL_VIEWS[0]
    const params = new URLSearchParams()
    if (v.status) params.set('status', v.status)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (category !== 'all') params.set('category', category)
    if (selectedLgu) params.set('lgu', selectedLgu.code)
    params.set('sort', sort.key)
    params.set('dir', sort.dir)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return api.get(`/review/entries/?${params.toString()}`, { auth: true })
  }, [view, debouncedSearch, category, selectedLgu, sort, page, pageSize])

  const catalog = catalogAsync.data
  const nameByNumber = useMemo(
    () => new Map((catalog?.categories || []).map((c) => [c.number, c.name])),
    [catalog],
  )
  // Options come from the full catalog (not the current page), so filtering is meaningful across pages.
  const categoryOptions = useMemo(
    () => [...(catalog?.categories || [])]
      .sort((a, b) => a.number - b.number)
      .map((c) => ({ value: String(c.number), label: `#${c.number} · ${c.name}` })),
    [catalog],
  )

  const items = data?.items || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filtersActive = search.trim() !== '' || category !== 'all' || selectedLgu != null

  if (!isReviewer(user?.roles)) return <Navigate to="/dashboard" replace />
  // First paint waits for the catalog + the first page; later refetches keep the table mounted.
  if (catalogAsync.loading || (loading && !data)) return <Loading />
  if (catalogAsync.error) return <ErrorState error={catalogAsync.error} onRetry={catalogAsync.reload} />
  if (error) return <ErrorState error={error} onRetry={reload} />

  function onView(next) {
    setView(next)
    setCategory('all') // option sets don't change, but a new view starts fresh
    setSelectedLgu(null)
    setPage(1)
  }
  function onCategory(next) { setCategory(next); setPage(1) }
  function onLgu(next) { setSelectedLgu(next); setPage(1) }
  function onSort(key) {
    setSort((s) => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'submittedAt' ? 'desc' : 'asc' }))
    setPage(1)
  }
  function clearFilters() { setSearch(''); setCategory('all'); setSelectedLgu(null); setPage(1) }
  function goto(p) { setPage(Math.min(totalPages, Math.max(1, p))) }

  async function remindDrafts() {
    if (reminding) return
    setReminding(true); setRemindMsg(null)
    try {
      const res = await api.post('/admin/entries/remind-drafts', undefined, { auth: true })
      const n = res?.ownersReminded ?? 0
      setRemindMsg(`Reminder sent to ${n} applicant${n === 1 ? '' : 's'} with unsubmitted drafts.`)
    } catch {
      setRemindMsg('Couldn’t send reminders — please try again.')
    } finally {
      setReminding(false)
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{admin ? 'Admin · Submissions' : 'Secretariat · Review'}</span>
          <h1 className="dash-h1">{admin ? 'Submissions' : 'Review queue'}</h1>
          <p className="dash-sub">{admin
            ? 'Every entry across all categories — drafts, submitted, and decided. Open one to review or act on it.'
            : 'Check submitted entries and validate, return for revision, or disqualify them.'}</p>
        </div>
        {admin && (
          <button type="button" className="dash-btn is-primary" onClick={remindDrafts} disabled={reminding}
            title="Email every applicant who still has an unsubmitted draft">
            <i className="fas fa-bell" aria-hidden="true" /> {reminding ? 'Sending…' : 'Remind unsubmitted drafts'}
          </button>
        )}
      </div>
      {remindMsg && (
        <div className="dash-banner tone-info" style={{ marginTop: 12 }}>
          <i className="fas fa-circle-info" aria-hidden="true" /> {remindMsg}
        </div>
      )}

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
          {views.map((v) => (
            <option key={v.key} value={v.key}>{v.label}</option>
          ))}
        </select>

        <select className="dash-select" value={category} onChange={(e) => onCategory(e.target.value)} aria-label="Award category">
          <option value="all">All categories</option>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <LguSearchSelect value={selectedLgu} onChange={onLgu} />

        <div className="rqt-meta">
          <span className="rqt-count">
            {total === 0 ? '0 entries' : `${rangeStart}–${rangeEnd} of ${total}`}
          </span>
          {filtersActive && (
            <button type="button" className="rqt-clear" onClick={clearFilters}>
              <i className="fas fa-xmark" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-clipboard-check" aria-hidden="true" /></div>
          <h3>{filtersActive ? 'No matches' : 'Nothing here'}</h3>
          <p>{filtersActive
            ? 'No entries match your filters. Try widening or clearing them.'
            : view === 'queue' ? 'No entries are waiting for review right now.'
            : view === 'all' ? 'No entries yet.' : 'No entries with this status.'}</p>
        </div>
      ) : (
        <>
          <div className={`dash-card rqt-card${loading ? ' is-loading' : ''}`} aria-busy={loading}>
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
                  {items.map((e) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rqt-pager">
            <div className="rqt-pgsize">
              <label htmlFor="rqt-pgsize">Rows</label>
              <select
                id="rqt-pgsize"
                className="dash-select"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="rqt-pgnav">
              <button type="button" className="rqt-pgbtn" onClick={() => goto(1)} disabled={page <= 1 || loading} aria-label="First page">
                <i className="fas fa-angles-left" aria-hidden="true" />
              </button>
              <button type="button" className="rqt-pgbtn" onClick={() => goto(page - 1)} disabled={page <= 1 || loading} aria-label="Previous page">
                <i className="fas fa-angle-left" aria-hidden="true" />
              </button>
              <span className="rqt-pgnow">Page {page} of {totalPages}</span>
              <button type="button" className="rqt-pgbtn" onClick={() => goto(page + 1)} disabled={page >= totalPages || loading} aria-label="Next page">
                <i className="fas fa-angle-right" aria-hidden="true" />
              </button>
              <button type="button" className="rqt-pgbtn" onClick={() => goto(totalPages)} disabled={page >= totalPages || loading} aria-label="Last page">
                <i className="fas fa-angles-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
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

        .rqt-card { padding: 0; overflow: hidden; transition: opacity 0.15s ease; }
        .rqt-card.is-loading { opacity: 0.55; pointer-events: none; }
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

        /* Pager */
        .rqt-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
        .rqt-pgsize { display: flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--gray-600); }
        .rqt-pgsize .dash-select { width: auto; min-width: 72px; }
        .rqt-pgnav { display: flex; align-items: center; gap: 6px; margin-left: auto; }
        .rqt-pgnow { font-family: var(--font-heading); font-size: 0.8rem; font-weight: 700; color: var(--navy); padding: 0 8px; white-space: nowrap; }
        .rqt-pgbtn { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--gray-200); background: var(--white); color: var(--navy); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition-fast); }
        .rqt-pgbtn:hover:not(:disabled) { border-color: var(--gold); background: rgba(200,168,75,0.08); }
        .rqt-pgbtn:disabled { color: var(--gray-300); cursor: not-allowed; background: var(--off-white); }

        @media (max-width: 720px) {
          .rqt-catname { display: none; }
          .rqt-meta { width: 100%; margin-left: 0; justify-content: space-between; }
          .rqt-controls .dash-select, .rq-lgu { flex: 1 1 auto; }
          .rqt-pgnav { margin-left: 0; }
        }
      `}</style>
    </>
  )
}

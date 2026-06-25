import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { useFavorites } from '../useFavorites'
import { Loading, ErrorState } from '../components/states'
import { ENTRANT_TYPE_LABELS, submissionWindow, formatDate } from '@/lib/pearlAwards'

// Compact entrant labels for the small card badge (the full labels live in the
// detail view, where there's room for them).
const ENTRANT_SHORT = {
  Lgu: 'LGU',
  OfficersOrganization: 'Officers’ Org',
  Individual: 'Individual',
}

// One filter per entrant type, plus "All". Built from the catalog so it only
// ever offers types that actually have categories.
const ENTRANT_ORDER = ['Lgu', 'OfficersOrganization', 'Individual']

export default function AwardCategoriesPage() {
  const navigate = useNavigate()
  const { loading, error, data, reload } = useAsync(() => api.get('/award-categories/'), [])
  const { favorites, toggle } = useFavorites()
  const [entrant, setEntrant] = useState('all')
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const categories = useMemo(() => data?.categories ?? [], [data])
  const present = useMemo(
    () => ENTRANT_ORDER.filter((t) => categories.some((c) => c.entrantType === t)),
    [categories],
  )

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const catalog = data
  const win = submissionWindow(catalog)
  const q = query.trim().toLowerCase()
  const shown = categories.filter((c) => {
    if (favoritesOnly && !favorites.has(c.number)) return false
    if (entrant !== 'all' && c.entrantType !== entrant) return false
    if (q && !`#${c.number} ${c.name} ${c.definition}`.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Pearl Awards {catalog.year}</span>
          <h1 className="dash-h1">Award categories</h1>
          <p className="dash-sub">
            Coverage year {catalog.coverageYear}.{' '}
            {win?.state === 'open'
              ? `Submissions close ${formatDate(win.closes)}.`
              : win?.state === 'upcoming'
              ? `Submissions open ${formatDate(win.opens)}.`
              : `Submissions closed ${formatDate(win?.closes)}.`}{' '}
            Pick a category to see its criteria and what you’ll need to submit.
          </p>
        </div>
        <button className="dash-btn is-primary" onClick={() => navigate('/dashboard/entries/new')}>
          <i className="fas fa-plus" aria-hidden="true" /> New entry
        </button>
      </div>

      <div className="awc-toolbar">
        <div className="awc-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            className="dash-input awc-search-input"
            placeholder="Search categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search award categories"
          />
        </div>
        <div className="awc-filters" role="group" aria-label="Filter categories">
          <button
            type="button"
            className={`awc-chip awc-chip-fav${favoritesOnly ? ' active' : ''}`}
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
          >
            <i className={favoritesOnly ? 'fas fa-star' : 'far fa-star'} aria-hidden="true" /> Favorites
            <span className="awc-chip-count">{favorites.size}</span>
          </button>
          {present.length > 1 && (
            <>
              <span className="awc-sep" aria-hidden="true" />
              <FilterChip active={entrant === 'all'} onClick={() => setEntrant('all')} label="All" count={categories.length} />
              {present.map((t) => (
                <FilterChip
                  key={t}
                  active={entrant === t}
                  onClick={() => setEntrant(t)}
                  label={ENTRANT_TYPE_LABELS[t] || t}
                  count={categories.filter((c) => c.entrantType === t).length}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <div className="awc-grid">
        {shown.map((c) => {
          const totalPoints = c.criteria.reduce((s, k) => s + k.points, 0)
          const required = (c.requiredSubmissions || []).filter((s) => s.mandatory).length
          const isFav = favorites.has(c.number)
          return (
            <div key={c.number} className="awc-cell">
              <Link to={`/dashboard/awards/${c.number}`} className="dash-card awc-card">
                <div className="awc-card-top">
                  <span className="awc-num">{c.number}</span>
                  <span className="dash-badge tone-neutral awc-type">{ENTRANT_SHORT[c.entrantType] || c.entrantType}</span>
                </div>
                <h2 className="awc-name">{c.name}</h2>
                <p className="awc-def">{c.definition}</p>
                <div className="awc-stats">
                  <span><i className="fas fa-star" aria-hidden="true" /> {totalPoints} pts</span>
                  <span aria-hidden="true">·</span>
                  <span><i className="fas fa-list-check" aria-hidden="true" /> {c.criteria.length} criteria</span>
                  {required > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span><i className="fas fa-paperclip" aria-hidden="true" /> {required} required</span>
                    </>
                  )}
                </div>
                <span className="awc-go" aria-hidden="true">
                  View criteria <i className="fas fa-arrow-right" />
                </span>
              </Link>
              <button
                type="button"
                className={`awc-fav${isFav ? ' is-on' : ''}`}
                onClick={() => toggle(c.number)}
                aria-pressed={isFav}
                aria-label={isFav ? `Remove ${c.name} from favorites` : `Add ${c.name} to favorites`}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <i className={isFav ? 'fas fa-star' : 'far fa-star'} aria-hidden="true" />
              </button>
            </div>
          )
        })}
        {shown.length === 0 && (
          <div className="dash-card dash-card-pad awc-none">
            {favoritesOnly && favorites.size === 0 ? (
              <>Nothing saved yet. Tap the <i className="far fa-star" aria-hidden="true" /> on any category to keep it here.</>
            ) : (
              <>
                No categories match{q ? ` “${query.trim()}”` : ' these filters'}.{' '}
                <button type="button" className="awc-clear" onClick={() => { setQuery(''); setEntrant('all'); setFavoritesOnly(false) }}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .awc-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
        .awc-search { position: relative; flex: 1 1 240px; max-width: 380px; }
        .awc-search i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .awc-search-input { padding-left: 38px; }
        .awc-filters { display: flex; flex-wrap: wrap; gap: 8px; }
        .awc-chip {
          display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
          font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700;
          padding: 8px 14px; border-radius: 999px; border: 1px solid var(--gray-200);
          background: var(--white); color: var(--gray-600); transition: var(--transition-fast);
        }
        .awc-chip:hover { border-color: var(--gold); color: var(--navy); }
        .awc-chip.active { background: var(--navy); color: var(--white); border-color: var(--navy); }
        .awc-chip-count { font-size: 0.7rem; opacity: 0.7; }
        .awc-chip-fav i { color: var(--gold-dark); font-size: 0.8rem; }
        .awc-chip-fav.active { background: var(--gold); border-color: var(--gold); color: var(--white); }
        .awc-chip-fav.active i { color: var(--white); }
        .awc-sep { width: 1px; align-self: stretch; background: var(--gray-200); margin: 2px 4px; }

        .awc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; align-items: start; }

        .awc-cell { position: relative; height: 100%; }
        .awc-card { display: flex; flex-direction: column; gap: 10px; padding: 20px; text-decoration: none; height: 100%; }
        .awc-card:hover { border-color: var(--gold); box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .awc-card:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

        .awc-fav {
          position: absolute; top: 12px; right: 12px; z-index: 2;
          width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%;
          border: 1px solid transparent; background: transparent; color: var(--gray-400);
          cursor: pointer; font-size: 0.95rem; transition: var(--transition-fast);
        }
        .awc-fav:hover { background: rgba(200,168,75,0.14); color: var(--gold-dark); }
        .awc-fav.is-on { color: var(--gold); }
        .awc-fav:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

        .awc-card-top { display: flex; align-items: center; gap: 10px; padding-right: 34px; }
        .awc-num {
          font-family: var(--font-heading); font-weight: 800; font-size: 1rem; line-height: 1; color: var(--gold-dark);
          width: 40px; height: 40px; flex-shrink: 0; border-radius: 11px; display: grid; place-items: center;
          background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.22);
        }
        .awc-num::before { content: '#'; font-size: 0.68rem; margin-right: 1px; opacity: 0.7; }
        .awc-type { flex-shrink: 0; }

        .awc-name { font-family: var(--font-heading); font-size: 1.12rem; font-weight: 800; color: var(--navy); line-height: 1.25; }
        .awc-def {
          color: var(--gray-600); font-size: 0.86rem; line-height: 1.55; flex: 1;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .awc-stats {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
          font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700; color: var(--navy);
          padding-top: 12px; border-top: 1px solid var(--gray-100);
        }
        .awc-stats i { color: var(--gold-dark); margin-right: 4px; font-size: 0.72rem; }
        .awc-stats span[aria-hidden] { color: var(--gray-300, #cbd5e1); font-weight: 400; }

        .awc-go {
          display: inline-flex; align-items: center; gap: 7px; margin-top: 2px;
          font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--gold-dark);
        }
        .awc-card:hover .awc-go { gap: 11px; }
        .awc-go i { transition: var(--transition-fast); }

        .awc-none { grid-column: 1 / -1; text-align: center; color: var(--gray-600); }
        .awc-clear { background: none; border: none; cursor: pointer; color: var(--gold-dark); font-family: var(--font-heading); font-weight: 700; font-size: inherit; text-decoration: underline; padding: 0; }
        .awc-clear:hover { color: var(--navy); }

        @media (prefers-reduced-motion: reduce) {
          .awc-card:hover { transform: none; }
        }
      `}</style>
    </>
  )
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button type="button" className={`awc-chip${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
      {label} <span className="awc-chip-count">{count}</span>
    </button>
  )
}

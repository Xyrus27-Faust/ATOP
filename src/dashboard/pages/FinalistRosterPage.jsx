import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { bracketLabel } from '@/lib/pearlAwards'

// The official List of Finalists is laid out as one row per category across four LGU-level columns,
// so this page is too — read side by side, a difference is a cell that doesn't match rather than a
// name to hunt for. Category 12 has no level to split on and spans the full width instead.
const COLUMNS = ['Province', 'HUC', 'ComponentCity', 'Municipality']

const mean = (n) => (n == null ? null : Number(n).toFixed(2))

function Finalist({ f, showRank }) {
  return (
    <div className="fx-entry">
      {showRank && <span className="fx-rank">{f.preFinalsRank ?? '—'}</span>}
      <span className="fx-body">
        <span className="fx-title">{f.title}</span>
        <span className="fx-lgu">
          {f.lguName}
          {f.preFinalsMean != null && <span className="fx-mean"> · {mean(f.preFinalsMean)}</span>}
        </span>
      </span>
    </div>
  )
}

export default function FinalistRosterPage() {
  const { user } = useAuth()
  const [showRank, setShowRank] = useState(true)
  const [query, setQuery] = useState('')

  const { loading, error, data, reload } = useAsync(
    () => api.get('/admin/finals/finalists', { auth: true }),
    [],
  )

  const q = query.trim().toLowerCase()
  const categories = useMemo(() => {
    const all = data?.categories || []
    if (!q) return all
    // Filter to the entries that match, keeping the category/bracket shape so the layout holds.
    return all
      .map((c) => ({
        ...c,
        brackets: c.brackets
          .map((b) => ({
            ...b,
            finalists: b.finalists.filter(
              (f) => f.title.toLowerCase().includes(q) || f.lguName.toLowerCase().includes(q),
            ),
          }))
          .filter((b) => b.finalists.length > 0),
      }))
      .filter((c) => c.brackets.length > 0)
  }, [data, q])

  const shown = useMemo(
    () => categories.reduce((n, c) => n + c.brackets.reduce((m, b) => m + b.finalists.length, 0), 0),
    [categories],
  )

  if (!isAdmin(user?.roles)) return <Navigate to="/dashboard" replace />

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Admin · Finals</span>
          <h1 className="dash-h1">All finalists</h1>
          <p className="dash-sub">
            Every finalist in the edition, by category and bracket — laid out the way the official
            list is, to be read against it.
          </p>
        </div>
      </div>

      {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <div className="dash-card fx-bar">
            <div className="fx-counts">
              <span className="fx-total">{data.totalFinalists}</span>
              <span className="fx-total-label">
                finalists · {data.categoriesFinalized} of {data.categories.length} categories finalized
              </span>
            </div>
            <div className="fx-tools">
              <input
                type="search"
                className="dash-input fx-search"
                placeholder="Find a title or LGU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter finalists by title or LGU"
              />
              <label className="fx-toggle">
                <input type="checkbox" checked={showRank} onChange={(e) => setShowRank(e.target.checked)} />
                Show rank &amp; score
              </label>
            </div>
          </div>

          {q && (
            <p className="fx-filtered">
              {shown === 0
                ? <>Nothing matches “{query}”.</>
                : <>Showing <b>{shown}</b> of {data.totalFinalists} finalists matching “{query}”.</>}
            </p>
          )}

          {categories.map((c) => {
            const byBracket = Object.fromEntries(c.brackets.map((b) => [b.bracket, b]))
            const rows = Math.max(0, ...COLUMNS.map((k) => byBracket[k]?.finalists.length || 0))

            return (
              <section key={c.number} className="dash-card fx-cat">
                <header className="fx-cat-head">
                  <span className="fx-cat-num">C{c.number}</span>
                  <h2 className="fx-cat-name">{c.name}</h2>
                  <span className="fx-cat-count">
                    {c.finalistCount} finalist{c.finalistCount === 1 ? '' : 's'}
                  </span>
                  {!c.scoringFinalized && (
                    <span className="dash-badge tone-warn">
                      <i className="fas fa-triangle-exclamation" aria-hidden="true" /> Not finalized
                    </span>
                  )}
                </header>

                {c.finalistCount === 0 ? (
                  <p className="fx-empty">No finalists in this category.</p>
                ) : !c.splitsByLevel ? (
                  // One pool — the entrant is an association with no LGU level of its own.
                  <div className="fx-single">
                    <span className="fx-col-head">{bracketLabel('All')}</span>
                    {(byBracket.All?.finalists || []).map((f) => (
                      <Finalist key={f.entryId} f={f} showRank={showRank} />
                    ))}
                  </div>
                ) : (
                  <div className="fx-grid-wrap">
                    <div className="fx-grid">
                      {COLUMNS.map((k) => (
                        <span key={k} className="fx-col-head">
                          {bracketLabel(k)}
                          <span className="fx-col-n">{byBracket[k]?.finalistCount || 0}</span>
                        </span>
                      ))}
                      {Array.from({ length: rows }).map((_, r) =>
                        COLUMNS.map((k) => {
                          const f = byBracket[k]?.finalists[r]
                          return (
                            <div key={`${k}-${r}`} className="fx-cell">
                              {f ? <Finalist f={f} showRank={showRank} /> : <span className="fx-blank" />}
                            </div>
                          )
                        }),
                      )}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}

      <style>{`
        .fx-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; justify-content: space-between; padding: 14px 18px; margin-bottom: 16px; }
        .fx-counts { display: flex; align-items: baseline; gap: 9px; }
        .fx-total { font-family: var(--font-heading); font-size: 1.7rem; font-weight: 800; color: var(--gold-dark); line-height: 1; }
        .fx-total-label { font-size: 0.84rem; color: var(--gray-600); }
        .fx-tools { display: flex; align-items: center; gap: 14px; }
        .fx-search { min-width: 240px; }
        .fx-toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 0.82rem; color: var(--gray-600); white-space: nowrap; cursor: pointer; }
        .fx-filtered { font-size: 0.85rem; color: var(--gray-600); margin: 0 0 14px 2px; }

        .fx-cat { padding: 0; margin-bottom: 16px; overflow: hidden; }
        .fx-cat-head { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--gray-200); background: var(--gray-50, #fafafa); }
        .fx-cat-num { font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--white); background: var(--navy); border-radius: 5px; padding: 3px 8px; }
        .fx-cat-name { font-family: var(--font-heading); font-size: 1rem; font-weight: 700; color: var(--navy); margin: 0; flex: 1 1 auto; }
        .fx-cat-count { font-size: 0.8rem; color: var(--gray-600); white-space: nowrap; }
        .fx-empty { padding: 16px 18px; margin: 0; font-size: 0.86rem; color: var(--gray-600); }

        /* Wide content scrolls inside its own container — the page itself never scrolls sideways. */
        .fx-grid-wrap { overflow-x: auto; }
        .fx-grid { display: grid; grid-template-columns: repeat(4, minmax(190px, 1fr)); min-width: 780px; }
        .fx-col-head { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); background: var(--white); border-bottom: 1px solid var(--gray-200); }
        .fx-col-n { font-size: 0.72rem; color: var(--gray-600); background: var(--gray-100); border-radius: 999px; padding: 1px 7px; letter-spacing: 0; }
        .fx-cell { padding: 8px 12px; border-bottom: 1px solid var(--gray-100); border-right: 1px solid var(--gray-100); min-height: 46px; }
        .fx-grid > .fx-cell:nth-child(4n + 4) { border-right: none; }
        .fx-single { padding: 8px 12px 14px; }
        .fx-single .fx-col-head { border-bottom: none; padding-left: 0; }

        .fx-entry { display: flex; align-items: baseline; gap: 9px; }
        .fx-rank { flex: 0 0 auto; min-width: 17px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); font-variant-numeric: tabular-nums; }
        .fx-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .fx-title { font-size: 0.84rem; line-height: 1.35; color: var(--navy); }
        .fx-lgu { font-size: 0.75rem; color: var(--gray-600); }
        .fx-mean { font-variant-numeric: tabular-nums; }
        .fx-blank { display: block; }

        @media print {
          .fx-bar, .fx-filtered { display: none; }
          .fx-cat { break-inside: avoid; box-shadow: none; border: 1px solid #ccc; }
          .fx-grid-wrap { overflow: visible; }
          .fx-grid { min-width: 0; }
        }
      `}</style>
    </>
  )
}

import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { useFavorites } from '../useFavorites'
import { Loading, ErrorState } from '../components/states'
import {
  ENTRANT_TYPE_LABELS,
  NOMINATOR_RULE_LABELS,
  SUBMISSION_KIND_LABELS,
  submissionWindow,
  formatDate,
} from '@/lib/pearlAwards'

export default function AwardCategoryDetailPage() {
  const { number } = useParams()
  const navigate = useNavigate()
  const { loading, error, data, reload } = useAsync(() => api.get('/award-categories/'), [])
  const { favorites, toggle } = useFavorites()

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const catalog = data
  const ordered = [...catalog.categories].sort((a, b) => a.number - b.number)
  const idx = ordered.findIndex((c) => String(c.number) === String(number))
  const category = ordered[idx]

  if (!category) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-compass" aria-hidden="true" /></div>
        <h3>Category not found</h3>
        <p>That award category doesn’t exist in the {catalog.year} catalog. It may have been renumbered.</p>
        <Link className="dash-btn is-primary" to="/dashboard/awards">
          <i className="fas fa-arrow-left" aria-hidden="true" /> Back to all categories
        </Link>
      </div>
    )
  }

  const prev = ordered[idx - 1]
  const next = ordered[idx + 1]
  const isFav = favorites.has(category.number)
  const win = submissionWindow(catalog)
  const criteria = [...category.criteria].sort((a, b) => a.order - b.order)
  const totalPoints = criteria.reduce((s, c) => s + c.points, 0)
  const submissions = [...(category.requiredSubmissions || [])].sort((a, b) => a.order - b.order)
  const recommended = [...(category.recommendedDocuments || [])].sort((a, b) => a.order - b.order)

  return (
    <>
      {/* Toolbar: back on the left, browse prev/next on the right */}
      <div className="awd-toolbar">
        <Link to="/dashboard/awards" className="awd-back">
          <i className="fas fa-arrow-left" aria-hidden="true" /> All categories
        </Link>
        <div className="awd-pager">
          <PagerLink to={prev && `/dashboard/awards/${prev.number}`} dir="prev" label={prev?.name} />
          <span className="awd-pager-pos">{idx + 1} / {ordered.length}</span>
          <PagerLink to={next && `/dashboard/awards/${next.number}`} dir="next" label={next?.name} />
        </div>
      </div>

      <div className="awd-head">
        <div className="awd-head-badges">
          <span className="dash-badge tone-progress">Category #{category.number}</span>
          <span className="dash-badge tone-neutral">{ENTRANT_TYPE_LABELS[category.entrantType] || category.entrantType}</span>
        </div>
        <h1 className="awd-title">{category.name}</h1>
      </div>

      <div className="awd-grid">
        {/* Main content */}
        <div className="awd-main">
          <p className="awd-def">{category.definition}</p>

          {category.whatAssessorsLookFor && (
            <div className="awd-callout">
              <div className="awd-callout-title">
                <i className="fas fa-magnifying-glass" aria-hidden="true" /> What assessors look for
              </div>
              <p>{category.whatAssessorsLookFor}</p>
            </div>
          )}

          {(category.eligibilityText || category.coverageNote) && (
            <div className="awd-notes">
              {category.eligibilityText && (
                <p><strong>Eligibility.</strong> {category.eligibilityText}</p>
              )}
              {category.coverageNote && (
                <p><strong>Coverage.</strong> {category.coverageNote}</p>
              )}
            </div>
          )}

          <section className="awd-section">
            <h2 className="awd-section-title">
              <i className="fas fa-list-check" aria-hidden="true" /> Scoring criteria
              <span className="awd-points">{totalPoints} points</span>
            </h2>
            <div className="awd-crits">
              {criteria.map((c) => (
                <div key={c.id} className="awd-crit">
                  <div className="awd-crit-head">
                    <span className="awd-crit-name">{c.name}</span>
                    <span className="awd-crit-pts">{c.points}<small>pts</small></span>
                  </div>
                  <div className="awd-crit-track" aria-hidden="true">
                    <div className="awd-crit-fill" style={{ width: `${Math.round((c.points / Math.max(totalPoints, 1)) * 100)}%` }} />
                  </div>
                  {c.indicators && <p className="awd-crit-ind">{c.indicators}</p>}
                </div>
              ))}
            </div>
          </section>

          {submissions.length > 0 && (
            <section className="awd-section">
              <h2 className="awd-section-title">
                <i className="fas fa-paperclip" aria-hidden="true" /> Required submissions
              </h2>
              <ul className="awd-docs">
                {submissions.map((s) => (
                  <li key={s.label}>
                    <span className={`dash-badge ${s.mandatory ? 'tone-warn' : 'tone-neutral'}`}>
                      {s.mandatory ? 'Required' : 'Optional'}
                    </span>
                    <span className="awd-doc-text">
                      <strong>{s.label}</strong>
                      <span className="awd-doc-kind">
                        {SUBMISSION_KIND_LABELS[s.kind] || s.kind}{s.specs ? ` · ${s.specs}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recommended.length > 0 && (
            <section className="awd-section">
              <h2 className="awd-section-title">
                <i className="fas fa-folder-plus" aria-hidden="true" /> Recommended documents
              </h2>
              <ul className="awd-recommend">
                {recommended.map((d) => (
                  <li key={d.label}><i className="fas fa-check" aria-hidden="true" /> {d.label}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Contextual summary + action rail (not navigation) */}
        <aside className="awd-rail">
          <div className="dash-card dash-card-pad awd-rail-card">
            <div className="awd-rail-head">
              <h2 className="awd-rail-title">At a glance</h2>
              <button
                type="button"
                className={`awd-fav${isFav ? ' is-on' : ''}`}
                onClick={() => toggle(category.number)}
                aria-pressed={isFav}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <i className={isFav ? 'fas fa-star' : 'far fa-star'} aria-hidden="true" /> {isFav ? 'Saved' : 'Save'}
              </button>
            </div>
            <dl className="awd-facts">
              <div>
                <dt>Entrant</dt>
                <dd>{ENTRANT_TYPE_LABELS[category.entrantType] || category.entrantType}</dd>
              </div>
              <div>
                <dt>Nomination</dt>
                <dd>{NOMINATOR_RULE_LABELS[category.nominatorRule] || category.nominatorRule}</dd>
              </div>
              {category.eligibleLguLevels?.length > 0 && (
                <div>
                  <dt>Eligible levels</dt>
                  <dd>{category.eligibleLguLevels.join(', ')}</dd>
                </div>
              )}
              <div>
                <dt>Total points</dt>
                <dd>{totalPoints} across {criteria.length} criteria</dd>
              </div>
              <div>
                <dt>Submissions</dt>
                <dd>
                  <span className={`dash-badge ${win?.state === 'open' ? 'tone-success' : win?.state === 'upcoming' ? 'tone-info' : 'tone-neutral'}`}>
                    {win?.state === 'open' ? 'Open' : win?.state === 'upcoming' ? 'Upcoming' : 'Closed'}
                  </span>
                  <span className="awd-window">
                    {win?.state === 'open'
                      ? `Closes ${formatDate(win.closes)}`
                      : win?.state === 'upcoming'
                      ? `Opens ${formatDate(win.opens)}`
                      : `Closed ${formatDate(win?.closes)}`}
                  </span>
                </dd>
              </div>
            </dl>
            <button className="dash-btn is-primary awd-cta" onClick={() => navigate('/dashboard/entries/new')}>
              Start an entry <i className="fas fa-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </aside>
      </div>

      <style>{`
        .awd-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .awd-back {
          display: inline-flex; align-items: center; gap: 8px; text-decoration: none;
          font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--gray-600); transition: var(--transition-fast);
        }
        .awd-back:hover { color: var(--navy); gap: 11px; }

        .awd-pager { display: flex; align-items: center; gap: 6px; }
        .awd-pager-pos { font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gray-400); padding: 0 4px; }
        .awd-pager-btn {
          display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius-sm);
          border: 1px solid var(--gray-200); background: var(--white); color: var(--navy);
          text-decoration: none; transition: var(--transition-fast);
        }
        .awd-pager-btn:hover { border-color: var(--gold); color: var(--gold-dark); }
        .awd-pager-btn.is-disabled { opacity: 0.4; pointer-events: none; }

        .awd-head { margin-bottom: 24px; }
        .awd-head-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .awd-title { font-family: var(--font-heading); font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 800; color: var(--navy); line-height: 1.18; }

        .awd-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 28px; align-items: start; }

        .awd-def { font-size: 1.02rem; color: var(--text-body); line-height: 1.75; }

        .awd-callout { margin-top: 20px; padding: 16px 18px; border-radius: var(--radius-sm); background: rgba(200,168,75,0.08); border: 1px solid rgba(200,168,75,0.25); }
        .awd-callout-title { font-family: var(--font-heading); font-weight: 800; font-size: 0.74rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gold-dark); display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .awd-callout p { color: var(--text-body); font-size: 0.92rem; line-height: 1.65; }

        .awd-notes { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
        .awd-notes p { font-size: 0.88rem; color: var(--gray-600); line-height: 1.6; }
        .awd-notes strong { color: var(--navy); }

        .awd-section { margin-top: 30px; padding-top: 24px; border-top: 1px solid var(--gray-100); }
        .awd-section-title { font-family: var(--font-heading); font-size: 1rem; font-weight: 800; color: var(--navy); display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
        .awd-section-title i { color: var(--gold-dark); }
        .awd-points { margin-left: auto; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gold-dark); background: rgba(200,168,75,0.12); padding: 4px 11px; border-radius: 999px; }

        .awd-crits { display: flex; flex-direction: column; gap: 18px; }
        .awd-crit-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 7px; }
        .awd-crit-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.96rem; }
        .awd-crit-pts { font-family: var(--font-heading); font-weight: 800; color: var(--gold-dark); font-size: 1.05rem; }
        .awd-crit-pts small { font-size: 0.66rem; font-weight: 700; color: var(--gray-400); margin-left: 3px; }
        .awd-crit-track { height: 8px; border-radius: 999px; background: var(--gray-100); overflow: hidden; }
        .awd-crit-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold-light), var(--gold)); }
        .awd-crit-ind { color: var(--gray-600); font-size: 0.85rem; line-height: 1.6; margin-top: 8px; }

        .awd-docs { display: flex; flex-direction: column; gap: 14px; }
        .awd-docs li { display: flex; gap: 12px; align-items: flex-start; }
        .awd-doc-text { display: flex; flex-direction: column; gap: 2px; }
        .awd-doc-text strong { color: var(--navy); font-family: var(--font-heading); font-size: 0.92rem; }
        .awd-doc-kind { color: var(--gray-400); font-size: 0.8rem; }

        .awd-recommend { display: flex; flex-direction: column; gap: 9px; }
        .awd-recommend li { display: flex; gap: 10px; align-items: center; color: var(--text-body); font-size: 0.9rem; }
        .awd-recommend i { color: #16A34A; font-size: 0.78rem; }

        .awd-rail { position: sticky; top: 84px; }
        .awd-rail-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
        .awd-rail-title { font-family: var(--font-heading); font-size: 0.74rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); }
        .awd-fav {
          display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
          background: none; border: 1px solid var(--gray-200); border-radius: 999px; padding: 5px 11px;
          font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; color: var(--gray-600);
          transition: var(--transition-fast); flex-shrink: 0;
        }
        .awd-fav:hover { border-color: var(--gold); color: var(--gold-dark); }
        .awd-fav.is-on { color: var(--gold-dark); border-color: var(--gold); background: rgba(200,168,75,0.1); }
        .awd-fav i { font-size: 0.8rem; }
        .awd-fav:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
        .awd-facts { display: flex; flex-direction: column; gap: 0; }
        .awd-facts > div { padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
        .awd-facts > div:first-of-type { padding-top: 0; }
        .awd-facts dt { font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gray-400); margin-bottom: 4px; }
        .awd-facts dd { font-size: 0.9rem; color: var(--navy); font-weight: 600; line-height: 1.45; }
        .awd-window { display: block; margin-top: 6px; font-size: 0.8rem; font-weight: 600; color: var(--gray-600); }
        .awd-cta { width: 100%; margin-top: 20px; }

        @media (max-width: 880px) {
          .awd-grid { grid-template-columns: 1fr; gap: 24px; }
          .awd-rail { position: static; order: -1; }
          .awd-rail-card { background: var(--off-white); }
        }
        @media (prefers-reduced-motion: reduce) {
          .awd-back:hover, .awd-pager-btn { transition: none; }
        }
      `}</style>
    </>
  )
}

function PagerLink({ to, dir, label }) {
  const icon = dir === 'prev' ? 'fa-chevron-left' : 'fa-chevron-right'
  const title = label ? `${dir === 'prev' ? 'Previous' : 'Next'}: ${label}` : undefined
  if (!to) {
    return (
      <span className="awd-pager-btn is-disabled" aria-hidden="true">
        <i className={`fas ${icon}`} />
      </span>
    )
  }
  return (
    <Link to={to} className="awd-pager-btn" title={title} aria-label={title}>
      <i className={`fas ${icon}`} aria-hidden="true" />
    </Link>
  )
}

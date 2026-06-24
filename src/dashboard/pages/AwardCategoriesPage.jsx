import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import {
  ENTRANT_TYPE_LABELS,
  NOMINATOR_RULE_LABELS,
  SUBMISSION_KIND_LABELS,
  submissionWindow,
  formatDate,
} from '@/lib/pearlAwards'

export default function AwardCategoriesPage() {
  const navigate = useNavigate()
  const { loading, error, data, reload } = useAsync(() => api.get('/award-categories/'), [])
  const [selected, setSelected] = useState(0)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const catalog = data
  const category = catalog.categories[selected] || catalog.categories[0]
  const win = submissionWindow(catalog)
  const totalPoints = category ? category.criteria.reduce((s, c) => s + c.points, 0) : 0

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
              : `Submissions closed ${formatDate(win?.closes)}.`}
          </p>
        </div>
        <button className="dash-btn is-primary" onClick={() => navigate('/dashboard/entries/new')}>
          <i className="fas fa-plus" aria-hidden="true" /> New entry
        </button>
      </div>

      <div className="aw-grid">
        <nav className="aw-list" aria-label="Categories">
          {catalog.categories.map((c, i) => (
            <button key={c.number} type="button" className={`aw-item${i === selected ? ' active' : ''}`} onClick={() => setSelected(i)}>
              <span className="aw-item-num">#{c.number}</span>
              <span className="aw-item-name">{c.name}</span>
            </button>
          ))}
        </nav>

        {category && (
          <article className="dash-card dash-card-pad aw-detail">
            <div className="aw-detail-head">
              <span className="dash-badge tone-progress">Category #{category.number}</span>
              <span className="dash-badge tone-neutral">{ENTRANT_TYPE_LABELS[category.entrantType] || category.entrantType}</span>
            </div>
            <h2 className="aw-name">{category.name}</h2>
            <p className="aw-def">{category.definition}</p>

            {category.whatAssessorsLookFor && (
              <div className="aw-callout">
                <div className="aw-callout-title"><i className="fas fa-magnifying-glass" aria-hidden="true" /> What assessors look for</div>
                <p>{category.whatAssessorsLookFor}</p>
              </div>
            )}

            <div className="aw-meta-grid">
              <div><span className="aw-meta-label">Nomination</span><span className="aw-meta-value">{NOMINATOR_RULE_LABELS[category.nominatorRule] || category.nominatorRule}</span></div>
              {category.eligibleLguLevels?.length > 0 && (
                <div><span className="aw-meta-label">Eligible levels</span><span className="aw-meta-value">{category.eligibleLguLevels.join(', ')}</span></div>
              )}
            </div>

            {category.eligibilityText && (
              <p className="aw-elig"><strong>Eligibility.</strong> {category.eligibilityText}</p>
            )}
            {category.coverageNote && (
              <p className="aw-elig"><strong>Coverage.</strong> {category.coverageNote}</p>
            )}

            {/* Criteria rubric */}
            <h3 className="aw-section-title"><i className="fas fa-list-check" aria-hidden="true" /> Scoring criteria <span className="aw-points-total">{totalPoints} points</span></h3>
            <div className="aw-criteria">
              {[...category.criteria].sort((a, b) => a.order - b.order).map((c) => (
                <div key={c.id} className="aw-criterion">
                  <div className="aw-criterion-bar">
                    <div className="aw-criterion-fill" style={{ width: `${Math.min(100, (c.points / Math.max(totalPoints, 1)) * 100)}%` }} />
                  </div>
                  <div className="aw-criterion-body">
                    <div className="aw-criterion-head">
                      <span className="aw-criterion-name">{c.name}</span>
                      <span className="aw-criterion-pts">{c.points}</span>
                    </div>
                    {c.indicators && <p className="aw-criterion-ind">{c.indicators}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Required submissions */}
            {category.requiredSubmissions?.length > 0 && (
              <>
                <h3 className="aw-section-title"><i className="fas fa-paperclip" aria-hidden="true" /> Required submissions</h3>
                <ul className="aw-docs">
                  {[...category.requiredSubmissions].sort((a, b) => a.order - b.order).map((s) => (
                    <li key={s.label}>
                      <span className={`dash-badge ${s.mandatory ? 'tone-warn' : 'tone-neutral'}`}>{s.mandatory ? 'Required' : 'Optional'}</span>
                      <span className="aw-doc-text">
                        <strong>{s.label}</strong>
                        <span className="aw-doc-kind">{SUBMISSION_KIND_LABELS[s.kind] || s.kind}{s.specs ? ` · ${s.specs}` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Recommended documents */}
            {category.recommendedDocuments?.length > 0 && (
              <>
                <h3 className="aw-section-title"><i className="fas fa-folder-plus" aria-hidden="true" /> Recommended documents</h3>
                <ul className="aw-recommend">
                  {[...category.recommendedDocuments].sort((a, b) => a.order - b.order).map((d) => (
                    <li key={d.label}><i className="fas fa-check" aria-hidden="true" /> {d.label}</li>
                  ))}
                </ul>
              </>
            )}

            <button className="dash-btn is-primary aw-start" onClick={() => navigate('/dashboard/entries/new')}>
              Start an entry in this category <i className="fas fa-arrow-right" aria-hidden="true" />
            </button>
          </article>
        )}
      </div>

      <style>{`
        .aw-grid { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
        .aw-list { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 84px; max-height: calc(100vh - 110px); overflow-y: auto; padding-right: 4px; }
        .aw-item { display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid transparent; background: transparent; cursor: pointer; transition: var(--transition-fast); }
        .aw-item:hover { background: var(--white); border-color: var(--gray-200); }
        .aw-item.active { background: var(--white); border-color: var(--gold); box-shadow: var(--shadow-sm); }
        .aw-item-num { font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); flex-shrink: 0; }
        .aw-item-name { font-family: var(--font-heading); font-weight: 600; font-size: 0.86rem; color: var(--navy); line-height: 1.3; }
        .aw-detail-head { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .aw-name { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800; color: var(--navy); line-height: 1.2; }
        .aw-def { color: var(--gray-600); line-height: 1.7; margin-top: 12px; }
        .aw-callout { margin-top: 18px; padding: 16px; border-radius: var(--radius-sm); background: rgba(200,168,75,0.08); border: 1px solid rgba(200,168,75,0.25); }
        .aw-callout-title { font-family: var(--font-heading); font-weight: 800; font-size: 0.78rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gold-dark); display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .aw-callout p { color: var(--text-body); font-size: 0.9rem; line-height: 1.6; }
        .aw-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
        .aw-meta-label { display: block; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gray-600); margin-bottom: 3px; }
        .aw-meta-value { font-size: 0.88rem; color: var(--navy); font-weight: 600; }
        .aw-elig { font-size: 0.86rem; color: var(--gray-600); line-height: 1.6; margin-top: 14px; }
        .aw-elig strong { color: var(--navy); }
        .aw-section-title { font-family: var(--font-heading); font-size: 0.95rem; font-weight: 800; color: var(--navy); margin: 26px 0 14px; display: flex; align-items: center; gap: 9px; padding-top: 20px; border-top: 1px solid var(--gray-100); }
        .aw-section-title i { color: var(--gold-dark); }
        .aw-points-total { margin-left: auto; font-size: 0.74rem; font-weight: 700; color: var(--gold-dark); background: rgba(200,168,75,0.12); padding: 3px 10px; border-radius: 999px; }
        .aw-criteria { display: flex; flex-direction: column; gap: 14px; }
        .aw-criterion { display: flex; gap: 14px; }
        .aw-criterion-bar { width: 5px; flex-shrink: 0; border-radius: 999px; background: var(--gray-100); position: relative; }
        .aw-criterion-fill { position: absolute; bottom: 0; left: 0; width: 100%; border-radius: 999px; background: linear-gradient(180deg, var(--gold-light), var(--gold)); height: 100%; }
        .aw-criterion-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
        .aw-criterion-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; }
        .aw-criterion-pts { font-family: var(--font-heading); font-weight: 800; color: var(--gold-dark); font-size: 1rem; }
        .aw-criterion-ind { color: var(--gray-600); font-size: 0.82rem; line-height: 1.55; margin-top: 4px; }
        .aw-docs { display: flex; flex-direction: column; gap: 12px; }
        .aw-docs li { display: flex; gap: 12px; align-items: flex-start; }
        .aw-doc-text { display: flex; flex-direction: column; gap: 2px; }
        .aw-doc-text strong { color: var(--navy); font-family: var(--font-heading); font-size: 0.9rem; }
        .aw-doc-kind { color: var(--gray-400); font-size: 0.78rem; }
        .aw-recommend { display: flex; flex-direction: column; gap: 8px; }
        .aw-recommend li { display: flex; gap: 10px; align-items: center; color: var(--text-body); font-size: 0.88rem; }
        .aw-recommend i { color: #16A34A; font-size: 0.78rem; }
        .aw-start { margin-top: 26px; }
        @media (max-width: 860px) {
          .aw-grid { grid-template-columns: 1fr; }
          .aw-list { position: static; flex-direction: row; overflow-x: auto; max-height: none; padding-bottom: 6px; }
          .aw-item { flex-shrink: 0; }
          .aw-meta-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  )
}

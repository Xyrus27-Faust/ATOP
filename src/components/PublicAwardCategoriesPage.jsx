import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/auth/AuthContext';
import { useFavorites } from '@/lib/useFavorites';
import {
  ENTRANT_TYPE_LABELS,
  NOMINATOR_RULE_LABELS,
  SUBMISSION_KIND_LABELS,
  submissionWindow,
  formatDate,
} from '@/lib/pearlAwards';

const ENTRANT_SHORT = { Lgu: 'LGU', OfficersOrganization: 'Officers’ Org', Individual: 'Individual' };
const ENTRANT_ORDER = ['Lgu', 'OfficersOrganization', 'Individual'];

// Public, marketing-framed award catalog. Anyone can browse the categories and
// their criteria; favourites and "Start an entry" light up only when signed in.
export default function PublicAwardCategoriesPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const isLoggedIn = status === 'authenticated';
  const { favorites, toggle } = useFavorites(isLoggedIn);

  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [entrant, setEntrant] = useState('all');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState(null); // category number, or null for the grid

  useEffect(() => {
    let active = true;
    api.get('/award-categories/').then(
      (data) => { if (active) setState({ loading: false, error: null, data }); },
      (error) => { if (active) setState({ loading: false, error, data: null }); },
    );
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => state.data?.categories ?? [], [state.data]);
  const present = useMemo(
    () => ENTRANT_ORDER.filter((t) => categories.some((c) => c.entrantType === t)),
    [categories],
  );

  // Carry the chosen category into the new-entry flow so it starts pre-selected.
  const startEntry = (categoryNumber) =>
    navigate(isLoggedIn
      ? `/entries/new${categoryNumber != null ? `?category=${categoryNumber}` : ''}`
      : '/login');

  if (state.loading) {
    return (
      <section className="apc-page">
        <div className="container apc-status"><i className="fas fa-spinner fa-spin" aria-hidden="true" /></div>
        <style>{APC_CSS}</style>
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="apc-page">
        <div className="container apc-status apc-status-error">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          <p>We couldn’t load the award categories. Please try again shortly.</p>
        </div>
        <style>{APC_CSS}</style>
      </section>
    );
  }

  const catalog = state.data;
  const win = submissionWindow(catalog);
  const selectedCategory = selected != null ? categories.find((c) => c.number === selected) : null;

  const q = query.trim().toLowerCase();
  const shown = categories.filter((c) => {
    if (favoritesOnly && !favorites.has(c.number)) return false;
    if (entrant !== 'all' && c.entrantType !== entrant) return false;
    if (q && !`#${c.number} ${c.name} ${c.definition}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <section className="apc-page">
      <div className="container">
        <header className="apc-head">
          <span className="apc-eyebrow">ATOP Pearl Awards {catalog.year}</span>
          <h1 className="apc-title">Award Categories</h1>
          <p className="apc-sub">
            {catalog.categories.length} categories recognising the best in Philippine local tourism.
            Coverage year {catalog.coverageYear}.{' '}
            {win?.state === 'open'
              ? `Submissions are open — they close ${formatDate(win.closes)}.`
              : win?.state === 'upcoming'
              ? `Submissions open ${formatDate(win.opens)}.`
              : `Submissions closed ${formatDate(win?.closes)}.`}
          </p>
        </header>

        {selectedCategory ? (
          <CategoryDetail
            category={selectedCategory}
            win={win}
            isLoggedIn={isLoggedIn}
            isFav={favorites.has(selectedCategory.number)}
            onToggleFav={() => toggle(selectedCategory.number)}
            onBack={() => setSelected(null)}
            onStart={startEntry}
          />
        ) : (
          <>
            <div className="apc-toolbar">
              <div className="apc-search">
                <i className="fas fa-search" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search categories…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search award categories"
                />
              </div>
              <div className="apc-filters" role="group" aria-label="Filter categories">
                {isLoggedIn && (
                  <>
                    <button
                      type="button"
                      className={`apc-chip apc-chip-fav${favoritesOnly ? ' active' : ''}`}
                      onClick={() => setFavoritesOnly((v) => !v)}
                      aria-pressed={favoritesOnly}
                    >
                      <i className={favoritesOnly ? 'fas fa-star' : 'far fa-star'} aria-hidden="true" /> Favorites
                      <span className="apc-chip-count">{favorites.size}</span>
                    </button>
                    {present.length > 1 && <span className="apc-sep" aria-hidden="true" />}
                  </>
                )}
                {present.length > 1 && (
                  <>
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

            <div className="apc-grid">
              {shown.map((c) => {
                const totalPoints = c.criteria.reduce((s, k) => s + k.points, 0);
                const required = (c.requiredSubmissions || []).filter((s) => s.mandatory).length;
                const isFav = favorites.has(c.number);
                return (
                  <div key={c.number} className="apc-cell">
                    <article className="apc-card">
                      <div className="apc-banner">
                        <span className="apc-banner-brand">Pearl Awards {catalog.year}</span>
                        <img src="/Untitled.png" alt="ATOP" className="apc-banner-logo" />
                        <h3 className="apc-banner-name">
                          <button type="button" className="apc-card-btn" onClick={() => { setSelected(c.number); window.scrollTo(0, 0); }}>
                            {c.name}
                          </button>
                        </h3>
                      </div>
                      <div className="apc-card-body">
                        <span className="apc-type">{ENTRANT_SHORT[c.entrantType] || c.entrantType}</span>
                        <p className="apc-def">{c.definition}</p>
                        <div className="apc-stats">
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
                        <span className="apc-go" aria-hidden="true">View criteria <i className="fas fa-arrow-right" /></span>
                      </div>
                    </article>
                    {isLoggedIn && (
                      <button
                        type="button"
                        className={`apc-fav${isFav ? ' is-on' : ''}`}
                        onClick={() => toggle(c.number)}
                        aria-pressed={isFav}
                        aria-label={isFav ? `Remove ${c.name} from favorites` : `Add ${c.name} to favorites`}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <i className={isFav ? 'fas fa-star' : 'far fa-star'} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
              {shown.length === 0 && (
                <div className="apc-none">
                  {favoritesOnly && favorites.size === 0 ? (
                    <>Nothing saved yet. Tap the <i className="far fa-star" aria-hidden="true" /> on any category to keep it here.</>
                  ) : (
                    <>
                      No categories match{q ? ` “${query.trim()}”` : ' these filters'}.{' '}
                      <button type="button" className="apc-clear" onClick={() => { setQuery(''); setEntrant('all'); setFavoritesOnly(false); }}>
                        Clear filters
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{APC_CSS}</style>
    </section>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button type="button" className={`apc-chip${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
      {label} <span className="apc-chip-count">{count}</span>
    </button>
  );
}

function CategoryDetail({ category, win, isLoggedIn, isFav, onToggleFav, onBack, onStart }) {
  const criteria = [...category.criteria].sort((a, b) => a.order - b.order);
  const totalPoints = criteria.reduce((s, c) => s + c.points, 0);
  const submissions = [...(category.requiredSubmissions || [])].sort((a, b) => a.order - b.order);
  const recommended = [...(category.recommendedDocuments || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="apc-detail">
      <button type="button" className="apc-back" onClick={onBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" /> All categories
      </button>

      <div className="apc-detail-grid">
        <div className="apc-detail-main">
          <div className="apc-detail-badges">
            <span className="apc-badge gold">Category #{category.number}</span>
            <span className="apc-badge">{ENTRANT_TYPE_LABELS[category.entrantType] || category.entrantType}</span>
          </div>
          <h2 className="apc-detail-name">{category.name}</h2>
          <p className="apc-detail-def">{category.definition}</p>

          {category.whatAssessorsLookFor && (
            <div className="apc-callout">
              <div className="apc-callout-title"><i className="fas fa-magnifying-glass" aria-hidden="true" /> What assessors look for</div>
              <p>{category.whatAssessorsLookFor}</p>
            </div>
          )}

          {(category.eligibilityText || category.coverageNote) && (
            <div className="apc-notes">
              {category.eligibilityText && <p><strong>Eligibility.</strong> {category.eligibilityText}</p>}
              {category.coverageNote && <p><strong>Coverage.</strong> {category.coverageNote}</p>}
            </div>
          )}

          <section className="apc-section">
            <h3 className="apc-section-title">
              <i className="fas fa-list-check" aria-hidden="true" /> Scoring criteria
              <span className="apc-points">{totalPoints} points</span>
            </h3>
            <div className="apc-crits">
              {criteria.map((c) => (
                <div key={c.id} className="apc-crit">
                  <div className="apc-crit-head">
                    <span className="apc-crit-name">{c.name}</span>
                    <span className="apc-crit-pts">{c.points}<small>pts</small></span>
                  </div>
                  <div className="apc-crit-track" aria-hidden="true">
                    <div className="apc-crit-fill" style={{ width: `${Math.round((c.points / Math.max(totalPoints, 1)) * 100)}%` }} />
                  </div>
                  {c.indicators && <p className="apc-crit-ind">{c.indicators}</p>}
                </div>
              ))}
            </div>
          </section>

          {submissions.length > 0 && (
            <section className="apc-section">
              <h3 className="apc-section-title"><i className="fas fa-paperclip" aria-hidden="true" /> Required submissions</h3>
              <ul className="apc-docs">
                {submissions.map((s) => (
                  <li key={s.label}>
                    <span className={`apc-badge ${s.mandatory ? 'warn' : ''}`}>{s.mandatory ? 'Required' : 'Optional'}</span>
                    <span className="apc-doc-text">
                      <strong>{s.label}</strong>
                      <span className="apc-doc-kind">{SUBMISSION_KIND_LABELS[s.kind] || s.kind}{s.specs ? ` · ${s.specs}` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recommended.length > 0 && (
            <section className="apc-section">
              <h3 className="apc-section-title"><i className="fas fa-folder-plus" aria-hidden="true" /> Recommended documents</h3>
              <ul className="apc-recommend">
                {recommended.map((d) => (
                  <li key={d.label}><i className="fas fa-check" aria-hidden="true" /> {d.label}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="apc-aside">
          <div className="apc-aside-card">
            <div className="apc-aside-head">
              <h3 className="apc-aside-title">At a glance</h3>
              {isLoggedIn && (
                <button type="button" className={`apc-save${isFav ? ' is-on' : ''}`} onClick={onToggleFav} aria-pressed={isFav} title={isFav ? 'Remove from favorites' : 'Add to favorites'}>
                  <i className={isFav ? 'fas fa-star' : 'far fa-star'} aria-hidden="true" /> {isFav ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
            <dl className="apc-facts">
              <div><dt>Entrant</dt><dd>{ENTRANT_TYPE_LABELS[category.entrantType] || category.entrantType}</dd></div>
              <div><dt>Nomination</dt><dd>{NOMINATOR_RULE_LABELS[category.nominatorRule] || category.nominatorRule}</dd></div>
              {category.eligibleLguLevels?.length > 0 && (
                <div><dt>Eligible levels</dt><dd>{category.eligibleLguLevels.join(', ')}</dd></div>
              )}
              <div><dt>Total points</dt><dd>{totalPoints} across {criteria.length} criteria</dd></div>
              <div>
                <dt>Submissions</dt>
                <dd>
                  <span className={`apc-badge ${win?.state === 'open' ? 'ok' : win?.state === 'upcoming' ? 'info' : ''}`}>
                    {win?.state === 'open' ? 'Open' : win?.state === 'upcoming' ? 'Upcoming' : 'Closed'}
                  </span>
                  <span className="apc-window">
                    {win?.state === 'open' ? `Closes ${formatDate(win.closes)}` : win?.state === 'upcoming' ? `Opens ${formatDate(win.opens)}` : `Closed ${formatDate(win?.closes)}`}
                  </span>
                </dd>
              </div>
            </dl>
            <button type="button" className="btn-gold apc-cta" onClick={() => onStart(category.number)}>
              {isLoggedIn ? <>Start an entry <i className="fas fa-arrow-right" aria-hidden="true" /></> : <>Sign in to enter <i className="fas fa-arrow-right" aria-hidden="true" /></>}
            </button>
            {!isLoggedIn && <p className="apc-cta-note">You’ll need an ATOP member account to submit an entry.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

const APC_CSS = `
  .apc-page { padding: 56px 0 96px; background: var(--off-white); min-height: 70vh; }
  .apc-status { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 40vh; color: var(--gold-dark); font-size: 1.8rem; }
  .apc-status-error { color: var(--gray-600); font-size: 1rem; }
  .apc-status-error i { font-size: 2rem; color: #B91C1C; }

  .apc-head { margin-bottom: 28px; }
  .apc-eyebrow { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-dark); }
  .apc-title { font-family: var(--font-heading); font-size: clamp(1.8rem, 3.4vw, 2.6rem); font-weight: 800; color: var(--navy); line-height: 1.12; margin-top: 8px; }
  .apc-sub { color: var(--gray-600); margin-top: 12px; max-width: 70ch; line-height: 1.7; font-size: 0.98rem; }

  /* Toolbar */
  .apc-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 24px; }
  .apc-search { position: relative; flex: 1 1 260px; max-width: 400px; }
  .apc-search i { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.9rem; pointer-events: none; }
  .apc-search input {
    width: 100%; font-family: var(--font-body); font-size: 0.95rem; color: var(--text-body);
    padding: 12px 16px 12px 42px; background: var(--white); border: 1px solid var(--gray-200);
    border-radius: var(--radius-sm); outline: none; transition: var(--transition-fast);
  }
  .apc-search input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,168,75,0.15); }

  .apc-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .apc-chip {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
    font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700;
    padding: 9px 15px; border-radius: 999px; border: 1px solid var(--gray-200);
    background: var(--white); color: var(--gray-600); transition: var(--transition-fast);
  }
  .apc-chip:hover { border-color: var(--gold); color: var(--navy); }
  .apc-chip.active { background: var(--navy); color: var(--white); border-color: var(--navy); }
  .apc-chip-count { font-size: 0.7rem; opacity: 0.7; }
  .apc-chip-fav i { color: var(--gold-dark); font-size: 0.8rem; }
  .apc-chip-fav.active { background: var(--gold); border-color: var(--gold); color: var(--white); }
  .apc-chip-fav.active i { color: var(--white); }
  .apc-sep { width: 1px; align-self: stretch; background: var(--gray-200); margin: 2px 4px; }

  /* Grid — 3 across, collapsing to 2 then 1 */
  .apc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .apc-cell { position: relative; height: 100%; }
  .apc-card {
    position: relative; display: flex; flex-direction: column; height: 100%; cursor: pointer; overflow: hidden;
    background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm); transition: var(--transition-fast);
  }
  .apc-card:hover { border-color: var(--gold); box-shadow: var(--shadow-md); transform: translateY(-3px); }
  .apc-card:focus-within { outline: 2px solid var(--gold); outline-offset: 2px; }
  /* The name is the real control; its hit area is stretched over the whole card. */
  .apc-card-btn {
    background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; cursor: pointer; text-align: center;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .apc-card-btn::after { content: ''; position: absolute; inset: 0; z-index: 1; }
  .apc-card-btn:focus-visible { outline: none; }

  /* Branded plate header — wordmark + ATOP emblem + category name */
  .apc-banner {
    position: relative; min-height: 168px; padding: 18px 18px 20px; display: flex; flex-direction: column;
    align-items: center; justify-content: space-between; gap: 10px; text-align: center; overflow: hidden;
    background:
      radial-gradient(circle at 28% 16%, var(--navy-light) 0%, transparent 56%),
      linear-gradient(150deg, var(--navy) 0%, var(--navy-mid) 100%);
    border-bottom: 3px solid var(--gold);
  }
  .apc-banner-brand {
    font-family: var(--font-heading); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold-light);
  }
  .apc-banner-logo { width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 5px 14px rgba(0,0,0,0.45)); }
  .apc-card:hover .apc-banner-logo { transform: scale(1.06); transition: var(--transition-fast); }
  .apc-banner-name { font-family: var(--font-heading); font-size: 1.02rem; font-weight: 800; line-height: 1.3; color: var(--white); margin-top: 2px; }

  .apc-card-body { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px 20px; flex: 1; }
  .apc-type {
    align-self: flex-start;
    font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--gray-600); background: var(--gray-100); border: 1px solid var(--gray-200);
    padding: 4px 10px; border-radius: 999px;
  }
  .apc-def { color: var(--gray-600); font-size: 0.88rem; line-height: 1.6; flex: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .apc-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--navy); padding-top: 13px; border-top: 1px solid var(--gray-100); }
  .apc-stats i { color: var(--gold-dark); margin-right: 4px; font-size: 0.74rem; }
  .apc-stats span[aria-hidden] { color: var(--gray-300, #cbd5e1); font-weight: 400; }
  .apc-go { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gold-dark); }
  .apc-card:hover .apc-go { gap: 11px; }
  .apc-go i { transition: var(--transition-fast); }

  .apc-fav {
    position: absolute; top: 12px; right: 12px; z-index: 2; width: 34px; height: 34px;
    display: grid; place-items: center; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);
    background: rgba(15,25,46,0.38); color: rgba(255,255,255,0.85); cursor: pointer; font-size: 0.92rem;
    transition: var(--transition-fast); backdrop-filter: blur(2px);
  }
  .apc-fav:hover { background: rgba(200,168,75,0.92); color: var(--navy); border-color: var(--gold); }
  .apc-fav.is-on { background: var(--gold); color: var(--navy); border-color: var(--gold); }
  .apc-fav:focus-visible { outline: 2px solid var(--gold-light); outline-offset: 2px; }

  .apc-none { grid-column: 1 / -1; text-align: center; color: var(--gray-600); background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 40px 24px; }
  .apc-clear { background: none; border: none; cursor: pointer; color: var(--gold-dark); font-family: var(--font-heading); font-weight: 700; font-size: inherit; text-decoration: underline; padding: 0; }
  .apc-clear:hover { color: var(--navy); }

  /* Detail */
  .apc-back { display: inline-flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; margin-bottom: 22px; font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gray-600); transition: var(--transition-fast); padding: 0; }
  .apc-back:hover { color: var(--navy); gap: 11px; }
  .apc-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 32px; align-items: start; }
  .apc-detail-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
  .apc-badge { display: inline-flex; align-items: center; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--gray-200); background: var(--gray-100); color: var(--gray-600); }
  .apc-badge.gold { color: var(--gold-dark); background: rgba(200,168,75,0.12); border-color: rgba(200,168,75,0.35); }
  .apc-badge.warn { color: #C2410C; background: #FFF7ED; border-color: #FED7AA; }
  .apc-badge.ok { color: #15803D; background: #F0FDF4; border-color: #BBF7D0; }
  .apc-badge.info { color: #1D4ED8; background: #EFF6FF; border-color: #BFDBFE; }
  .apc-detail-name { font-family: var(--font-heading); font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 800; color: var(--navy); line-height: 1.18; }
  .apc-detail-def { font-size: 1.02rem; color: var(--text-body); line-height: 1.75; margin-top: 14px; }

  .apc-callout { margin-top: 22px; padding: 18px 20px; border-radius: var(--radius-sm); background: rgba(200,168,75,0.08); border: 1px solid rgba(200,168,75,0.25); }
  .apc-callout-title { font-family: var(--font-heading); font-weight: 800; font-size: 0.74rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gold-dark); display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .apc-callout p { color: var(--text-body); font-size: 0.92rem; line-height: 1.65; }
  .apc-notes { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
  .apc-notes p { font-size: 0.9rem; color: var(--gray-600); line-height: 1.65; }
  .apc-notes strong { color: var(--navy); }

  .apc-section { margin-top: 32px; padding-top: 26px; border-top: 1px solid var(--gray-200); }
  .apc-section-title { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .apc-section-title i { color: var(--gold-dark); }
  .apc-points { margin-left: auto; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gold-dark); background: rgba(200,168,75,0.12); padding: 4px 12px; border-radius: 999px; }

  .apc-crits { display: flex; flex-direction: column; gap: 18px; }
  .apc-crit-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 7px; }
  .apc-crit-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.98rem; }
  .apc-crit-pts { font-family: var(--font-heading); font-weight: 800; color: var(--gold-dark); font-size: 1.05rem; }
  .apc-crit-pts small { font-size: 0.66rem; font-weight: 700; color: var(--gray-400); margin-left: 3px; }
  .apc-crit-track { height: 8px; border-radius: 999px; background: var(--gray-200); overflow: hidden; }
  .apc-crit-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold-light), var(--gold)); }
  .apc-crit-ind { color: var(--gray-600); font-size: 0.86rem; line-height: 1.6; margin-top: 8px; }

  .apc-docs { display: flex; flex-direction: column; gap: 14px; list-style: none; padding: 0; }
  .apc-docs li { display: flex; gap: 12px; align-items: flex-start; }
  .apc-doc-text { display: flex; flex-direction: column; gap: 2px; }
  .apc-doc-text strong { color: var(--navy); font-family: var(--font-heading); font-size: 0.92rem; }
  .apc-doc-kind { color: var(--gray-400); font-size: 0.8rem; }
  .apc-recommend { display: flex; flex-direction: column; gap: 9px; list-style: none; padding: 0; }
  .apc-recommend li { display: flex; gap: 10px; align-items: center; color: var(--text-body); font-size: 0.9rem; }
  .apc-recommend i { color: #16A34A; font-size: 0.78rem; }

  /* Detail aside */
  .apc-aside { position: sticky; top: 96px; }
  .apc-aside-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); padding: 22px; }
  .apc-aside-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
  .apc-aside-title { font-family: var(--font-heading); font-size: 0.74rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); }
  .apc-save { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; background: none; border: 1px solid var(--gray-200); border-radius: 999px; padding: 5px 11px; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; color: var(--gray-600); transition: var(--transition-fast); }
  .apc-save:hover { border-color: var(--gold); color: var(--gold-dark); }
  .apc-save.is-on { color: var(--gold-dark); border-color: var(--gold); background: rgba(200,168,75,0.1); }
  .apc-save i { font-size: 0.8rem; }
  .apc-facts { display: flex; flex-direction: column; }
  .apc-facts > div { padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
  .apc-facts > div:first-child { padding-top: 0; }
  .apc-facts dt { font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gray-400); margin-bottom: 4px; }
  .apc-facts dd { font-size: 0.9rem; color: var(--navy); font-weight: 600; line-height: 1.45; }
  .apc-window { display: block; margin-top: 6px; font-size: 0.8rem; font-weight: 600; color: var(--gray-600); }
  .apc-cta { width: 100%; margin-top: 20px; justify-content: center; }
  .apc-cta-note { font-size: 0.78rem; color: var(--gray-500, var(--gray-400)); margin-top: 10px; text-align: center; line-height: 1.5; }

  @media (max-width: 1024px) { .apc-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .apc-grid { grid-template-columns: 1fr; } }
  @media (max-width: 880px) {
    .apc-detail-grid { grid-template-columns: 1fr; gap: 26px; }
    .apc-aside { position: static; order: -1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .apc-card:hover { transform: none; }
  }
`;

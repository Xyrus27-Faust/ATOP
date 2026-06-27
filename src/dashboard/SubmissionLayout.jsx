import { Outlet, useNavigate } from 'react-router-dom'
import { DASH_CSS } from './DashboardLayout'

/**
 * Focused, non-dashboard shell for the Pearl Awards submission flow (the create
 * wizard + the bidbook editor). A slim top bar replaces the dashboard sidebar so
 * composing an entry reads like filling out an application — not a page buried in
 * the member dashboard. The form controls within reuse the dash-* design system.
 */
export default function SubmissionLayout() {
  const navigate = useNavigate()

  return (
    <div className="sub-shell">
      <header className="sub-bar">
        <button type="button" className="sub-brand" onClick={() => navigate('/dashboard')} aria-label="ATOP member home">
          <img src="/Untitled.png" alt="ATOP" />
        </button>
        <span className="sub-bar-label">Pearl Awards — Entry</span>
        <div className="sub-bar-spacer" />
        <button type="button" className="sub-exit" onClick={() => navigate('/dashboard/entries')}>
          <i className="fas fa-arrow-left" aria-hidden="true" /> Exit to My Entries
        </button>
      </header>

      <main className="sub-content">
        <Outlet />
      </main>

      <style>{DASH_CSS}</style>
      <style>{SUB_CSS}</style>
    </div>
  )
}

const SUB_CSS = `
  .sub-shell { min-height: 100vh; background: var(--off-white); display: flex; flex-direction: column; }
  .sub-shell * { box-sizing: border-box; }

  .sub-bar {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; gap: 16px; height: 60px;
    padding: 0 clamp(18px, 3vw, 36px);
    background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--gray-200);
  }
  .sub-brand { display: inline-flex; align-items: center; background: none; border: none; cursor: pointer; padding: 0; }
  .sub-brand img { width: 40px; height: 40px; object-fit: contain; transition: var(--transition-fast); }
  .sub-brand:hover img { transform: scale(1.05); }
  .sub-bar-label {
    font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--gray-600);
    border-left: 1px solid var(--gray-200); padding-left: 16px;
  }
  .sub-bar-spacer { flex: 1; }
  .sub-exit {
    display: inline-flex; align-items: center; gap: 8px;
    background: none; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
    color: var(--gray-600); font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700;
    padding: 9px 14px; cursor: pointer; transition: var(--transition-fast);
  }
  .sub-exit:hover { border-color: var(--navy); color: var(--navy); background: var(--white); }

  .sub-content { padding: clamp(22px, 3.4vw, 40px); max-width: 1180px; width: 100%; margin: 0 auto; }
  @keyframes sub-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .sub-content > * { animation: sub-fade 0.4s ease-out both; }

  @media (max-width: 560px) {
    .sub-bar-label { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sub-content > * { animation: none; }
  }
`

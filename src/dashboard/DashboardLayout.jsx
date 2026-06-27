import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { navForRoles, primaryRole, roleLabel } from './dashboardNav'
import NotificationBell from './components/NotificationBell'

// The brand's topographic contour, carried over from the auth pages as a quiet
// watermark in the sidebar — ties the workspace to the marketing identity.
const CONTOUR =
  'M0,-150 C82,-150 150,-82 150,8 C150,92 92,150 -12,150 C-104,150 -160,78 -150,-22 C-143,-92 -82,-150 0,-150 Z'

function initialsOf(user) {
  const a = user?.firstName?.[0]
  const b = user?.lastName?.[0]
  if (a || b) return `${a || ''}${b || ''}`.toUpperCase()
  const name = user?.fullName || user?.email || '?'
  return name.trim().slice(0, 2).toUpperCase()
}

/**
 * The dashboard app shell: a persistent navy sidebar + top bar wrapping the
 * routed page (<Outlet/>). Sidebar nav is role-driven via navForRoles().
 */
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const role = primaryRole(user?.roles)
  const nav = navForRoles(user?.roles)

  // Close the mobile drawer whenever the route changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDrawerOpen(false), [location.pathname])

  return (
    <div className="dash">
      {/* Sidebar */}
      <aside className={`dash-sidebar ${drawerOpen ? 'is-open' : ''}`}>
        <div className="dash-sidebar-top">
          <NavLink to="/dashboard" end className="dash-brand" aria-label="ATOP dashboard home">
            <img src="/Untitled.png" alt="" className="dash-emblem" />
            <span className="dash-wordmark">atop</span>
          </NavLink>
          <span className="dash-portal-label">Member Portal</span>
          <span className="dash-role-chip">
            <i className="fas fa-shield-halved" aria-hidden="true" /> {roleLabel(role)}
          </span>
        </div>

        <nav className="dash-nav" aria-label="Dashboard">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="dash-nav-link">
              <i className={`fas ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dash-sidebar-foot">
          <button type="button" className="dash-back-site" onClick={() => navigate('/')}>
            <i className="fas fa-arrow-left" aria-hidden="true" /> Back to main site
          </button>
          <svg className="dash-topo" viewBox="-200 -200 400 400" aria-hidden="true" focusable="false">
            {[0.4, 0.62, 0.84, 1.06, 1.28].map((s, i) => (
              <path key={s} d={CONTOUR} transform={`scale(${s})`} style={{ opacity: 0.05 + i * 0.03 }} />
            ))}
          </svg>
        </div>
      </aside>

      {/* Drawer backdrop (mobile) */}
      {drawerOpen && <div className="dash-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      {/* Main column */}
      <div className="dash-main">
        <header className="dash-topbar">
          <button
            type="button"
            className="dash-menu-btn"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={drawerOpen}
          >
            <i className="fas fa-bars" aria-hidden="true" />
          </button>

          <div className="dash-topbar-spacer" />

          <NotificationBell />

          <div className="dash-user">
            <span className="dash-avatar" aria-hidden="true">{initialsOf(user)}</span>
            <span className="dash-user-meta">
              <span className="dash-user-name">{user?.fullName || user?.firstName || user?.email}</span>
              <span className="dash-user-role">{roleLabel(role)}</span>
            </span>
          </div>
          <button type="button" className="dash-logout" onClick={logout}>
            <i className="fas fa-arrow-right-from-bracket" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>

      <style>{DASH_CSS}</style>
    </div>
  )
}

// Shared dashboard design system. Scoped via the `dash-` prefix so it never
// collides with the marketing site (.section/.cta) or the auth pages (.auth-*).
// Exported so the focused SubmissionLayout can reuse the same dash-* form controls.
export const DASH_CSS = `
  .dash {
    --rail: 264px;
    min-height: 100vh;
    display: grid;
    grid-template-columns: var(--rail) 1fr;
    background: var(--off-white);
  }
  .dash * { box-sizing: border-box; }

  /* ---------- Sidebar ---------- */
  .dash-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at 30% 8%, var(--navy-light) 0%, transparent 42%),
      linear-gradient(180deg, var(--navy) 0%, var(--navy-mid) 100%);
    border-right: 4px solid var(--gold);
    overflow: hidden;
  }
  .dash-sidebar-top { padding: 28px 24px 18px; display: flex; flex-direction: column; gap: 14px; }
  .dash-brand { display: inline-flex; align-items: center; gap: 12px; width: fit-content; }
  .dash-emblem { width: 42px; height: 42px; object-fit: contain; filter: drop-shadow(0 6px 16px rgba(0,0,0,0.4)); }
  .dash-wordmark {
    font-family: var(--font-heading); font-size: 1.6rem; font-weight: 900; letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--white) 20%, var(--gold-light) 100%);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }
  .dash-portal-label {
    font-family: var(--font-heading); font-size: 0.64rem; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.42);
  }
  .dash-role-chip {
    display: inline-flex; align-items: center; gap: 7px; width: fit-content;
    font-family: var(--font-heading); font-size: 0.66rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-light);
    background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.3);
    padding: 5px 11px; border-radius: 999px;
  }
  .dash-role-chip i { font-size: 0.7rem; }

  .dash-nav { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; flex: 1; }
  .dash-nav-link {
    display: flex; align-items: center; gap: 13px;
    padding: 11px 14px; border-radius: var(--radius-sm);
    font-family: var(--font-heading); font-size: 0.86rem; font-weight: 600;
    color: rgba(255,255,255,0.66); position: relative;
    transition: var(--transition-fast);
  }
  .dash-nav-link i { width: 20px; text-align: center; font-size: 0.95rem; color: rgba(255,255,255,0.5); transition: var(--transition-fast); }
  .dash-nav-link:hover { background: rgba(255,255,255,0.06); color: var(--white); }
  .dash-nav-link:hover i { color: var(--gold-light); }
  .dash-nav-link.active {
    background: rgba(200,168,75,0.18); color: var(--white);
  }
  .dash-nav-link.active i { color: var(--gold); }

  .dash-sidebar-foot { position: relative; padding: 18px 20px 24px; }
  .dash-back-site {
    position: relative; z-index: 1;
    display: inline-flex; align-items: center; gap: 8px; background: none; border: none;
    color: rgba(255,255,255,0.55); font-family: var(--font-heading);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer; transition: var(--transition-fast); padding: 0;
  }
  .dash-back-site:hover { color: var(--gold-light); gap: 11px; }
  .dash-topo {
    position: absolute; right: -30%; bottom: -36%; width: 90%; height: auto;
    fill: none; stroke: var(--gold-light); stroke-width: 1.1; pointer-events: none;
  }

  /* ---------- Main column ---------- */
  .dash-main { min-width: 0; display: flex; flex-direction: column; }
  .dash-topbar {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; gap: 14px;
    height: 64px; padding: 0 clamp(18px, 3vw, 36px);
    background: rgba(255,255,255,0.86); backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--gray-200);
  }
  .dash-topbar-spacer { flex: 1; }
  .dash-menu-btn {
    display: none; background: none; border: none; color: var(--navy);
    font-size: 1.2rem; padding: 6px 8px; cursor: pointer;
  }
  .dash-user { display: flex; align-items: center; gap: 11px; }
  .dash-avatar {
    width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
    font-family: var(--font-heading); font-size: 0.8rem; font-weight: 800; color: var(--navy);
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
    box-shadow: 0 3px 10px rgba(200,168,75,0.35); flex-shrink: 0;
  }
  .dash-user-meta { display: flex; flex-direction: column; line-height: 1.25; }
  .dash-user-name { font-family: var(--font-heading); font-size: 0.86rem; font-weight: 700; color: var(--navy); }
  .dash-user-role { font-size: 0.72rem; color: var(--gray-600); }
  .dash-logout {
    display: inline-flex; align-items: center; gap: 8px; background: none;
    border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
    color: var(--gray-600); font-family: var(--font-heading); font-size: 0.76rem; font-weight: 700;
    padding: 9px 14px; cursor: pointer; transition: var(--transition-fast);
  }
  .dash-logout:hover { border-color: var(--navy); color: var(--navy); background: var(--white); }

  .dash-content { padding: clamp(22px, 3.4vw, 40px); max-width: 1180px; width: 100%; margin: 0 auto; }

  .dash-backdrop { display: none; }

  /* ---------- Page header ---------- */
  .dash-page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 26px; }
  .dash-eyebrow {
    font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-dark);
  }
  .dash-h1 { font-family: var(--font-heading); font-size: clamp(1.5rem, 2.6vw, 2rem); font-weight: 800; color: var(--navy); line-height: 1.15; margin-top: 6px; }
  .dash-sub { font-family: var(--font-body); color: var(--gray-600); margin-top: 7px; max-width: 60ch; line-height: 1.6; }

  /* ---------- Cards & grid ---------- */
  .dash-card { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
  .dash-card-pad { padding: clamp(18px, 2.4vw, 26px); }
  .dash-grid { display: grid; gap: 18px; }
  .dash-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
  .dash-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .dash-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
  .dash-card-title {
    font-family: var(--font-heading); font-size: 0.78rem; font-weight: 800;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--navy);
    display: flex; align-items: center; gap: 9px;
  }
  .dash-card-title i { color: var(--gold-dark); }

  /* ---------- Buttons ---------- */
  .dash-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 9px;
    font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700;
    letter-spacing: 0.05em; padding: 11px 20px; border-radius: var(--radius-sm);
    border: 1px solid var(--gray-200); background: var(--white); color: var(--navy);
    cursor: pointer; transition: var(--transition-fast); text-transform: uppercase;
  }
  .dash-btn:hover { border-color: var(--navy); transform: translateY(-1px); }
  .dash-btn.is-primary {
    background: linear-gradient(135deg, var(--gold) 0%, var(--gold-dark) 100%);
    color: var(--white); border-color: var(--gold);
    box-shadow: 0 4px 15px rgba(200,168,75,0.28);
  }
  .dash-btn.is-primary:hover { background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 100%); box-shadow: 0 8px 22px rgba(200,168,75,0.4); }
  .dash-btn.is-ghost { background: transparent; border-color: transparent; color: var(--gray-600); }
  .dash-btn.is-ghost:hover { color: var(--navy); background: var(--gray-100); transform: none; }
  .dash-btn.is-danger { color: #B91C1C; border-color: #FECACA; background: #FEF2F2; }
  .dash-btn.is-danger:hover { border-color: #DC2626; }
  .dash-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
  .dash-btn.is-sm { padding: 8px 14px; font-size: 0.72rem; }

  /* ---------- Form controls ---------- */
  .dash-field { display: flex; flex-direction: column; gap: 7px; }
  .dash-label { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--navy); }
  .dash-label .req { color: var(--gold-dark); margin-left: 2px; }
  .dash-input, .dash-textarea, .dash-select {
    width: 100%; font-family: var(--font-body); font-size: 0.92rem; color: var(--text-body);
    padding: 11px 14px; background: var(--off-white); border: 1px solid var(--gray-200);
    border-radius: var(--radius-sm); outline: none; transition: var(--transition-fast);
  }
  .dash-textarea { resize: vertical; min-height: 110px; line-height: 1.6; }
  .dash-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239CA3AF' d='M6 8 0 0h12z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 38px; cursor: pointer; }
  .dash-input::placeholder, .dash-textarea::placeholder { color: var(--gray-400); }
  .dash-input:focus, .dash-textarea:focus, .dash-select:focus {
    border-color: var(--gold); background-color: var(--white); box-shadow: 0 0 0 3px rgba(200,168,75,0.15);
  }
  .dash-input.has-error, .dash-textarea.has-error, .dash-select.has-error { border-color: #DC2626; background-color: #FEF2F2; }
  .dash-help { font-size: 0.78rem; color: var(--gray-400); font-family: var(--font-body); }
  .dash-error { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #DC2626; font-family: var(--font-body); }
  .dash-counter { font-size: 0.74rem; color: var(--gray-400); font-family: var(--font-heading); font-weight: 600; }
  .dash-counter.is-over { color: #DC2626; }
  .dash-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .dash-check { display: flex; align-items: flex-start; gap: 11px; cursor: pointer; font-family: var(--font-body); font-size: 0.9rem; color: var(--text-body); line-height: 1.5; }
  .dash-check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--gold); cursor: pointer; flex-shrink: 0; }

  /* ---------- Status badge ---------- */
  .dash-badge {
    display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
    font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.05em; padding: 5px 11px; border-radius: 999px; border: 1px solid;
  }
  .dash-badge i { font-size: 0.72rem; }
  .dash-badge.tone-neutral { color: var(--gray-600); background: var(--gray-100); border-color: var(--gray-200); }
  .dash-badge.tone-info { color: #1D4ED8; background: #EFF6FF; border-color: #BFDBFE; }
  .dash-badge.tone-progress { color: var(--gold-dark); background: rgba(200,168,75,0.12); border-color: rgba(200,168,75,0.35); }
  .dash-badge.tone-warn { color: #C2410C; background: #FFF7ED; border-color: #FED7AA; }
  .dash-badge.tone-success { color: #15803D; background: #F0FDF4; border-color: #BBF7D0; }
  .dash-badge.tone-danger { color: #B91C1C; background: #FEF2F2; border-color: #FECACA; }

  /* ---------- Stat cards ---------- */
  .dash-stat { padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; position: relative; overflow: hidden; }
  .dash-stat-value { font-family: var(--font-heading); font-size: 2rem; font-weight: 800; color: var(--navy); line-height: 1; }
  .dash-stat-label { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
  .dash-stat-icon { position: absolute; right: -8px; top: -8px; font-size: 3.4rem; color: var(--gray-100); }

  /* ---------- Readiness (signature element) ---------- */
  .dash-meter { height: 8px; border-radius: 999px; background: var(--gray-200); overflow: hidden; }
  .dash-meter-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold), var(--gold-light)); transition: width 0.5s cubic-bezier(0.16,1,0.3,1); }
  .dash-meter-fill.is-complete { background: linear-gradient(90deg, #16A34A, #4ADE80); }
  .dash-reqs { display: flex; flex-direction: column; gap: 2px; }
  .dash-req { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--gray-100); }
  .dash-req:last-child { border-bottom: none; }
  .dash-req-tick {
    width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0;
    font-size: 0.7rem; border: 1.5px solid var(--gray-200); color: var(--gray-400); background: var(--white);
  }
  .dash-req.is-done .dash-req-tick { background: #16A34A; border-color: #16A34A; color: var(--white); }
  .dash-req-label { font-family: var(--font-body); font-size: 0.9rem; color: var(--navy); flex: 1; }
  .dash-req.is-done .dash-req-label { color: var(--gray-600); }
  .dash-req-detail { font-family: var(--font-heading); font-size: 0.74rem; font-weight: 600; color: var(--gray-400); }

  /* ---------- Status stepper ---------- */
  .dash-steps { display: flex; align-items: center; gap: 0; flex-wrap: nowrap; overflow-x: auto; }
  .dash-step { display: flex; align-items: center; gap: 9px; flex-shrink: 0; white-space: nowrap; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gray-400); }
  .dash-step-dot { width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-size: 0.66rem; background: var(--gray-100); color: var(--gray-400); border: 1.5px solid var(--gray-200); }
  .dash-step.is-active .dash-step-dot { background: var(--gold); color: var(--white); border-color: var(--gold); box-shadow: 0 0 0 4px rgba(200,168,75,0.18); }
  .dash-step.is-done .dash-step-dot { background: var(--navy); color: var(--gold-light); border-color: var(--navy); }
  .dash-step.is-active, .dash-step.is-done { color: var(--navy); }
  .dash-step-line { width: 34px; height: 2px; flex-shrink: 0; background: var(--gray-200); margin: 0 6px; }
  .dash-step-line.is-done { background: var(--navy); }

  /* ---------- Tabs ---------- */
  .dash-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--gray-200); overflow-x: auto; }
  .dash-tab {
    display: inline-flex; align-items: center; gap: 9px; white-space: nowrap;
    background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
    font-family: var(--font-heading); font-size: 0.82rem; font-weight: 700; color: var(--gray-600);
    padding: 13px 16px; transition: var(--transition-fast); margin-bottom: -1px;
  }
  .dash-tab:hover { color: var(--navy); }
  .dash-tab.active { color: var(--gold-dark); border-bottom-color: var(--gold); }
  .dash-tab .pip { width: 8px; height: 8px; border-radius: 50%; background: var(--gray-300, #cbd5e1); }
  .dash-tab .pip.is-done { background: #16A34A; }

  /* ---------- Empty state ---------- */
  .dash-empty { text-align: center; padding: clamp(36px, 6vw, 64px) 24px; }
  .dash-empty-icon { width: 78px; height: 78px; margin: 0 auto 20px; border-radius: 50%; display: grid; place-items: center; font-size: 2rem; color: var(--gold-dark); background: rgba(200,168,75,0.1); border: 1px solid rgba(200,168,75,0.25); }
  .dash-empty h3 { font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800; color: var(--navy); margin-bottom: 10px; }
  .dash-empty p { color: var(--gray-600); max-width: 44ch; margin: 0 auto 22px; line-height: 1.65; }

  /* ---------- Banners ---------- */
  .dash-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 0.9rem; line-height: 1.55; }
  .dash-banner i { margin-top: 2px; }
  .dash-banner.tone-info { background: rgba(200,168,75,0.08); border: 1px solid rgba(200,168,75,0.32); color: var(--gold-dark); }
  .dash-banner.tone-success { background: #F0FDF4; border: 1px solid #BBF7D0; color: #15803D; }
  .dash-banner.tone-warn { background: #FFF7ED; border: 1px solid #FED7AA; color: #C2410C; }
  .dash-banner.tone-error { background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; }

  /* ---------- Loading ---------- */
  .dash-loading { display: grid; place-items: center; min-height: 50vh; color: var(--gold-dark); font-size: 1.6rem; }

  /* ---------- Animations ---------- */
  @keyframes dash-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .dash-content > * { animation: dash-fade 0.4s ease-out both; }

  /* ---------- Responsive ---------- */
  @media (max-width: 920px) {
    .dash { grid-template-columns: 1fr; }
    .dash-sidebar {
      position: fixed; top: 0; left: 0; z-index: 60; width: 280px;
      transform: translateX(-100%); transition: transform 0.32s cubic-bezier(0.16,1,0.3,1);
    }
    .dash-sidebar.is-open { transform: translateX(0); box-shadow: 0 30px 70px rgba(15,25,46,0.4); }
    .dash-backdrop { display: block; position: fixed; inset: 0; z-index: 50; background: rgba(15,25,46,0.5); backdrop-filter: blur(2px); }
    .dash-menu-btn { display: inline-flex; }
  }
  @media (max-width: 560px) {
    .dash-grid.cols-2, .dash-grid.cols-3, .dash-grid.cols-4 { grid-template-columns: 1fr; }
    .dash-form-row { grid-template-columns: 1fr; }
    .dash-user-meta { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .dash-content > *, .dash-meter-fill, .dash-sidebar { animation: none; transition: none; }
  }
`

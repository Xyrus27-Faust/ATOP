import { Link } from 'react-router-dom'

// One organic closed contour, rendered at several scales to read as a
// topographic map — a quiet nod to the Philippine destinations ATOP exists to
// build. This is the page's signature element; everything else stays quiet.
const CONTOUR =
  'M0,-150 C82,-150 150,-82 150,8 C150,92 92,150 -12,150 C-104,150 -160,78 -150,-22 C-143,-92 -82,-150 0,-150 Z'
const RINGS = [0.18, 0.32, 0.46, 0.6, 0.74, 0.88, 1.02, 1.16]

function TopographicMark() {
  return (
    <svg
      className="auth-topo"
      viewBox="-200 -200 400 400"
      aria-hidden="true"
      focusable="false"
    >
      {RINGS.map((s, i) => (
        <path
          key={s}
          d={CONTOUR}
          transform={`scale(${s})`}
          style={{ opacity: 0.06 + i * 0.025 }}
        />
      ))}
    </svg>
  )
}

/**
 * Shared shell for the auth pages: a navy brand panel beside a form card.
 *
 * Props:
 *   eyebrow, brandTitle, brandText — brand panel copy (per page)
 *   title, subtitle               — form heading
 *   children                      — the form
 *   footer                        — switch link(s) under the form
 */
export default function AuthLayout({
  eyebrow = 'Member Portal',
  brandTitle = 'The national network of tourism officers.',
  brandText = 'Sign in to your ATOP member portal — resources, capacity-building, and the people building better Philippine destinations.',
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="auth-shell">
      {/* Brand panel */}
      <aside className="auth-brand">
        <TopographicMark />
        <div className="auth-brand-inner">
          <Link to="/" className="auth-brand-logo" aria-label="ATOP home">
            <img src="/Untitled.png" alt="" className="auth-emblem" />
            <span className="auth-wordmark">atop</span>
          </Link>

          <div className="auth-brand-copy">
            <span className="auth-eyebrow">{eyebrow}</span>
            <h1 className="auth-brand-title">{brandTitle}</h1>
            <p className="auth-brand-text">{brandText}</p>
          </div>

          <p className="auth-tagline">
            Uniting Tourism Leaders <span aria-hidden="true">·</span> Building Better Destinations
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="auth-panel">
        <div className="auth-card">
          <Link to="/" className="auth-back">
            <i className="fas fa-arrow-left" aria-hidden="true" /> Back to home
          </Link>

          <header className="auth-head">
            <h2 className="auth-title">{title}</h2>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </header>

          {children}

          {footer && <div className="auth-foot">{footer}</div>}
        </div>
      </main>

      <style>{`
        .auth-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          background: var(--off-white);
          overflow-x: hidden;
        }
        /* Let grid/flex children shrink below their intrinsic content width so
           inputs and buttons never overflow the viewport on small screens. */
        .auth-brand, .auth-panel { min-width: 0; }
        .auth-form, .auth-field, .auth-input-wrap, .auth-row > * { min-width: 0; }

        /* ---------- Brand panel ---------- */
        .auth-brand {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 78% 18%, var(--navy-light) 0%, transparent 55%),
            linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 70%, var(--navy) 100%);
          border-right: 4px solid var(--gold);
          display: flex;
        }
        .auth-topo {
          position: absolute;
          right: -8%;
          bottom: -14%;
          width: 78%;
          height: auto;
          fill: none;
          stroke: var(--gold-light);
          stroke-width: 1.1;
          pointer-events: none;
        }
        .auth-brand-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 48px;
          padding: 64px clamp(40px, 5vw, 80px);
          width: 100%;
        }
        .auth-brand-logo {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          width: fit-content;
        }
        .auth-emblem {
          width: 58px;
          height: 58px;
          object-fit: contain;
          animation: floatUp 5s ease-in-out infinite;
          filter: drop-shadow(0 10px 24px rgba(0,0,0,0.45));
        }
        .auth-wordmark {
          font-family: var(--font-heading);
          font-size: 2rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, var(--white) 20%, var(--gold-light) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .auth-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-heading);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--gold-light);
        }
        .auth-eyebrow::before {
          content: '';
          width: 28px;
          height: 2px;
          background: var(--gold);
          border-radius: 1px;
        }
        .auth-brand-title {
          font-family: var(--font-heading);
          font-size: clamp(1.9rem, 3vw, 2.7rem);
          font-weight: 800;
          line-height: 1.12;
          color: var(--white);
          margin: 20px 0 18px;
          max-width: 13ch;
          text-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .auth-brand-text {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.8;
          color: rgba(255,255,255,0.74);
          max-width: 42ch;
        }
        .auth-tagline {
          font-family: var(--font-heading);
          font-size: 0.74rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.12);
        }
        .auth-tagline span { color: var(--gold); padding: 0 6px; }

        /* ---------- Form panel ---------- */
        .auth-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px clamp(24px, 4vw, 64px);
        }
        .auth-card {
          width: 100%;
          max-width: 440px;
        }
        .auth-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-heading);
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--gray-600);
          margin-bottom: 36px;
          transition: var(--transition-fast);
        }
        .auth-back:hover { color: var(--gold-dark); gap: 12px; }
        .auth-head { margin-bottom: 28px; }
        .auth-title {
          font-family: var(--font-heading);
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--navy);
          letter-spacing: -0.01em;
          line-height: 1.15;
        }
        .auth-subtitle {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--gray-600);
          margin-top: 8px;
          line-height: 1.6;
        }
        .auth-foot {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid var(--gray-200);
          text-align: center;
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--gray-600);
        }
        .auth-foot a {
          font-family: var(--font-heading);
          font-weight: 700;
          color: var(--gold-dark);
          letter-spacing: 0.02em;
        }
        .auth-foot a:hover { color: var(--gold); }

        /* ---------- Shared form controls (used by the auth pages) ---------- */
        .auth-form { display: flex; flex-direction: column; gap: 18px; }
        .auth-row { display: flex; gap: 16px; }
        .auth-row > * { flex: 1; }
        .auth-field { display: flex; flex-direction: column; gap: 8px; }
        .auth-label {
          font-family: var(--font-heading);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--navy);
        }
        .auth-input-wrap { position: relative; display: flex; align-items: center; }
        .auth-input-wrap > .auth-lead {
          position: absolute;
          left: 14px;
          color: var(--gray-400);
          font-size: 0.9rem;
          pointer-events: none;
          transition: var(--transition-fast);
        }
        .auth-input {
          width: 100%;
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--text-body);
          padding: 13px 16px 13px 42px;
          background: var(--off-white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-sm);
          outline: none;
          transition: var(--transition-fast);
        }
        .auth-input::placeholder { color: var(--gray-400); }
        .auth-input:focus {
          border-color: var(--gold);
          background: var(--white);
          box-shadow: 0 0 0 3px rgba(200,168,75,0.15);
        }
        .auth-input-wrap:focus-within > .auth-lead { color: var(--gold-dark); }
        .auth-input.has-error { border-color: #DC2626; background: #FEF2F2; }
        .auth-input.has-error:focus { box-shadow: 0 0 0 3px rgba(220,38,38,0.12); }
        .auth-toggle {
          position: absolute;
          right: 6px;
          background: none;
          border: none;
          padding: 8px 10px;
          color: var(--gray-400);
          cursor: pointer;
          font-size: 0.9rem;
          transition: var(--transition-fast);
        }
        .auth-toggle:hover { color: var(--navy); }
        .auth-error {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: #DC2626;
        }
        .auth-hint {
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--gray-400);
        }

        .auth-submit {
          width: 100%;
          justify-content: center;
          margin-top: 6px;
          font-size: 0.84rem;
        }
        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 4px 15px rgba(200,168,75,0.25);
        }

        /* ---------- Banners ---------- */
        .auth-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.88rem;
          line-height: 1.55;
        }
        .auth-banner i { margin-top: 2px; font-size: 0.95rem; }
        .auth-banner--error { background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; }
        .auth-banner--info {
          background: rgba(200,168,75,0.08);
          border: 1px solid rgba(200,168,75,0.35);
          color: var(--gold-dark);
        }
        .auth-banner--success { background: #F0FDF4; border: 1px solid #BBF7D0; color: #15803D; }
        .auth-banner button.auth-link {
          background: none; border: none; padding: 0; cursor: pointer;
          font-family: var(--font-heading); font-weight: 700; color: inherit;
          text-decoration: underline; text-underline-offset: 2px; font-size: 0.86rem;
        }

        /* ---------- Centered status (verify / success states) ---------- */
        .auth-status { text-align: center; padding: 8px 0; }
        .auth-status-icon {
          width: 76px; height: 76px; margin: 0 auto 22px;
          display: grid; place-items: center; border-radius: 50%;
          font-size: 2rem;
        }
        .auth-status-icon--success { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
        .auth-status-icon--error { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
        .auth-status-icon--info { background: rgba(200,168,75,0.1); color: var(--gold-dark); border: 1px solid rgba(200,168,75,0.3); }
        .auth-status h2 {
          font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800;
          color: var(--navy); margin-bottom: 10px;
        }
        .auth-status p {
          font-family: var(--font-body); font-size: 0.95rem; color: var(--gray-600);
          line-height: 1.7; margin: 0 auto 8px; max-width: 38ch;
        }
        .auth-status .auth-submit { margin-top: 22px; }

        @keyframes auth-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-card, .auth-brand-inner { animation: auth-fade-in 0.45s ease-out both; }
        .auth-brand-inner { animation-delay: 0.06s; }

        /* ---------- Responsive ---------- */
        @media (max-width: 880px) {
          .auth-shell { grid-template-columns: 1fr; }
          .auth-brand { border-right: none; border-bottom: 4px solid var(--gold); }
          .auth-brand-inner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 22px clamp(24px, 5vw, 40px);
          }
          .auth-brand-copy, .auth-tagline { display: none; }
          .auth-topo { width: 46%; right: -6%; bottom: -40%; }
          .auth-emblem { width: 44px; height: 44px; animation: none; }
          .auth-wordmark { font-size: 1.6rem; }
          .auth-eyebrow { display: inline-flex; }
          .auth-brand-inner .auth-eyebrow { color: var(--gold-light); }
          .auth-panel { padding: 40px 24px 56px; align-items: flex-start; }
        }
        @media (max-width: 880px) {
          /* show the eyebrow inline on mobile as a compact context label */
          .auth-brand-logo { gap: 12px; }
        }
        @media (max-width: 560px) {
          .auth-row { flex-direction: column; gap: 18px; }
          .auth-title { font-size: 1.6rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-emblem { animation: none; }
          .auth-card, .auth-brand-inner { animation: none; }
        }
      `}</style>
    </div>
  )
}

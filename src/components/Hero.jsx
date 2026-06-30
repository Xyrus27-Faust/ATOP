export default function Hero({ setCurrentPage }) {
  return (
    <section className="hero" id="hero-section">
      {/* Background */}
      <div className="hero-bg" aria-hidden="true"></div>
      <div className="hero-overlay" aria-hidden="true"></div>

      <div className="container">
        <div className="hero-content">
          {/* Text */}
          <div className="hero-text">
            <button
              type="button"
              className="hero-awards-pill"
              onClick={() => document.getElementById('pearl-awards')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <i className="fas fa-trophy" aria-hidden="true"></i>
              ATOP National Pearl Awards 2026 — now accepting entries
            </button>
            <h1>
              Uniting Tourism Leaders.
              <span className="gold-line">Building Better Destinations.</span>
            </h1>
            <p>
              ATOP is the national organization of local government tourism
              officers committed to professional growth, collaboration,
              and sustainable tourism development in the Philippines.
            </p>
            <div className="hero-buttons">
              <button
                className="btn-gold"
                id="hero-awards-btn"
                onClick={() => document.getElementById('pearl-awards')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <i className="fas fa-trophy"></i> Pearl Awards 2026
              </button>
              <button
                className="btn-outline"
                id="hero-about-btn"
                onClick={() => { setCurrentPage('about'); window.scrollTo(0, 0); }}
              >
                About ATOP <i className="fas fa-chevron-right"></i>
              </button>
              <button
                className="btn-outline"
                id="hero-member-btn"
                onClick={() => { setCurrentPage('membership'); window.scrollTo(0, 0); }}
              >
                Become a Member
              </button>
            </div>
          </div>

          <style>{`
            .hero-awards-pill {
              display: inline-flex;
              align-items: center;
              gap: 9px;
              margin-bottom: 20px;
              padding: 8px 16px;
              border-radius: 999px;
              cursor: pointer;
              background: rgba(200, 168, 75, 0.16);
              border: 1px solid rgba(200, 168, 75, 0.5);
              color: var(--gold-light);
              font-family: var(--font-heading);
              font-weight: 700;
              font-size: 0.8rem;
              letter-spacing: 0.02em;
              transition: var(--transition-fast);
            }
            .hero-awards-pill:hover {
              background: rgba(200, 168, 75, 0.26);
              border-color: var(--gold);
            }
          `}</style>

          {/* Logo Emblem */}
          <div className="hero-logo" aria-hidden="true">
            <img
              className="hero-logo-emblem"
              src="/Untitled.png"
              alt="ATOP Logo"
              style={{ objectFit: 'contain' }}
            />
            <p className="hero-logo-text">
              Association of Tourism Officers<br />of the Philippines, Inc.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

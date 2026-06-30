export default function Hero({ setCurrentPage }) {
  return (
    <section className="hero" id="hero-section">
      {/* Background */}
      <div className="hero-bg" aria-hidden="true"></div>
      <div className="hero-overlay" aria-hidden="true"></div>

      {/* Centered announcement pill, floating over the banner (absolute — doesn't shift the content below) */}
      <div className="hero-awards-banner">
        <button
          type="button"
          className="hero-awards-pill"
          onClick={() => document.getElementById('pearl-awards')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <i className="fas fa-trophy" aria-hidden="true"></i>
          ATOP National Pearl Awards 2026 — now accepting entries
        </button>
      </div>

      <div className="container">
        <div className="hero-content">
          {/* Text */}
          <div className="hero-text">
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
            </div>
          </div>

          <style>{`
            .hero-awards-banner {
              position: absolute;
              top: clamp(26px, 4vh, 44px); /* sits in the ~100px clear band the hero reserves above the headline */
              left: 0;
              right: 0;
              z-index: 3;
              display: flex;
              justify-content: center;
              padding: 0 16px;
              pointer-events: none; /* thin top band shouldn't block clicks; pill re-enables below */
            }
            .hero-awards-pill {
              pointer-events: auto;
              display: inline-flex;
              align-items: center;
              gap: 9px;
              max-width: 100%;
              padding: 9px 18px;
              border-radius: 999px;
              cursor: pointer;
              background: rgba(200, 168, 75, 0.18);
              border: 1px solid rgba(200, 168, 75, 0.55);
              color: var(--gold-light);
              font-family: var(--font-heading);
              font-weight: 700;
              font-size: clamp(0.72rem, 2.2vw, 0.85rem);
              letter-spacing: 0.02em;
              text-align: center;
              box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
              backdrop-filter: blur(2px);
              transition: var(--transition-fast);
            }
            .hero-awards-pill:hover {
              background: rgba(200, 168, 75, 0.28);
              border-color: var(--gold);
              transform: translateY(-1px);
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

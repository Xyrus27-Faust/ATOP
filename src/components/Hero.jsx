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

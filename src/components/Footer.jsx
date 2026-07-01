const quickLinks = [
  'Home', 'About Us', 'Membership', 'Programs', 'News & Events', 'Resources', 'Contact Us',
];

const programs = [
  'Capacity Building',
  'Conventions & Meetings',
  'Research & Publications',
  'Advocacy',
  'Partnerships',
];

const pageMap = {
  'Home': 'home',
  'About Us': 'about',
  'Membership': 'membership',
  'Programs': 'programs',
  'News & Events': 'news',
  'Resources': 'resources',
  'Contact Us': 'contact'
};

export default function Footer({ setCurrentPage }) {
  return (
    <footer className="footer" id="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <div className="footer-logo">
              <img src="/Untitled.png" alt="ATOP Logo" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
              <div className="logo-text">
                <span className="atop-acronym">atop</span>
                <span className="atop-full" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Association of Tourism Officers<br />of the Philippines, Inc.
                </span>
              </div>
            </div>
            <p className="footer-tagline">
              Uniting Tourism Leaders.<br />Building Better Destinations.
            </p>
            <div className="footer-socials">
              <a href="#" aria-label="Facebook" id="social-facebook" onClick={(e) => e.preventDefault()}><i className="fab fa-facebook-f"></i></a>
              <a href="#" aria-label="Twitter/X" id="social-twitter" onClick={(e) => e.preventDefault()}><i className="fab fa-x-twitter"></i></a>
              <a href="#" aria-label="Instagram" id="social-instagram" onClick={(e) => e.preventDefault()}><i className="fab fa-instagram"></i></a>
              <a href="#" aria-label="YouTube" id="social-youtube" onClick={(e) => e.preventDefault()}><i className="fab fa-youtube"></i></a>
              <a href="#" aria-label="Email" id="social-email" onClick={(e) => e.preventDefault()}><i className="fas fa-envelope"></i></a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h5>Quick Links</h5>
            <ul>
              {quickLinks.map((link) => (
                <li key={link}>
                  <a 
                    href="#" 
                    id={`footer-link-${link.toLowerCase().replace(/[\s&]/g, '-')}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(pageMap[link]);
                      window.scrollTo(0, 0);
                    }}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Programs */}
          <div className="footer-col">
            <h5>Programs</h5>
            <ul>
              {programs.map((prog) => (
                <li key={prog}>
                  <a 
                    href="#" 
                    id={`footer-prog-${prog.toLowerCase().replace(/[\s&]/g, '-')}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage('programs');
                      window.scrollTo(0, 0);
                    }}
                  >
                    {prog}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-col">
            <h5>Contact Us</h5>
            <ul className="footer-contact-list">
              <li>
                <i className="fas fa-map-marker-alt"></i>
                <span>
                  City Tourism and Cultural Affairs Office, 2nd Floor,
                  City Hall Building, City of Koronadal, 9506
                </span>
              </li>
              <li>
                <i className="fas fa-envelope"></i>
                <span>atoppearlawards2026@gmail.com</span>
              </li>
              <li>
                <i className="fas fa-globe"></i>
                <span>www.atopphilippines.org</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p>© 2025 Association of Tourism Officers of the Philippines, Inc. (ATOP). All Rights Reserved.</p>
          <div className="footer-bottom-links">
            <a href="#" id="footer-privacy-link">Privacy Policy</a>
            <a href="#" id="footer-terms-link">Terms of Use</a>
          </div>
        </div>
      </div>

      {/* Gold accent bar */}
      <div className="footer-bar-gold" aria-hidden="true"></div>
    </footer>
  );
}


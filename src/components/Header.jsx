import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

const navItems = [
  { label: 'Home', id: 'home', active: true },
  {
    label: 'About Us', id: 'about',
    children: ['About ATOP', 'History', 'Vision & Mission', 'Board of Directors', 'Organizational Chart'],
  },
  {
    label: 'Membership', id: 'membership',
    children: ['Join ATOP', 'Member Benefits', 'Member Directory', 'Membership Fees'],
  },
  {
    label: 'Programs', id: 'programs',
    children: ['Capacity Building', 'Conventions & Meetings', 'Research & Publications', 'Advocacy', 'Partnerships'],
  },
  {
    label: 'News & Events', id: 'news',
    children: ['Latest News', 'Upcoming Events', 'Press Releases', 'Gallery'],
  },
  {
    label: 'Resources', id: 'resources',
    children: ['Downloads', 'Tourism Data', 'Publications', 'Links'],
  },
  { label: 'Contact Us', id: 'contact' },
];

export default function Header({ scrolled, currentPage, setCurrentPage, onOpenLogin }) {
  const { user, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="container">
          <a href="#" id="top-bar-search" className="search-icon" onClick={(e) => e.preventDefault()}>
            <i className="fas fa-search"></i>
          </a>
          {user ? (
            <>
              <span className="top-bar-user">
                <i className="fas fa-circle-user"></i>
                {user.firstName || user.fullName || user.email}
              </span>
              <button className="btn-join-topbar" id="top-bar-logout-btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <a href="#" id="top-bar-login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
                <i className="fas fa-user"></i>
                Member Login
              </a>
              <button className="btn-join-topbar" id="top-bar-join-btn" onClick={() => navigate('/register')}>Join ATOP</button>
            </>
          )}
        </div>
      </div>

      {/* Main Header */}
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <nav className="navbar">
            {/* Logo */}
            <a href="#" className="logo" id="nav-logo" onClick={(e) => { e.preventDefault(); setCurrentPage('home'); window.scrollTo(0,0); }}>
              <div className="logo-emblem">
                <img src="/Untitled.png" alt="ATOP Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div className="logo-text">
                <span className="atop-acronym">atop</span>
                <span className="atop-full">
                  Association of Tourism Officers<br />of the Philippines, Inc.
                </span>
              </div>
            </a>

            {/* Desktop Nav */}
            <ul className="nav-links">
              {navItems.map((item) => (
                <li className="nav-item" key={item.id}>
                  <span
                    className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                    id={`nav-${item.id}`}
                    onClick={() => {
                      setCurrentPage(item.id);
                      window.scrollTo(0, 0);
                    }}
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>

            {/* Hamburger */}
            <button
              className="hamburger"
              id="hamburger-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </nav>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="mobile-menu">
            {navItems.map((item) => (
              <a 
                href="#" 
                key={item.id} 
                className={`mobile-menu-link ${currentPage === item.id ? 'active' : ''}`} 
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(item.id);
                  setMobileOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <style>{`
        .top-bar-user {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.85);
          font-family: var(--font-heading);
          font-weight: 600;
        }
        .top-bar-user i { color: var(--gold-light); font-size: 0.95rem; }
        .mobile-menu {
          background: var(--white);
          border-top: 2px solid var(--gold);
          box-shadow: var(--shadow-md);
          padding: 12px 0;
        }
        .mobile-menu-link {
          display: block;
          padding: 12px 24px;
          font-family: var(--font-heading);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--navy);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--gray-200);
          transition: color 0.2s, background 0.2s;
        }
        .mobile-menu-link:last-child { border-bottom: none; }
        .mobile-menu-link:hover, .mobile-menu-link.active { color: var(--gold); background: var(--off-white); }

        /* User profile top bar styling */
        .user-profile-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--white);
        }
        .user-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid var(--gold-light);
          object-fit: cover;
        }
        .user-name {
          font-weight: 600;
          color: var(--gold-light);
          font-family: var(--font-body);
        }
        .btn-signout-topbar {
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.7rem;
          font-family: var(--font-heading);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 2px 8px;
          border-radius: 4px;
          transition: var(--transition-fast);
        }
        .btn-signout-topbar:hover {
          color: var(--white);
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>

    </>
  );
}


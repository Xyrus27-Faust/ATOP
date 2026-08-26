import { useEffect, useRef, useState } from 'react';
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
  { label: 'Pearl Awards', id: 'awards' },
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

export default function Header({ scrolled, currentPage, setCurrentPage }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Dismiss the user menu on an outside click or Escape.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onDocClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

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
              <a href="#" id="top-bar-dashboard" className="top-bar-dash" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>
                <i className="fas fa-gauge-high"></i>
                Dashboard
              </a>
              <div className="top-bar-usermenu" ref={userMenuRef}>
                <button
                  type="button"
                  className="top-bar-user"
                  id="top-bar-user-btn"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <i className="fas fa-circle-user"></i>
                  {user.firstName || user.fullName || user.email}
                  <i className={`fas fa-chevron-down top-bar-caret ${userMenuOpen ? 'is-open' : ''}`} aria-hidden="true"></i>
                </button>

                {userMenuOpen && (
                  <div className="top-bar-menu" role="menu">
                    <button
                      type="button"
                      className="top-bar-menu-item"
                      role="menuitem"
                      onClick={() => { setUserMenuOpen(false); navigate('/dashboard/profile'); }}
                    >
                      <i className="fas fa-id-badge" aria-hidden="true"></i>
                      <span>My profile</span>
                    </button>
                    <div className="top-bar-menu-sep" role="separator" />
                    <button
                      type="button"
                      className="top-bar-menu-item is-signout"
                      id="top-bar-logout-btn"
                      role="menuitem"
                      onClick={logout}
                    >
                      <i className="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
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
                <img src="/Untitled.png" alt="ATOP" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
        .top-bar-usermenu { position: relative; }
        .top-bar-user {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 4px 12px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.85);
          font-family: var(--font-heading);
          font-size: inherit;
          font-weight: 600;
          transition: var(--transition-fast);
        }
        .top-bar-user:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14); color: var(--white); }
        .top-bar-user i { color: var(--gold-light); font-size: 0.95rem; }
        .top-bar-caret { font-size: 0.62rem !important; color: rgba(255,255,255,0.5) !important; transition: var(--transition-fast); }
        .top-bar-caret.is-open { transform: rotate(180deg); }

        /* User dropdown — must clear the sticky .header (z-index 1000) below it. */
        .top-bar-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          z-index: 1100;
          min-width: 200px;
          padding: 6px;
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-md);
          box-shadow: 0 18px 44px rgba(15, 25, 46, 0.22);
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: top-bar-menu-in 0.16s ease-out both;
        }
        @keyframes top-bar-menu-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .top-bar-menu-item {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: var(--font-heading);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--navy);
          transition: var(--transition-fast);
        }
        .top-bar-menu-item i { width: 18px; text-align: center; font-size: 0.9rem; color: var(--gray-400); }
        .top-bar-menu-item:hover { background: var(--gray-100); }
        .top-bar-menu-item.is-signout, .top-bar-menu-item.is-signout i { color: #B91C1C; }
        .top-bar-menu-item.is-signout:hover { background: #FEF2F2; }
        .top-bar-menu-sep { height: 1px; margin: 4px 6px; background: var(--gray-200); }
        .top-bar-dash { display: flex; align-items: center; gap: 7px; color: rgba(255,255,255,0.78); font-family: var(--font-heading); font-weight: 600; }
        .top-bar-dash i { color: var(--gold-light); }
        .top-bar-dash:hover { color: var(--white); }
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
      `}</style>
    </>
  );
}


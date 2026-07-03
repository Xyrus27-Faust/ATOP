import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Pillars from './components/Pillars';
import About from './components/About';
import PearlAwards from './components/PearlAwards';
import NewsEvents from './components/NewsEvents';
import Membership from './components/Membership';
import Footer from './components/Footer';

// Subpages
import AboutPage from './components/AboutPage';
import MembershipPage from './components/MembershipPage';
import ProgramsPage from './components/ProgramsPage';
import NewsPage from './components/NewsPage';
import ResourcesPage from './components/ResourcesPage';
import ContactPage from './components/ContactPage';
import PublicAwardCategoriesPage from './components/PublicAwardCategoriesPage';

// The marketing pages are real URLs so refresh, browser back/forward, and deep
// links work (previously the nav was state-only and a refresh reset to home).
// The nav still calls setCurrentPage(id); we translate that to a route change and
// derive the active page from the URL, so the child components stay unchanged.
const PAGE_PATHS = {
  home: '/',
  about: '/about',
  membership: '/membership',
  programs: '/programs',
  news: '/news',
  resources: '/resources',
  contact: '/contact',
  awards: '/awards',
};

function pageFromPath(pathname) {
  const match = Object.keys(PAGE_PATHS).find((id) => PAGE_PATHS[id] === pathname);
  return match || 'home';
}

function App() {
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = pageFromPath(location.pathname);
  const setCurrentPage = (id) => navigate(PAGE_PATHS[id] ?? '/');

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const renderContent = () => {
    switch (currentPage) {
      case 'about':
        return <AboutPage />;
      case 'membership':
        return <MembershipPage />;
      case 'programs':
        return <ProgramsPage />;
      case 'news':
        return <NewsPage />;
      case 'resources':
        return <ResourcesPage />;
      case 'contact':
        return <ContactPage />;
      case 'awards':
        return <PublicAwardCategoriesPage />;
      case 'home':
      default:
        return (
          <>
            <Hero setCurrentPage={setCurrentPage} />
            <PearlAwards setCurrentPage={setCurrentPage} />
            <Pillars />
            <About setCurrentPage={setCurrentPage} />
            <NewsEvents setCurrentPage={setCurrentPage} />
            <Membership setCurrentPage={setCurrentPage} />
          </>
        );
    }
  };

  return (
    <>
      <Header scrolled={scrolled} currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main>
        {renderContent()}
      </main>
      <Footer setCurrentPage={setCurrentPage} />

      <button
        className={`scroll-top ${showScrollTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
        id="scroll-top-btn"
      >
        <i className="fas fa-chevron-up"></i>
      </button>
    </>
  );
}

export default App;

import { useState, useEffect } from 'react';
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

function App() {
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Open the public Award Categories page directly when reached at /awards
  // (e.g. linked from the dashboard) — the marketing nav is otherwise state-only.
  const [currentPage, setCurrentPage] = useState(
    () => (window.location.pathname === '/awards' ? 'awards' : 'home'),
  );

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
            <Pillars />
            <About setCurrentPage={setCurrentPage} />
            <PearlAwards setCurrentPage={setCurrentPage} />
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

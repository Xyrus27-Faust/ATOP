import { useState } from 'react';

export default function PearlAwards({ setCurrentPage }) {
  const [activeTab, setActiveTab] = useState('overview');

  const photos = [
    {
      src: '/Pearl Award.jpg',
      title: 'The Pearl Award Trophy',
      desc: 'The symbol of national excellence, honoring local government units that demonstrate exceptional governance and sustainable tourism practices.',
    },
    {
      src: '/pearl awards with sirs.jpg',
      title: 'Recognition of Excellence',
      desc: 'Tourism officers and distinguished leaders gather to celebrate breakthrough achievements in Philippine destination marketing and cultural preservation.',
    },
    {
      src: '/pearl led awards.jpg',
      title: 'Grand Awards Ceremony',
      desc: 'A premium, state-of-the-art celebration honoring outstanding tourism officers and top-performing municipalities, cities, and provinces.',
    },
  ];

  const tabsContent = {
    overview: {
      title: 'Award Overview & Purpose',
      icon: 'fas fa-info-circle',
      content: (
        <div className="tab-details">
          <p>
            The **ATOP National Tourism Pearl Awards** recognize the best practices in local governance, destination management, and sustainable tourism development in the Philippines.
          </p>
          <div className="objectives-grid">
            <div className="obj-card">
              <span className="obj-letter">R</span>
              <div>
                <h4>Recognition</h4>
                <p>Honoring exceptional LGU-led tourism practices, projects, and innovations.</p>
              </div>
            </div>
            <div className="obj-card">
              <span className="obj-letter">Be</span>
              <div>
                <h4>Benchmarking</h4>
                <p>Promoting outstanding models of local governance for replication.</p>
              </div>
            </div>
            <div className="obj-card">
              <span className="obj-letter">S</span>
              <div>
                <h4>Sustainability</h4>
                <p>Encouraging initiatives protecting heritage, culture, and resources.</p>
              </div>
            </div>
            <div className="obj-card">
              <span className="obj-letter">T</span>
              <div>
                <h4>Transparency</h4>
                <p>Providing a fair, credible, and third-party verified awards system.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    eligibility: {
      title: 'Eligibility & Rules',
      icon: 'fas fa-clipboard-list',
      content: (
        <div className="tab-details">
          <p>
            Entries are open to all Local Government Units (LGUs) in the Philippines. The guidelines classify participation under four distinct levels:
          </p>
          <ul className="eligibility-list">
            <li><strong>LGU Levels:</strong> Provinces, Highly Urbanized Cities (HUCs), Component Cities (CCs), and Municipalities.</li>
            <li><strong>Submission Limit:</strong> Only one (1) LGU entry per category is accepted.</li>
            <li><strong>Coverage Period:</strong> Initiatives must have been implemented, produced, or significantly conducted within the year <strong>2025</strong>.</li>
            <li><strong>Timeline:</strong> Electronic submissions open on <strong>July 1, 2026</strong> and close on <strong>July 31, 2026</strong>.</li>
          </ul>
        </div>
      ),
    },
    judging: {
      title: 'Judging & Assessment Process',
      icon: 'fas fa-gavel',
      content: (
        <div className="tab-details">
          <p>
            To ensure complete independence, final results are talled and validated exclusively by a third-party committee.
          </p>
          <div className="process-timeline">
            <div className="process-step">
              <span className="step-num">1</span>
              <h4>Technical Review</h4>
              <p>ATOP Technical Working Group (TWG) validates completeness and compliance. LGUs get a 1-week grace period to resolve deficiencies.</p>
            </div>
            <div className="process-step">
              <span className="step-num">2</span>
              <h4>Initial Scoring</h4>
              <p>Independent assessors (3PIC) score entries out of 100 based on category rubrics. Top 5 scoring entries (minimum 80 pts) become finalists.</p>
            </div>
            <div className="process-step">
              <span className="step-num">3</span>
              <h4>Final Judging</h4>
              <p>Finalists undergo online interviews. Judges rank them 1 to 5. The entry with the lowest average numerical rank is the Grand Winner.</p>
            </div>
          </div>
        </div>
      ),
    },
    checklist: {
      title: 'Nomination Checklist',
      icon: 'fas fa-tasks',
      content: (
        <div className="tab-details">
          <p>
            Ensure your electronic submission meets the exact requirements to avoid technical disqualification:
          </p>
          <div className="checklist-grid">
            <div className="check-item">
              <i className="fas fa-check-circle text-gold"></i>
              <div>
                <strong>Executive Summary:</strong> Encoded summary of max 300 words.
              </div>
            </div>
            <div className="check-item">
              <i className="fas fa-check-circle text-gold"></i>
              <div>
                <strong>Entry Narrative:</strong> Detailed discussion of max 200 words per criterion.
              </div>
            </div>
            <div className="check-item">
              <i className="fas fa-check-circle text-gold"></i>
              <div>
                <strong>YouTube Video Link:</strong> Full HD (1080p, 16:9 ratio, landscape) video with descriptive narration.
              </div>
            </div>
            <div className="check-item">
              <i className="fas fa-check-circle text-gold"></i>
              <div>
                <strong>LCE Endorsement:</strong> Signed one-page endorsement letter on official LGU letterhead in PDF format.
              </div>
            </div>
          </div>
        </div>
      ),
    },
  };

  return (
    <section className="pearl-awards-section" id="pearl-awards">
      <div className="container">
        <div className="pearl-awards-header">
          <h2 className="section-title">ATOP Pearl Awards</h2>
          <p className="pearl-awards-subtitle">
            Honoring exceptional local government initiatives, sustainable practices, 
            and outstanding tourism leadership across the Philippines.
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="pearl-photo-grid">
          {photos.map((photo, index) => (
            <div className="pearl-photo-card" key={index}>
              <div className="pearl-img-wrapper">
                <img src={photo.src} alt={photo.title} className="pearl-img" />
                <div className="pearl-img-overlay"></div>
              </div>
              <div className="pearl-card-content">
                <h3>{photo.title}</h3>
                <p>{photo.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Tabs Section */}
        <div className="pearl-tabs-container">
          <div className="pearl-tabs-header">
            {Object.keys(tabsContent).map((tabKey) => (
              <button
                key={tabKey}
                className={`pearl-tab-btn ${activeTab === tabKey ? 'active' : ''}`}
                onClick={() => setActiveTab(tabKey)}
              >
                <i className={tabsContent[tabKey].icon}></i>
                {tabsContent[tabKey].title.split(' ')[0]} {/* Short name */}
              </button>
            ))}
          </div>

          <div className="pearl-tabs-body">
            <h3 className="tab-title">
              <i className={tabsContent[activeTab].icon} style={{ marginRight: '10px', color: 'var(--gold)' }}></i>
              {tabsContent[activeTab].title}
            </h3>
            <div className="tab-description">
              {tabsContent[activeTab].content}
            </div>
          </div>
        </div>

        <div className="pearl-awards-cta">
          <button
            type="button"
            className="btn-gold"
            id="browse-categories-btn"
            onClick={() => { setCurrentPage?.('awards'); window.scrollTo(0, 0); }}
          >
            <i className="fas fa-trophy"></i> Browse Award Categories
          </button>
          <a
            href="/ATOP Pearl Awards Guidelines Manual 2026 (FINAL).pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="pearl-cta-outline"
            id="view-manual-btn"
          >
            <i className="fas fa-file-pdf"></i> View 2026 Guidelines Manual
          </a>
        </div>
      </div>

      <style>{`
        .pearl-awards-section {
          padding: 120px 0;
          background: var(--white);
          position: relative;
        }

        .pearl-awards-header {
          text-align: center;
          margin-bottom: 56px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .pearl-awards-subtitle {
          max-width: 650px;
          font-size: 1rem;
          color: var(--gray-600);
          margin-top: 16px;
          line-height: 1.8;
        }

        .pearl-photo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          margin-bottom: 64px;
        }

        .pearl-photo-card {
          background: var(--off-white);
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow-md);
          transition: var(--transition);
          border: 1px solid var(--gray-200);
          display: flex;
          flex-direction: column;
        }

        .pearl-photo-card:hover {
          transform: translateY(-8px);
          box-shadow: var(--shadow-lg);
          border-color: rgba(200, 168, 75, 0.25);
        }

        .pearl-img-wrapper {
          position: relative;
          height: 240px;
          overflow: hidden;
        }

        .pearl-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: var(--transition);
        }

        .pearl-photo-card:hover .pearl-img {
          transform: scale(1.08);
        }

        .pearl-img-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(0deg, rgba(15, 25, 46, 0.4) 0%, transparent 100%);
          opacity: 0;
          transition: var(--transition);
        }

        .pearl-photo-card:hover .pearl-img-overlay {
          opacity: 1;
        }

        .pearl-card-content {
          padding: 24px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .pearl-card-content h3 {
          font-family: var(--font-heading);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 12px;
          position: relative;
        }

        .pearl-card-content p {
          font-size: 0.86rem;
          color: var(--gray-600);
          line-height: 1.7;
          flex-grow: 1;
        }

        /* Tabs Section styling */
        .pearl-tabs-container {
          background: var(--off-white);
          border-radius: var(--radius-md);
          border: 1px solid var(--gray-200);
          overflow: hidden;
          margin-bottom: 56px;
          box-shadow: var(--shadow-sm);
        }

        .pearl-tabs-header {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid var(--gray-200);
          background: var(--white);
        }

        .pearl-tab-btn {
          padding: 20px;
          font-family: var(--font-heading);
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--gray-600);
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: var(--transition-fast);
          position: relative;
        }

        .pearl-tab-btn:hover {
          color: var(--gold);
          background: rgba(200, 168, 75, 0.03);
        }

        .pearl-tab-btn.active {
          color: var(--gold-dark);
          background: var(--off-white);
        }

        .pearl-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--gold);
        }

        .pearl-tabs-body {
          padding: 40px;
        }

        .tab-title {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 24px;
          display: flex;
          align-items: center;
        }

        .tab-description p {
          font-size: 0.95rem;
          color: var(--text-body);
          line-height: 1.8;
          margin-bottom: 28px;
        }

        /* Tab Content grids & lists */
        .objectives-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .obj-card {
          display: flex;
          gap: 16px;
          background: var(--white);
          padding: 20px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--gray-200);
        }

        .obj-letter {
          font-family: var(--font-heading);
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--gold);
          line-height: 1;
          min-width: 32px;
        }

        .obj-card h4 {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 6px;
        }

        .obj-card p {
          font-size: 0.82rem;
          color: var(--gray-600);
          line-height: 1.6;
          margin-bottom: 0;
        }

        .eligibility-list {
          list-style: none;
          padding: 0;
        }

        .eligibility-list li {
          position: relative;
          padding-left: 28px;
          margin-bottom: 16px;
          font-size: 0.92rem;
          color: var(--text-body);
          line-height: 1.7;
        }

        .eligibility-list li::before {
          content: '✔';
          position: absolute;
          left: 4px;
          color: var(--gold);
          font-weight: bold;
        }

        .process-timeline {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }

        .process-step {
          position: relative;
          background: var(--white);
          padding: 24px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--gray-200);
        }

        .step-num {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--gold);
          color: var(--white);
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 1rem;
          border-radius: 50%;
          margin-bottom: 16px;
        }

        .process-step h4 {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 10px;
        }

        .process-step p {
          font-size: 0.8rem;
          color: var(--gray-600);
          line-height: 1.6;
          margin-bottom: 0;
        }

        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .check-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          font-size: 0.9rem;
          color: var(--text-body);
          line-height: 1.6;
        }

        .text-gold {
          color: var(--gold);
          font-size: 1.1rem;
          margin-top: 2px;
        }

        .pearl-awards-cta {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .pearl-cta-outline {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 0.82rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 14px 30px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--gray-300, #cbd5e1);
          color: var(--navy);
          background: var(--white);
          text-decoration: none;
          cursor: pointer;
          transition: var(--transition);
        }

        .pearl-cta-outline:hover {
          border-color: var(--navy);
          background: var(--navy);
          color: var(--white);
        }

        @media (max-width: 1024px) {
          .pearl-photo-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
          .objectives-grid,
          .process-timeline,
          .checklist-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .pearl-awards-section {
            padding: 80px 0;
          }
          .pearl-photo-grid {
            grid-template-columns: 1fr;
          }
          .pearl-img-wrapper {
            height: 200px;
          }
          .pearl-tabs-header {
            grid-template-columns: repeat(2, 1fr);
          }
          .pearl-tabs-body {
            padding: 24px;
          }
        }
      `}</style>
    </section>
  );
}

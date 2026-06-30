export default function ResourcesPage() {
  const documents = [
    {
      title: 'ATOP Pearl Awards Guidelines Manual 2026',
      type: 'PDF Document',
      size: '1.2 MB',
      link: '/ATOP Pearl Awards Guidelines Manual 2026 (FINAL).pdf',
      desc: 'Official handbook containing rules, categories, rubrics, and technical video guidelines for the 2026 awards cycle.',
    },
    {
      title: 'Pearl Awards — Applicant Guide',
      type: 'PDF Document',
      size: '5.5 MB',
      link: '/guides/applicant-guide.pdf',
      desc: 'Step-by-step walkthrough for entering the Pearl Awards: create an account, browse the categories, build your bidbook, and submit.',
    },
    {
      title: 'Pearl Awards — Validator Guide',
      type: 'PDF Document',
      size: '4.5 MB',
      link: '/guides/validator-guide.pdf',
      desc: 'How to register as a validator and review submitted entries — request access, get approved, then validate.',
    },
    {
      title: 'ATOP Member Registration & Renewal Form',
      type: 'PDF Form',
      size: '450 KB',
      link: '#',
      desc: 'Downloadable form for manually enrolling LGUs or renewing annual regular/associate memberships.',
    },
    {
      title: 'Model Local Tourism Code Template',
      type: 'DOCX Document',
      size: '820 KB',
      link: '#',
      desc: 'A framework template helping local councils draft, review, or modernize municipal and city tourism ordinances.',
    },
    {
      title: 'ATOP National Convention 2025 Annual Report',
      type: 'PDF Document',
      size: '3.4 MB',
      link: '#',
      desc: 'Summary of finances, event participation, board resolutions, and key initiatives completed in the past fiscal year.',
    },
  ];

  const stats = [
    { region: 'Region VII (Central Visayas)', arrivals: '4,821,340', growth: '+12.4%', status: 'Outstanding' },
    { region: 'CAR (Cordillera Admin Region)', arrivals: '1,924,560', growth: '+8.2%', status: 'Increasing' },
    { region: 'Region IV-A (CALABARZON)', arrivals: '6,211,880', growth: '+15.1%', status: 'Outstanding' },
    { region: 'Region XI (Davao Region)', arrivals: '2,450,210', growth: '+4.3%', status: 'Stable' },
  ];

  return (
    <div className="subpage-container animate-fade-in">
      <div className="subpage-banner">
        <div className="container">
          <h2>Resources &amp; Downloads</h2>
          <p>Access official guidelines, policy templates, registration forms, and regional tourism reports</p>
        </div>
      </div>

      <div className="container subpage-body">
        {/* Featured Resource - Pearl Awards Manual */}
        <section className="featured-resource-box">
          <div className="featured-badge">Featured Document</div>
          <div className="featured-inner">
            <div className="featured-icon"><i className="fas fa-award"></i></div>
            <div className="featured-text">
              <h3>ATOP Pearl Awards Guidelines Manual 2026 (FINAL)</h3>
              <p>
                Get the comprehensive guide detailing the LGU categories, criteria, scoring mechanisms, 
                and electronic submission instructions for this year's awards.
              </p>
              <div className="featured-actions">
                <a 
                  href="/ATOP Pearl Awards Guidelines Manual 2026 (FINAL).pdf" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-gold"
                >
                  <i className="fas fa-file-pdf"></i> View PDF Online
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Download Grid */}
        <section className="download-grid-section">
          <h3 className="subpage-section-title">Documents Library</h3>
          <div className="doc-grid">
            {documents.map((doc, idx) => (
              <div className="doc-card" key={idx}>
                <div className="doc-card-header">
                  <div className="doc-file-icon"><i className="far fa-file-alt"></i></div>
                  <div>
                    <h4>{doc.title}</h4>
                    <span className="doc-meta">{doc.type} • {doc.size}</span>
                  </div>
                </div>
                <p className="doc-desc">{doc.desc}</p>
                <a 
                  href={doc.link} 
                  target={doc.link !== '#' ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  className="doc-download-link"
                  onClick={(e) => doc.link === '#' && e.preventDefault()}
                >
                  <i className="fas fa-download"></i> Download File
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Statistics Section */}
        <section className="statistics-section">
          <h3 className="subpage-section-title">LGU Tourism Data Benchmarks</h3>
          <p className="section-intro-text">
            Key statistical highlights sourced from regional reports, displaying tourism growth and visitor arrivals.
          </p>

          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Region / Destination Group</th>
                  <th>Visitor Arrivals (2025)</th>
                  <th>Year-over-Year Growth</th>
                  <th>LGU Performance Rating</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, idx) => (
                  <tr key={idx}>
                    <td><strong>{s.region}</strong></td>
                    <td>{s.arrivals}</td>
                    <td className="growth-text">{s.growth}</td>
                    <td>
                      <span className={`status-badge ${s.status.toLowerCase()}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{`
        .subpage-container {
          background: var(--off-white);
          min-height: 80vh;
        }

        .subpage-banner {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%);
          padding: 80px 0;
          color: var(--white);
          border-bottom: 4px solid var(--gold);
        }

        .subpage-banner h2 {
          font-family: var(--font-heading);
          font-size: 2.5rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--gold-light);
          margin-bottom: 12px;
        }

        .subpage-banner p {
          font-size: 1.05rem;
          color: rgba(255, 255, 255, 0.8);
          max-width: 600px;
        }

        .subpage-body {
          padding: 80px 32px;
        }

        .subpage-section-title {
          font-family: var(--font-heading);
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--navy);
          text-transform: uppercase;
          margin-bottom: 24px;
          position: relative;
        }

        .subpage-section-title::after {
          content: '';
          display: block;
          width: 50px;
          height: 3px;
          background: var(--gold);
          margin-top: 10px;
        }

        .section-intro-text {
          margin: -10px 0 28px;
          color: var(--gray-600);
          font-size: 0.95rem;
        }

        /* Featured Resource */
        .featured-resource-box {
          background: radial-gradient(circle at 10% 20%, var(--navy-light) 0%, var(--navy) 100%);
          color: var(--white);
          border-radius: var(--radius-lg);
          padding: 44px;
          border: 1px solid rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
          margin-bottom: 64px;
          box-shadow: var(--shadow-md);
        }

        .featured-resource-box::before {
          content: '';
          position: absolute;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(200, 168, 75, 0.15) 0%, transparent 70%);
          right: -50px;
          top: -50px;
          pointer-events: none;
        }

        .featured-badge {
          position: absolute;
          top: 0;
          right: 44px;
          background: var(--gold);
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 6px 14px;
          border-bottom-left-radius: 6px;
          border-bottom-right-radius: 6px;
        }

        .featured-inner {
          display: flex;
          gap: 32px;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .featured-icon {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-md);
          background: rgba(200, 168, 75, 0.2);
          border: 1px solid rgba(200, 168, 75, 0.4);
          color: var(--gold-light);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.2rem;
        }

        .featured-text h3 {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--gold-light);
          margin-bottom: 12px;
        }

        .featured-text p {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.8);
          line-height: 1.7;
          margin-bottom: 24px;
          max-width: 700px;
        }

        /* Doc Grid */
        .download-grid-section {
          margin-bottom: 64px;
        }

        .doc-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 28px;
        }

        .doc-card {
          background: var(--white);
          border-radius: var(--radius-md);
          padding: 28px;
          border: 1px solid var(--gray-200);
          box-shadow: var(--shadow-sm);
          transition: var(--transition);
          display: flex;
          flex-direction: column;
        }

        .doc-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: rgba(200, 168, 75, 0.25);
        }

        .doc-card-header {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }

        .doc-file-icon {
          font-size: 1.6rem;
          color: var(--gold-dark);
        }

        .doc-card h4 {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--navy);
        }

        .doc-meta {
          font-size: 0.72rem;
          color: var(--gray-600);
          font-weight: 600;
        }

        .doc-desc {
          font-size: 0.84rem;
          color: var(--gray-600);
          line-height: 1.6;
          margin-bottom: 20px;
          flex-grow: 1;
        }

        .doc-download-link {
          font-family: var(--font-heading);
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--gold-dark);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: var(--transition-fast);
        }

        .doc-download-link:hover {
          color: var(--gold);
        }

        /* Stats Table */
        .stats-table-wrapper {
          background: var(--white);
          border-radius: var(--radius-md);
          border: 1px solid var(--gray-200);
          box-shadow: var(--shadow-sm);
          overflow-x: auto;
        }

        .stats-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .stats-table th, 
        .stats-table td {
          padding: 18px 24px;
          font-size: 0.9rem;
          border-bottom: 1px solid var(--gray-200);
        }

        .stats-table th {
          background: var(--navy);
          color: var(--white);
          font-family: var(--font-heading);
          font-size: 0.76rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .stats-table tbody tr:last-child td {
          border-bottom: none;
        }

        .growth-text {
          color: #22C55E;
          font-weight: 700;
        }

        .status-badge {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 4px 10px;
          border-radius: 4px;
          display: inline-block;
        }

        .status-badge.outstanding {
          background: rgba(34, 197, 94, 0.1);
          color: #22C55E;
        }

        .status-badge.increasing {
          background: rgba(59, 130, 246, 0.1);
          color: #3B82F6;
        }

        .status-badge.stable {
          background: rgba(156, 163, 175, 0.15);
          color: var(--gray-600);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        @media (max-width: 992px) {
          .doc-grid {
            grid-template-columns: 1fr;
          }
          .featured-inner {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
          }
        }
      `}</style>
    </div>
  );
}

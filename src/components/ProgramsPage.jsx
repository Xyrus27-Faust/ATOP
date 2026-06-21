export default function ProgramsPage() {
  const programsList = [
    {
      icon: 'fas fa-graduation-cap',
      title: 'Capacity Building Seminars',
      img: '/news_training.png',
      desc: 'Regular technical workshops and training seminars conducted across the country to standardize tourism operations, statistics collecting, and crisis management at the LGU level.',
      details: ['Local Tourism Code Formulation', 'Statistics & Data Analytics', 'Sustainable Tour Guiding Standards'],
    },
    {
      icon: 'fas fa-globe-asia',
      title: 'National Tourism Conventions',
      img: '/news_convention.png',
      desc: 'The annual assembly uniting over 1,000 tourism officers, governors, mayors, and national leaders to network, debate policies, and celebrate achievements (including the Pearl Awards gala).',
      details: ['Keynote Addresses by DOT officials', 'Regional Destination Showcases', 'General Assembly & Board Elections'],
    },
    {
      icon: 'fas fa-balance-scale',
      title: 'Advocacy & Policy Drafting',
      img: '/news_travel_mart.png',
      desc: 'ATOP collaborates directly with the Senate, Congress, and Department of Tourism to draft legislative reforms that support LGU officers, establish permanent tourism offices, and allocate funding.',
      details: ['LGU Tourism Officer Security of Tenure', 'Community-Based Tourism Support Bill', 'National Tourism Development Plan input'],
    },
  ];

  return (
    <div className="subpage-container animate-fade-in">
      <div className="subpage-banner">
        <div className="container">
          <h2>Our Programs</h2>
          <p>Discover our training, assemblies, and policy initiatives driving LGU growth</p>
        </div>
      </div>

      <div className="container subpage-body">
        <h3 className="subpage-section-title text-center">Core Pillars of Action</h3>
        <p className="section-intro-text text-center">
          ATOP designs and conducts structural programs to professionalize tourism leadership and enrich Philippine travel sectors.
        </p>

        <div className="programs-grid">
          {programsList.map((prog, index) => (
            <div className="program-card-horizontal" key={index}>
              <div className="program-card-img">
                <img src={prog.img} alt={prog.title} />
              </div>
              <div className="program-card-info">
                <div className="program-card-header">
                  <div className="prog-icon"><i className={prog.icon}></i></div>
                  <h3>{prog.title}</h3>
                </div>
                <p className="prog-desc">{prog.desc}</p>
                <div className="prog-subtopics">
                  <h5>Key Areas:</h5>
                  <div className="subtopic-tags">
                    {prog.details.map((detail, idx) => (
                      <span className="subtopic-tag" key={idx}>
                        <i className="fas fa-tag"></i> {detail}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
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

        .text-center::after {
          margin-left: auto;
          margin-right: auto;
        }

        .text-center {
          text-align: center;
        }

        .section-intro-text {
          max-width: 600px;
          margin: -10px auto 48px;
          color: var(--gray-600);
          font-size: 0.95rem;
        }

        /* Programs Grid styling */
        .programs-grid {
          display: flex;
          flex-direction: column;
          gap: 40px;
          margin-top: 24px;
        }

        .program-card-horizontal {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid var(--gray-200);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          display: grid;
          grid-template-columns: 1fr 1.6fr;
          transition: var(--transition);
        }

        .program-card-horizontal:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-md);
          border-color: rgba(200, 168, 75, 0.25);
        }

        .program-card-img {
          height: 100%;
          min-height: 280px;
        }

        .program-card-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .program-card-info {
          padding: 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .program-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .prog-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(200, 168, 75, 0.1);
          color: var(--gold);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        }

        .program-card-header h3 {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--navy);
        }

        .prog-desc {
          font-size: 0.92rem;
          color: var(--text-body);
          line-height: 1.7;
          margin-bottom: 24px;
        }

        .prog-subtopics h5 {
          font-family: var(--font-heading);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--navy);
          text-transform: uppercase;
          margin-bottom: 12px;
          letter-spacing: 0.05em;
        }

        .subtopic-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .subtopic-tag {
          font-size: 0.74rem;
          font-weight: 600;
          color: var(--gold-dark);
          background: rgba(200, 168, 75, 0.06);
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid rgba(200, 168, 75, 0.2);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        @media (max-width: 992px) {
          .program-card-horizontal {
            grid-template-columns: 1fr;
          }
          .program-card-img {
            min-height: 220px;
            height: 220px;
          }
          .program-card-info {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}

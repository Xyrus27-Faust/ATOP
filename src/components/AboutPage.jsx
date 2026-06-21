export default function AboutPage() {
  const leaders = [
    { name: 'Albert F. Pascual', role: 'National President', img: '/Untitled.png' },
    { name: 'Maria Elena S. Santos', role: 'Vice President for Luzon', img: '/Untitled.png' },
    { name: 'Danilo P. Fernandez', role: 'Vice President for Visayas', img: '/Untitled.png' },
    { name: 'Grace M. Alih', role: 'Vice President for Mindanao', img: '/Untitled.png' },
  ];

  return (
    <div className="subpage-container animate-fade-in">
      {/* Banner */}
      <div className="subpage-banner">
        <div className="container">
          <h2>About Us</h2>
          <p>Learn about our organization, vision, history, and leadership</p>
        </div>
      </div>

      <div className="container subpage-body">
        {/* Core Info */}
        <section className="about-intro-grid">
          <div>
            <h3 className="subpage-section-title">Our History</h3>
            <p>
              The Association of Tourism Officers of the Philippines, Inc. (ATOP) was established 
              to provide local government tourism officers with a unified platform for professional growth, 
              knowledge sharing, and strategic collaboration. Over the decades, ATOP has grown into the 
              nation's leading LGU tourism network, partnering directly with the Department of Tourism (DOT).
            </p>
            <p>
              By driving sustainable destination management and high-impact regional promotions, 
              our members continue to champion the economic and cultural development of communities nationwide.
            </p>
          </div>
          <div className="about-intro-images">
            <img src="/about_rice_terraces.png" alt="Rice Terraces" className="about-collage-img" />
            <img src="/about_church.png" alt="Historic Church" className="about-collage-img" />
          </div>
        </section>

        {/* Vision & Mission */}
        <section className="vision-mission-section">
          <div className="vision-mission-grid">
            <div className="vm-card">
              <div className="vm-icon"><i className="fas fa-eye"></i></div>
              <h3>Our Vision</h3>
              <p>
                To be a globally recognized institution of professional local government tourism officers 
                championing sustainable development, inclusive growth, and cultural pride in Philippine tourism.
              </p>
            </div>
            <div className="vm-card">
              <div className="vm-icon"><i className="fas fa-bullseye"></i></div>
              <h3>Our Mission</h3>
              <p>
                To empower tourism officers through continuous training, establish high-standard local governance models, 
                and build key national partnerships to uplift community-based tourism products.
              </p>
            </div>
          </div>
        </section>

        {/* Leadership */}
        <section className="leadership-section">
          <h3 className="subpage-section-title text-center">Board of Directors</h3>
          <p className="section-intro-text text-center">
            The dedicated officers guiding ATOP's mission to strengthen Philippine tourism governance.
          </p>
          <div className="leadership-grid">
            {leaders.map((leader, index) => (
              <div className="leader-card" key={index}>
                <div className="leader-avatar-wrapper">
                  <img src={leader.img} alt={leader.name} className="leader-avatar" />
                </div>
                <h4>{leader.name}</h4>
                <p className="leader-role">{leader.role}</p>
              </div>
            ))}
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

        /* Intro Grid */
        .about-intro-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
          margin-bottom: 80px;
        }

        .about-intro-grid p {
          font-size: 1rem;
          color: var(--text-body);
          line-height: 1.8;
          margin-bottom: 20px;
        }

        .about-intro-images {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .about-collage-img {
          width: 100%;
          height: 250px;
          object-fit: cover;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--gray-200);
          transition: var(--transition);
        }

        .about-collage-img:hover {
          transform: scale(1.04);
        }

        /* Vision & Mission */
        .vision-mission-section {
          background: var(--white);
          padding: 64px 40px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          margin-bottom: 80px;
          border: 1px solid var(--gray-200);
        }

        .vision-mission-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
        }

        .vm-card {
          text-align: center;
          padding: 24px;
        }

        .vm-icon {
          font-size: 2.2rem;
          color: var(--gold);
          margin-bottom: 16px;
        }

        .vm-card h3 {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--navy);
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .vm-card p {
          font-size: 0.95rem;
          color: var(--gray-600);
          line-height: 1.7;
        }

        /* Leadership */
        .leadership-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }

        .leader-card {
          background: var(--white);
          padding: 32px 24px;
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--gray-200);
          text-align: center;
          transition: var(--transition);
        }

        .leader-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-md);
          border-color: rgba(200, 168, 75, 0.25);
        }

        .leader-avatar-wrapper {
          width: 100px;
          height: 100px;
          margin: 0 auto 20px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--gray-100);
          border: 2px solid var(--gold);
          padding: 6px;
        }

        .leader-avatar {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 50%;
        }

        .leader-card h4 {
          font-family: var(--font-heading);
          font-size: 1rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 6px;
        }

        .leader-role {
          font-size: 0.8rem;
          color: var(--gold-dark);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        @media (max-width: 1024px) {
          .about-intro-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .vision-mission-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
          .leadership-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 576px) {
          .leadership-grid {
            grid-template-columns: 1fr;
          }
          .about-intro-images {
            grid-template-columns: 1fr;
          }
          .subpage-banner {
            padding: 60px 0;
          }
        }
      `}</style>
    </div>
  );
}

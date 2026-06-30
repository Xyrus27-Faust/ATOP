export default function MembershipPage() {
  const benefits = [
    { icon: 'fas fa-globe', title: 'National Recognition', desc: 'Eligibility to participate in the National Pearl Awards for outstanding tourism LGUs.' },
    { icon: 'fas fa-graduation-cap', title: 'Capacity Building', desc: 'Free or discounted entry to professional seminars, workshops, and national conventions.' },
    { icon: 'fas fa-folder-open', title: 'Exclusive Resources', desc: 'Access to template local tourism codes, data, research, and DOT updates.' },
    { icon: 'fas fa-users', title: 'Officer Network', desc: 'Connect and collaborate with local government tourism officers nationwide.' },
  ];

  return (
    <div className="subpage-container animate-fade-in">
      <div className="subpage-banner">
        <div className="container">
          <h2>Membership</h2>
          <p>Join the national network of tourism officers and shape the future of Philippine destinations</p>
        </div>
      </div>

      <div className="container subpage-body">
        <div className="membership-info-side">
          <h3 className="subpage-section-title">Why Join ATOP?</h3>
          <p className="intro-paragraph">
            ATOP membership is open to local tourism officers representing provinces, cities, and municipalities
            across the Philippines. Regular membership empowers officers with skills, recognition, and network advocacy.
          </p>

          <div className="benefits-vgrid">
            {benefits.map((b, i) => (
              <div className="benefit-vcard" key={i}>
                <div className="b-icon"><i className={b.icon}></i></div>
                <div>
                  <h4>{b.title}</h4>
                  <p>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="membership-fees-box">
            <h4>Membership Classification &amp; Fees</h4>
            <ul>
              <li><strong>Regular Members:</strong> Tourism officers appointed/designated in LGUs. (₱2,000 Annual Fee)</li>
              <li><strong>Institutional Members:</strong> Academic partners and tourism organizations. (₱5,000 Annual Fee)</li>
              <li><strong>Associate Members:</strong> Tourism office staff and advocates. (₱1,000 Annual Fee)</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        .subpage-container { background: var(--off-white); min-height: 80vh; }

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

        .subpage-body { padding: 80px 32px; }

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

        .intro-paragraph {
          font-size: 1.05rem;
          line-height: 1.7;
          color: var(--text-body);
          margin-bottom: 32px;
        }

        /* Single-column info layout (the LGU registration form was removed). */
        .membership-info-side { max-width: 860px; margin: 0 auto; }

        .benefits-vgrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }

        .benefit-vcard {
          display: flex;
          gap: 16px;
          background: var(--white);
          padding: 20px;
          border-radius: var(--radius-md);
          border: 1px solid var(--gray-200);
        }
        .b-icon { font-size: 1.5rem; color: var(--gold); min-width: 32px; }
        .benefit-vcard h4 {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 6px;
        }
        .benefit-vcard p { font-size: 0.82rem; color: var(--gray-600); line-height: 1.6; }

        .membership-fees-box {
          background: var(--navy);
          color: var(--white);
          padding: 32px;
          border-radius: var(--radius-md);
          border-left: 5px solid var(--gold);
        }
        .membership-fees-box h4 {
          font-family: var(--font-heading);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--gold-light);
          margin-bottom: 16px;
          text-transform: uppercase;
        }
        .membership-fees-box ul { list-style: none; padding: 0; }
        .membership-fees-box ul li {
          font-size: 0.85rem;
          line-height: 1.7;
          margin-bottom: 12px;
          color: rgba(255,255,255,0.85);
        }
        .membership-fees-box ul li:last-child { margin-bottom: 0; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }

        @media (max-width: 768px) {
          .benefits-vgrid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

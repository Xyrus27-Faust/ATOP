import { useState } from 'react';

export default function MembershipPage() {
  const [formData, setFormData] = useState({
    lguName: '',
    officerName: '',
    email: '',
    phone: '',
    lguLevel: 'Municipality',
    designation: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate API request
    setSubmitted(true);
  };

  const handleReset = () => {
    setFormData({
      lguName: '',
      officerName: '',
      email: '',
      phone: '',
      lguLevel: 'Municipality',
      designation: '',
    });
    setSubmitted(false);
  };

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
        <div className="membership-layout-grid">
          {/* Info Side */}
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
              <h4>Membership Classification & Fees</h4>
              <ul>
                <li><strong>Regular Members:</strong> Tourism officers appointed/designated in LGUs. (₱2,000 Annual Fee)</li>
                <li><strong>Institutional Members:</strong> Academic partners and tourism organizations. (₱5,000 Annual Fee)</li>
                <li><strong>Associate Members:</strong> Tourism office staff and advocates. (₱1,000 Annual Fee)</li>
              </ul>
            </div>
          </div>

          {/* Form Side */}
          <div className="membership-form-side">
            <div className="form-wrapper-card">
              {submitted ? (
                <div className="form-success-state text-center">
                  <div className="success-icon"><i className="fas fa-check-circle"></i></div>
                  <h3>Registration Submitted!</h3>
                  <p>
                    Thank you for applying. A confirmation email has been sent to <strong>{formData.email}</strong>. 
                    Our membership committee will review your LGU details shortly.
                  </p>
                  <button className="btn-gold" onClick={handleReset}>Register Another LGU</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="membership-register-form">
                  <h3>LGU Registration Portal</h3>
                  <p className="form-subtitle">Complete the fields below to initiate LGU enrollment.</p>

                  <div className="form-group">
                    <label htmlFor="lguName">LGU Name (Province/City/Municipality)</label>
                    <input 
                      type="text" 
                      id="lguName" 
                      required 
                      placeholder="e.g. Municipality of El Nido"
                      value={formData.lguName}
                      onChange={(e) => setFormData({ ...formData, lguName: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="lguLevel">LGU Category</label>
                      <select 
                        id="lguLevel" 
                        value={formData.lguLevel}
                        onChange={(e) => setFormData({ ...formData, lguLevel: e.target.value })}
                      >
                        <option value="Province">Province</option>
                        <option value="Highly Urbanized City">Highly Urbanized City (HUC)</option>
                        <option value="Component City">Component City</option>
                        <option value="Municipality">Municipality</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="officerName">Tourism Officer Name</label>
                      <input 
                        type="text" 
                        id="officerName" 
                        required 
                        placeholder="Juan Dela Cruz"
                        value={formData.officerName}
                        onChange={(e) => setFormData({ ...formData, officerName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="designation">Official Position / Designation</label>
                    <input 
                      type="text" 
                      id="designation" 
                      required 
                      placeholder="e.g. Senior Tourism Operations Officer"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="email">Official Email Address</label>
                      <input 
                        type="email" 
                        id="email" 
                        required 
                        placeholder="tourism@lgu.gov.ph"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Contact Number</label>
                      <input 
                        type="tel" 
                        id="phone" 
                        required 
                        placeholder="0912 345 6789"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-gold w-full justify-center">
                    Submit Membership Application
                  </button>
                </form>
              )}
            </div>
          </div>
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

        .intro-paragraph {
          font-size: 1.05rem;
          line-height: 1.7;
          color: var(--text-body);
          margin-bottom: 32px;
        }

        /* Layout */
        .membership-layout-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 64px;
          align-items: flex-start;
        }

        .benefits-vgrid {
          display: flex;
          flex-direction: column;
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

        .b-icon {
          font-size: 1.5rem;
          color: var(--gold);
          min-width: 32px;
        }

        .benefit-vcard h4 {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 6px;
        }

        .benefit-vcard p {
          font-size: 0.82rem;
          color: var(--gray-600);
          line-height: 1.6;
        }

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

        .membership-fees-box ul {
          list-style: none;
          padding: 0;
        }

        .membership-fees-box ul li {
          font-size: 0.85rem;
          line-height: 1.7;
          margin-bottom: 12px;
          color: rgba(255,255,255,0.85);
        }

        .membership-fees-box ul li:last-child {
          margin-bottom: 0;
        }

        /* Form Card */
        .form-wrapper-card {
          background: var(--white);
          padding: 40px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--gray-200);
        }

        .membership-register-form h3 {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 6px;
        }

        .form-subtitle {
          font-size: 0.82rem;
          color: var(--gray-600);
          margin-bottom: 28px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
          flex-grow: 1;
        }

        .form-row {
          display: flex;
          gap: 20px;
        }

        .form-group label {
          font-family: var(--font-heading);
          font-size: 0.76rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--navy);
        }

        .form-group input, 
        .form-group select {
          padding: 12px 16px;
          font-size: 0.9rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--gray-200);
          outline: none;
          transition: var(--transition-fast);
          background: var(--off-white);
        }

        .form-group input:focus, 
        .form-group select:focus {
          border-color: var(--gold);
          background: var(--white);
          box-shadow: 0 0 0 3px rgba(200, 168, 75, 0.15);
        }

        .w-full {
          width: 100%;
        }

        .justify-center {
          justify-content: center;
        }

        /* Success state */
        .form-success-state {
          padding: 24px 0;
        }

        .success-icon {
          font-size: 3.5rem;
          color: #22C55E;
          margin-bottom: 20px;
        }

        .form-success-state h3 {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 12px;
        }

        .form-success-state p {
          font-size: 0.95rem;
          color: var(--gray-600);
          line-height: 1.7;
          margin-bottom: 32px;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        @media (max-width: 1024px) {
          .membership-layout-grid {
            grid-template-columns: 1fr;
            gap: 48px;
          }
        }

        @media (max-width: 576px) {
          .form-row {
            flex-direction: column;
            gap: 0;
          }
          .form-wrapper-card {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}

import { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleReset = () => {
    setFormData({ name: '', email: '', subject: '', message: '' });
    setSubmitted(false);
  };

  return (
    <div className="subpage-container animate-fade-in">
      <div className="subpage-banner">
        <div className="container">
          <h2>Contact Us</h2>
          <p>Get in touch with the ATOP National Secretariat and regional coordinators</p>
        </div>
      </div>

      <div className="container subpage-body">
        <div className="contact-layout-grid">
          {/* Info Cards Column */}
          <div className="contact-details-col">
            <h3 className="subpage-section-title">Secretariat Directory</h3>
            <p className="intro-paragraph">
              For membership inquiries, convention fees payments, or submissions validation, contact our secretariat.
            </p>

            <div className="contact-cards-vgrid">
              <div className="contact-info-card">
                <div className="c-icon"><i className="fas fa-map-marked-alt"></i></div>
                <div>
                  <h4>National Headquarters</h4>
                  <p>Unit 402, Tourism Governance Center, Intramuros, Manila, 1002 Philippines</p>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="c-icon"><i className="fas fa-envelope"></i></div>
                <div>
                  <h4>Email Addresses</h4>
                  <p>
                    General Inquiry: <strong>info@atop.org.ph</strong><br />
                    Pearl Awards: <strong>pearlawards@atop.org.ph</strong>
                  </p>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="c-icon"><i className="fas fa-phone-alt"></i></div>
                <div>
                  <h4>Telephone &amp; Mobile</h4>
                  <p>
                    Hotline: <strong>+63 (2) 8527-1234</strong><br />
                    Secretariat Mobile: <strong>+63 917 555 ATOP</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Mock Map */}
            <div className="mock-map-box">
              <div className="map-placeholder-inner">
                <i className="fas fa-map-pin map-pin-pulse"></i>
                <div className="map-labels">
                  <strong>ATOP Secretariat Office</strong>
                  <span>Intramuros, Manila</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="contact-form-col">
            <div className="form-wrapper-card">
              {submitted ? (
                <div className="form-success-state text-center">
                  <div className="success-icon"><i className="fas fa-paper-plane"></i></div>
                  <h3>Message Dispatched!</h3>
                  <p>
                    Thank you for reaching out. A representative from the ATOP National Secretariat 
                    will respond to your message at <strong>{formData.email}</strong> within 24-48 business hours.
                  </p>
                  <button className="btn-gold" onClick={handleReset}>Send Another Message</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-inquiry-form">
                  <h3>Submit an Inquiry</h3>
                  <p className="form-subtitle">Fill in the parameters below to contact our team directly.</p>

                  <div className="form-group">
                    <label htmlFor="contact-name">Full Name</label>
                    <input 
                      type="text" 
                      id="contact-name" 
                      required 
                      placeholder="Juan Dela Cruz"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-email">Email Address</label>
                    <input 
                      type="email" 
                      id="contact-email" 
                      required 
                      placeholder="juan.delacruz@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-subject">Subject</label>
                    <input 
                      type="text" 
                      id="contact-subject" 
                      required 
                      placeholder="e.g. 2026 Pearl Awards Extension Inquiry"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-message">Message Details</label>
                    <textarea 
                      id="contact-message" 
                      required 
                      rows="5"
                      placeholder="Write your message here..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn-gold w-full justify-center">
                    Submit Message Inquiry
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
          font-size: 1.02rem;
          line-height: 1.7;
          color: var(--text-body);
          margin-bottom: 32px;
        }

        /* Layout */
        .contact-layout-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: flex-start;
        }

        .contact-cards-vgrid {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 36px;
        }

        .contact-info-card {
          display: flex;
          gap: 20px;
          background: var(--white);
          padding: 24px;
          border-radius: var(--radius-md);
          border: 1px solid var(--gray-200);
        }

        .c-icon {
          font-size: 1.5rem;
          color: var(--gold);
          min-width: 36px;
          display: flex;
          justify-content: center;
        }

        .contact-info-card h4 {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 6px;
        }

        .contact-info-card p {
          font-size: 0.86rem;
          color: var(--gray-600);
          line-height: 1.6;
        }

        /* Map Box */
        .mock-map-box {
          background: linear-gradient(135deg, var(--navy-light) 0%, var(--navy) 100%);
          height: 220px;
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
        }

        .mock-map-box::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0.15;
          background-image: radial-gradient(var(--gold-light) 1px, transparent 0);
          background-size: 20px 20px;
        }

        .map-placeholder-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--white);
          gap: 16px;
          z-index: 1;
          position: relative;
        }

        .map-pin-pulse {
          font-size: 2.2rem;
          color: var(--gold-light);
          animation: pinBounce 2s ease-in-out infinite alternate;
        }

        @keyframes pinBounce {
          from { transform: translateY(0); }
          to { transform: translateY(-8px); }
        }

        .map-labels {
          text-align: center;
        }

        .map-labels strong {
          display: block;
          font-family: var(--font-heading);
          font-size: 0.95rem;
          color: var(--white);
        }

        .map-labels span {
          font-size: 0.74rem;
          color: var(--gold-light);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* Form */
        .form-wrapper-card {
          background: var(--white);
          padding: 40px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--gray-200);
        }

        .contact-inquiry-form h3 {
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
        .form-group textarea {
          padding: 12px 16px;
          font-size: 0.9rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--gray-200);
          outline: none;
          transition: var(--transition-fast);
          background: var(--off-white);
          font-family: var(--font-body);
        }

        .form-group input:focus, 
        .form-group textarea:focus {
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
          padding: 32px 0;
        }

        .success-icon {
          font-size: 3.5rem;
          color: var(--gold);
          margin-bottom: 24px;
          animation: floatUp 3s ease-in-out infinite;
        }

        @keyframes floatUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
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

        @media (max-width: 992px) {
          .contact-layout-grid {
            grid-template-columns: 1fr;
            gap: 48px;
          }
        }

        @media (max-width: 576px) {
          .form-wrapper-card {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}

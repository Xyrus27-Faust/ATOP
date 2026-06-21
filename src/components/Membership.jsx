const benefits = [
  {
    id: 'benefit-network',
    icon: 'fas fa-network-wired',
    title: 'Expand Your Network',
    desc: 'Connect with tourism officers nationwide.',
  },
  {
    id: 'benefit-resources',
    icon: 'fas fa-folder-open',
    title: 'Access Resources',
    desc: 'Get updates, tools and best practices.',
  },
  {
    id: 'benefit-grow',
    icon: 'fas fa-chart-line',
    title: 'Grow Professionally',
    desc: 'Join trainings, seminars and learning sessions.',
  },
];

export default function Membership({ setCurrentPage }) {
  return (
    <section className="membership" id="membership-section">
      <div className="container">
        <div className="membership-inner">
          {/* Headline */}
          <div className="membership-headline">
            <div className="pillar-icon" style={{ color: 'var(--gold)', fontSize: '2.5rem', marginBottom: '16px' }}>
              <i className="fas fa-id-card"></i>
            </div>
            <h2>Membership</h2>
            <p>
              Be part of the country's largest network of tourism professionals
              and help shape the future of tourism in the Philippines.
            </p>
            <button 
              className="btn-gold" 
              id="membership-join-btn"
              onClick={() => {
                setCurrentPage('membership');
                window.scrollTo(0, 0);
              }}
            >
              Join ATOP
            </button>
          </div>

          {/* Benefits */}
          <div className="membership-benefits">
            {benefits.map((b) => (
              <div className="benefit-item" key={b.id} id={b.id}>
                <div className="benefit-icon">
                  <i className={b.icon}></i>
                </div>
                <h4>{b.title}</h4>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

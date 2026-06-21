const newsItems = [
  {
    id: 'news-convention',
    img: '/news_convention.png',
    month: 'MAY',
    day: '20',
    title: 'ATOP National Convention 2025',
    desc: 'Join us in our annual gathering of tourism leaders and partners.',
    alt: 'ATOP National Convention 2025 – annual gathering of tourism leaders',
  },
  {
    id: 'news-training',
    img: '/news_training.png',
    month: 'APR',
    day: '15',
    title: 'Training on Sustainable Tourism',
    desc: 'A capacity building program for local tourism officers.',
    alt: 'Training seminar on Sustainable Tourism for local officers',
  },
  {
    id: 'news-travel-mart',
    img: '/news_travel_mart.png',
    month: 'MAR',
    day: '28',
    title: 'ATOP Joins Philippine Travel Mart',
    desc: 'ATOP participates in the country\'s premier travel trade event.',
    alt: 'ATOP booth at the Philippine Travel Mart trade show',
  },
  {
    id: 'news-members',
    img: '/news_members.png',
    month: 'FEB',
    day: '10',
    title: 'New ATOP Members',
    desc: 'Welcome to our new member LGUs and partners!',
    alt: 'Welcome ceremony for new ATOP member LGUs',
  },
];

export default function NewsEvents({ setCurrentPage }) {
  return (
    <section className="news" id="news-section">
      <div className="container">
        <div className="news-header">
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            News &amp; Events
          </h2>
          <a 
            href="#" 
            className="view-all-link" 
            id="view-all-news-link"
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage('news');
              window.scrollTo(0, 0);
            }}
          >
            View All News <i className="fas fa-chevron-right"></i>
          </a>
        </div>

        <div className="news-grid">
          {newsItems.map((item) => (
            <article className="news-card" key={item.id} id={item.id}>
              <div className="news-card-img">
                <img src={item.img} alt={item.alt} />
                <div className="news-date-badge">
                  <span className="month">{item.month}</span>
                  <span className="day">{item.day}</span>
                </div>
              </div>
              <div className="news-card-body">
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
                <a 
                  href="#" 
                  className="read-more" 
                  id={`${item.id}-read-more`}
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage('news');
                    window.scrollTo(0, 0);
                  }}
                >
                  Read More <i className="fas fa-chevron-right"></i>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

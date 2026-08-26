import { useState } from 'react';

export default function NewsPage() {
  const [selectedArticle, setSelectedArticle] = useState(null);

  const newsItems = [
    {
      id: 'news-convention',
      img: '/news_convention.png',
      month: 'MAY',
      day: '20',
      year: '2026',
      title: 'ATOP National Convention 2026 Scheduled',
      desc: 'ATOP officers announce details for the upcoming national assembly gather in Visayas, featuring key policy summits and the Pearl Awards night.',
      fullContent: `The Association of Tourism Officers of the Philippines (ATOP) has officially announced the dates and venue for the ATOP National Convention 2026. This year's gathering will serve as a critical focal point for local tourism governance, policy discussion, and digital marketing integrations.

Over 1,200 participants, including city, municipal, and provincial tourism officers, governors, and mayors, are expected to assemble. Workshops will cover topics like AI-driven destination management, environmental carry-capacity frameworks, and community preservation models.

The highlight of the convention will be the Pearl Awards Gala Night, honoring outstanding LGU achievements during the preceding year.`,
      alt: 'ATOP National Convention 2026',
    },
    {
      id: 'news-training',
      img: '/news_training.png',
      month: 'APR',
      day: '15',
      year: '2026',
      title: 'Regional Capacity Training on Sustainable Destination Planning',
      desc: 'A capacity building program for local tourism officers, equipping them with tools for eco-sustainable community tourism and database metrics.',
      fullContent: `ATOP, in collaboration with the Department of Tourism, completed its regional capacity building seminar on Sustainable Destination Planning. Held over three days, the program drew participation from 85 LGU representatives.

The training modules centered on establishing standardized database collection methods to track tourism arrivals, economic impact, and ecological footprint. Key sessions led by environmental planning experts highlighted practical approaches to community-based eco-tours and municipal carrying capacity limits.

Participants left with completed drafts of local tourism management frameworks, which they will work to ratify in their respective councils.`,
      alt: 'Sustainable destination training',
    },
    {
      id: 'news-travel-mart',
      img: '/news_travel_mart.png',
      month: 'MAR',
      day: '28',
      year: '2026',
      title: 'ATOP Showcases Regional Partners at the Philippine Travel Mart',
      desc: 'ATOP participates in the country\'s premier travel trade event, promoting local governments and community heritage products.',
      fullContent: `ATOP successfully concluded its representation at the 2026 Philippine Travel Mart. The ATOP Pavilion featured cultural showcases and native artisanal products from 24 municipalities, opening direct business links with national tour operators.

"This is about supporting community-based products that often don't have the marketing budget for major trade shows," said the ATOP President. By coordinating LGU initiatives, the pavilion established a platform highlighting cultural tours, heritage cuisine, and natural attractions.

The pavilion received multiple design accolades and generated significant booking interest for rural travel corridors.`,
      alt: 'Philippine Travel Mart ATOP booth',
    },
    {
      id: 'news-members',
      img: '/news_members.png',
      month: 'FEB',
      day: '10',
      year: '2026',
      title: 'ATOP Inducts 15 New Municipal and City Tourism Units',
      desc: 'Welcome to our new member LGUs and partners as we build stronger local tourism governance structures.',
      fullContent: `In an official ceremony, the ATOP board inducted 15 new member municipalities and cities into the national association. The induction reinforces the nationwide commitment to coordinate local tourism guidelines and standards.

The new member offices represent LGUs that have recently created dedicated, permanent tourism positions within their organizational charts. Membership will grant these new offices access to ATOP's training catalogs and technical toolkits.

"We look forward to collaborating with our new partners and helping them build resilient, high-standard travel programs," the Secretary remarked.`,
      alt: 'LGU induction ceremony',
    },
  ];

  return (
    <div className="subpage-container animate-fade-in">
      <div className="subpage-banner">
        <div className="container">
          <h2>News &amp; Events</h2>
          <p>Stay updated with the latest announcements, projects, and activities from ATOP</p>
        </div>
      </div>

      <div className="container subpage-body">
        {selectedArticle ? (
          /* Article Detail View */
          <article className="article-detail-view animate-fade-in">
            <button className="back-btn" onClick={() => setSelectedArticle(null)}>
              <i className="fas fa-arrow-left"></i> Back to News Grid
            </button>
            
            <div className="detail-meta">
              <span className="detail-date-badge">
                {selectedArticle.month} {selectedArticle.day}, {selectedArticle.year}
              </span>
            </div>

            <h1 className="detail-title">{selectedArticle.title}</h1>
            
            <div className="detail-img-wrapper">
              <img src={selectedArticle.img} alt={selectedArticle.alt} />
            </div>

            <div className="detail-body-text">
              {selectedArticle.fullContent.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </article>
        ) : (
          /* Grid View */
          <div className="news-main-grid">
            {newsItems.map((item) => (
              <article 
                className="news-page-card" 
                key={item.id} 
                onClick={() => setSelectedArticle(item)}
              >
                <div className="news-card-img-wrapper">
                  <img src={item.img} alt={item.alt} />
                  <div className="news-page-date-badge">
                    <span className="month">{item.month}</span>
                    <span className="day">{item.day}</span>
                  </div>
                </div>
                <div className="news-card-info">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                  <span className="read-more-link">
                    Read Full Story <i className="fas fa-chevron-right"></i>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
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

        /* Grid View styling */
        .news-main-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px;
        }

        .news-page-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid var(--gray-200);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          flex-direction: column;
        }

        .news-page-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--shadow-md);
          border-color: rgba(200, 168, 75, 0.25);
        }

        .news-card-img-wrapper {
          position: relative;
          height: 240px;
          overflow: hidden;
        }

        .news-card-img-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: var(--transition);
        }

        .news-page-card:hover .news-card-img-wrapper img {
          transform: scale(1.05);
        }

        .news-page-date-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          background: rgba(15, 25, 46, 0.85);
          backdrop-filter: blur(8px);
          color: var(--white);
          font-family: var(--font-heading);
          font-weight: 800;
          text-align: center;
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
        }

        .news-page-date-badge .month {
          display: block;
          font-size: 0.6rem;
          color: var(--gold-light);
          text-transform: uppercase;
        }

        .news-page-date-badge .day {
          display: block;
          font-size: 1.3rem;
        }

        .news-card-info {
          padding: 32px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .news-card-info h4 {
          font-family: var(--font-heading);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 12px;
          line-height: 1.4;
        }

        .news-card-info p {
          font-size: 0.88rem;
          color: var(--gray-600);
          line-height: 1.7;
          margin-bottom: 24px;
          flex-grow: 1;
        }

        .read-more-link {
          font-family: var(--font-heading);
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--gold-dark);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: var(--transition-fast);
        }

        .news-page-card:hover .read-more-link {
          color: var(--gold);
        }

        /* Detail View styling */
        .article-detail-view {
          background: var(--white);
          padding: 56px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--gray-200);
          box-shadow: var(--shadow-sm);
          max-width: 800px;
          margin: 0 auto;
        }

        .back-btn {
          background: transparent;
          border: none;
          color: var(--gray-600);
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
          transition: var(--transition-fast);
        }

        .back-btn:hover {
          color: var(--gold-dark);
          transform: translateX(-4px);
        }

        .detail-meta {
          margin-bottom: 16px;
        }

        .detail-date-badge {
          font-family: var(--font-heading);
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--gold-dark);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .detail-title {
          font-family: var(--font-heading);
          font-size: clamp(1.8rem, 4vw, 2.2rem);
          font-weight: 800;
          color: var(--navy);
          line-height: 1.25;
          margin-bottom: 32px;
        }

        .detail-img-wrapper {
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          margin-bottom: 40px;
          height: 380px;
        }

        .detail-img-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .detail-body-text p {
          font-size: 1.05rem;
          color: var(--text-body);
          line-height: 1.8;
          margin-bottom: 24px;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        @media (max-width: 768px) {
          .news-main-grid {
            grid-template-columns: 1fr;
          }
          .article-detail-view {
            padding: 24px;
          }
          .detail-img-wrapper {
            height: 240px;
          }
        }
      `}</style>
    </div>
  );
}

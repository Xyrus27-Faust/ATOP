export default function About({ setCurrentPage }) {
  return (
    <section className="about" id="about-section">
      <div className="container">
        <div className="about-inner">
          {/* Text */}
          <div className="about-text">
            <h2 className="section-title">About ATOP</h2>
            <p>
              The Association of Tourism Officers of the Philippines, Inc. (ATOP) is
              a non-stock, non-profit organization of local government tourism
              officers from cities, municipalities, provinces and other tourism
              stakeholders.
            </p>
            <p>
              ATOP aims to promote unity, professional development, and
              cooperation among tourism officers to enhance the Philippine
              tourism industry.
            </p>
            <a 
              href="#" 
              className="btn-gold" 
              id="about-learn-more-btn"
              onClick={(e) => {
                e.preventDefault();
                setCurrentPage('about');
                window.scrollTo(0, 0);
              }}
            >
              Learn More <i className="fas fa-chevron-right"></i>
            </a>
          </div>

          {/* Image Grid */}
          <div className="about-images">
            <div className="about-img" id="about-img-terraces">
              <img
                src="/about_rice_terraces.png"
                alt="Banaue Rice Terraces – a UNESCO World Heritage Site in the Philippines"
              />
            </div>
            <div className="about-img" id="about-img-church">
              <img
                src="/about_church.png"
                alt="Historic colonial church in the Philippines"
              />
            </div>
            <div className="about-img" id="about-img-beach">
              <img
                src="/about_sunset_beach.png"
                alt="Beautiful tropical sunset beach in the Philippines"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const pillars = [
  {
    id: 'national-network',
    icon: 'fas fa-users',
    title: 'National Network',
    desc: 'Connecting tourism officers across the Philippines.',
  },
  {
    id: 'capacity-building',
    icon: 'fas fa-book-open',
    title: 'Capacity Building',
    desc: 'Training, workshops and seminars for continuous development.',
  },
  {
    id: 'partnerships',
    icon: 'fas fa-handshake',
    title: 'Partnerships',
    desc: 'Building strong partnerships for tourism growth.',
  },
  {
    id: 'sustainable-tourism',
    icon: 'fas fa-globe-asia',
    title: 'Sustainable Tourism',
    desc: 'Promoting responsible and sustainable tourism practices.',
  },
];

export default function Pillars() {
  return (
    <section className="pillars" id="pillars-section">
      <div className="container">
        <div className="pillars-inner">
          {pillars.map((p) => (
            <div className="pillar-card" key={p.id} id={`pillar-${p.id}`}>
              <div className="pillar-icon">
                <i className={p.icon}></i>
              </div>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

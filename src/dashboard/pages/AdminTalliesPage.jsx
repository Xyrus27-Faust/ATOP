import { Fragment } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { canManageRegistrations } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { downloadCsv, datedFilename } from '@/lib/csv'

/**
 * The two counts the secretariat has to hand someone outside the building: how many shirts to cut,
 * and how full the tours are.
 *
 * <p>Both were previously answerable only by querying the production database, which meant nobody
 * without a shell could answer them at all. They are on one page because they are read together —
 * the same person, on the same morning, deciding what to tell a supplier.</p>
 *
 * <p>The page is deliberately blunt about what it does not know. A shirt size is only asked of a
 * delegate whose seat is secured, so the headline is a fraction, not a total: chasing the 320 people
 * who have been asked and not answered is real work, while the delegates still sitting in draft
 * bookings are a forecast nobody can act on yet. Reporting those two as one number would invent a
 * backlog.</p>
 */
export default function AdminTalliesPage() {
  const { user } = useAuth()

  const { loading, error, data, reload } = useAsync(async () => {
    const events = await api.get('/events/')
    const event = events[0]
    if (!event) return { event: null, tallies: null }
    const tallies = await api.get(`/admin/events/${event.id}/tallies`, { auth: true })
    return { event, tallies }
  }, [])

  if (!canManageRegistrations(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, tallies } = data
  if (!event || !tallies) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-chart-simple" aria-hidden="true" /></div>
        <h3>No published convention</h3>
        <p>Publish an event before there is anything to tally.</p>
      </div>
    )
  }

  const { shirts, tours } = tallies

  function exportShirts() {
    downloadCsv(datedFilename('atop-shirt-sizes'), [
      ['Size', 'Delegates'],
      ...shirts.sizes.map((s) => [s.size, s.delegates]),
      ['Not yet chosen', shirts.notSet],
      ['Total asked', shirts.eligible],
      ['Not yet asked (seat unsettled)', shirts.notYetEligible],
    ])
  }

  function exportTours() {
    downloadCsv(datedFilename('atop-tour-fill'), [
      ['Tour', 'Batch', 'Session', 'Capacity', 'Booked', 'Seats left'],
      ...tours.packages.flatMap((p) =>
        p.batches.map((b) => [p.name, b.label, b.session, b.capacity, b.reserved, b.seatsLeft]),
      ),
      ['All tours', '', '', tours.capacity, tours.reserved, tours.seatsLeft],
    ])
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{event.name}</span>
          <h1 className="dash-h1">Tallies</h1>
          <p className="dash-sub">
            What the convention owes its suppliers: the shirt order and the tour manifest.
          </p>
        </div>
        <button className="dash-btn is-ghost" onClick={reload}>
          <i className="fas fa-rotate-right" aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="dash-grid tal-stats">
        <Stat icon="fa-shirt" label="Shirt sizes in" value={`${shirts.chosen} / ${shirts.eligible}`} />
        <Stat icon="fa-hourglass-half" label="Still to answer" value={shirts.notSet} />
        <Stat icon="fa-van-shuttle" label="Tour seats claimed" value={`${tours.reserved} / ${tours.capacity}`} />
        <Stat icon="fa-chair" label="Tour seats left" value={tours.seatsLeft} />
      </div>

      {/* ---------- Shirts ---------- */}
      <section className="dash-card dash-card-pad tal-section">
        <header className="tal-head">
          <div>
            <h2 className="tal-h2">Convention kit shirts</h2>
            <p className="tal-note">
              Counted across delegates attending in person on a secured seat — the same people the
              app asks for a size.
            </p>
          </div>
          <button className="dash-btn is-ghost" onClick={exportShirts} disabled={!shirts.chosen}>
            <i className="fas fa-download" aria-hidden="true" /> CSV
          </button>
        </header>

        {shirts.chosen === 0 ? (
          <p className="tal-empty">Nobody has chosen a size yet.</p>
        ) : (
          <table className="tal-table">
            <thead>
              <tr>
                <th>Size</th>
                <th className="tal-num">Delegates</th>
                <th className="tal-bar-col">Share of sizes chosen</th>
              </tr>
            </thead>
            <tbody>
              {shirts.sizes.map((s) => (
                <tr key={s.size}>
                  <td className="tal-size">{s.size}</td>
                  <td className="tal-num">{s.delegates}</td>
                  <td>
                    <Bar value={s.delegates} of={shirts.chosen} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Chosen</td>
                <td className="tal-num">{shirts.chosen}</td>
                <td className="tal-foot-note">of {shirts.eligible} asked</td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* The two "missing" numbers mean different things and cost different work. Kept apart so
            nobody orders against the sum of them. */}
        <div className="tal-gaps">
          <div className="tal-gap">
            <span className="tal-gap-value">{shirts.notSet}</span>
            <span className="tal-gap-label">asked, not answered</span>
            <p>On a secured seat and able to choose today. This is the list to chase.</p>
          </div>
          <div className="tal-gap">
            <span className="tal-gap-value">{shirts.notYetEligible}</span>
            <span className="tal-gap-label">not yet asked</span>
            <p>
              Attending in person but the seat is not settled, so the app has not offered them a
              size. A forecast, not a backlog.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Tours ---------- */}
      <section className="dash-card dash-card-pad tal-section">
        <header className="tal-head">
          <div>
            <h2 className="tal-h2">Tour fill</h2>
            <p className="tal-note">
              Seats claimed per departure. Totals are summed from the open batches, so opening or
              closing one moves the cap with it.
            </p>
          </div>
          <button className="dash-btn is-ghost" onClick={exportTours} disabled={!tours.packages.length}>
            <i className="fas fa-download" aria-hidden="true" /> CSV
          </button>
        </header>

        {tours.packages.length === 0 ? (
          <p className="tal-empty">No tours are published for this event.</p>
        ) : (
          <table className="tal-table">
            <thead>
              <tr>
                <th>Tour</th>
                <th className="tal-num">Booked</th>
                <th className="tal-num">Capacity</th>
                <th className="tal-num">Left</th>
                <th className="tal-bar-col">Fill</th>
              </tr>
            </thead>
            <tbody>
              {tours.packages.map((p) => (
                <Fragment key={p.id}>
                  <tr className="tal-pkg">
                    <td>{p.name}</td>
                    <td className="tal-num">{p.reserved}</td>
                    <td className="tal-num">{p.capacity}</td>
                    <td className="tal-num">{p.seatsLeft}</td>
                    <td><Bar value={p.reserved} of={p.capacity} full={p.seatsLeft === 0} /></td>
                  </tr>
                  {p.batches.map((b) => (
                    <tr key={b.id} className="tal-batch">
                      <td>{b.label}</td>
                      <td className="tal-num">{b.reserved}</td>
                      <td className="tal-num">{b.capacity}</td>
                      <td className="tal-num">{b.seatsLeft}</td>
                      <td><Bar value={b.reserved} of={b.capacity} full={b.isFull} /></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>All tours</td>
                <td className="tal-num">{tours.reserved}</td>
                <td className="tal-num">{tours.capacity}</td>
                <td className="tal-num">{tours.seatsLeft}</td>
                <td><Bar value={tours.reserved} of={tours.capacity} /></td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <p className="tal-asof">
        As of {new Date(tallies.generatedAt).toLocaleString()}.
      </p>

      <style>{`
        .tal-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .tal-section { margin-top: 1.25rem; overflow-x: auto; }
        .tal-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
        .tal-h2 { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; color: var(--navy); margin: 0; }
        .tal-note { font-size: 0.82rem; color: var(--gray-500); margin: 4px 0 0; max-width: 62ch; line-height: 1.5; }
        .tal-empty { color: var(--gray-500); font-size: 0.9rem; margin: 0; }

        .tal-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .tal-table th { text-align: left; font-family: var(--font-body); font-size: 0.72rem;
                        letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-500);
                        padding: 0 12px 10px 0; border-bottom: 1px solid var(--gray-200); white-space: nowrap; }
        .tal-table td { padding: 10px 12px 10px 0; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
        .tal-table tfoot td { border-bottom: none; border-top: 2px solid var(--gray-200);
                              font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
        .tal-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .tal-bar-col { width: 40%; min-width: 140px; }
        .tal-size { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
        .tal-foot-note { font-family: var(--font-body); font-weight: 400; color: var(--gray-500); font-size: 0.82rem; }

        /* A package is the row people scan; its batches are the detail under it. Indent and lighten
           rather than nest a table — the columns have to line up to be compared at all. */
        .tal-pkg td { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
        .tal-batch td { color: var(--gray-500); font-size: 0.84rem; border-bottom-color: var(--gray-100); }
        .tal-batch td:first-child { padding-left: 18px; }

        .tal-bar { position: relative; height: 8px; border-radius: 999px; background: var(--gray-100); overflow: hidden; }
        .tal-bar span { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--gold); }
        .tal-bar.is-full span { background: #B91C1C; }

        .tal-gaps { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-top: 1.25rem; }
        .tal-gap { padding: 14px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); background: var(--off-white); }
        .tal-gap-value { display: block; font-family: var(--font-heading); font-size: 1.6rem; font-weight: 700; color: var(--navy); line-height: 1.1; }
        .tal-gap-label { display: block; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-500); margin-top: 2px; }
        .tal-gap p { font-size: 0.82rem; color: var(--gray-500); margin: 8px 0 0; line-height: 1.5; }

        .tal-asof { font-size: 0.78rem; color: var(--gray-400); margin-top: 1rem; }
      `}</style>
    </>
  )
}

function Bar({ value, of, full = false }) {
  const pct = of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0
  return (
    <div
      className={`tal-bar${full ? ' is-full' : ''}`}
      role="img"
      aria-label={`${value} of ${of} — ${pct}%`}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="dash-card dash-stat">
      <div className="dash-stat-icon"><i className={`fas ${icon}`} aria-hidden="true" /></div>
      <div>
        <div className="dash-stat-value">{value}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </div>
  )
}

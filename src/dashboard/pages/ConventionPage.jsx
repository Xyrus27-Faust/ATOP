import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { formatDate } from '@/lib/pearlAwards'
import {
  formatPeso,
  modeMeta,
  registrationStatusMeta,
  registrationWindow,
} from '@/lib/events'

/**
 * The convention landing page: what's on, what it costs, and the bookings you've
 * already made. The two rates are shown side by side because choosing between
 * attending in person and online is the first real decision a delegate makes —
 * and it changes the price, the inclusions, and what we'll ask them for.
 */
export default function ConventionPage() {
  const navigate = useNavigate()

  const { loading, error, data, reload } = useAsync(async () => {
    const [events, registrations] = await Promise.all([
      api.get('/events/'),
      api.get('/registrations/', { auth: true }),
    ])
    return { events, registrations }
  }, [])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { events, registrations } = data
  // The API returns published events newest-first; the soonest upcoming one is
  // the convention people mean when they say "the convention".
  const event = events[0]

  if (!event) {
    return (
      <>
        <div className="dash-page-head">
          <div>
            <span className="dash-eyebrow">ATOP</span>
            <h1 className="dash-h1">Convention</h1>
          </div>
        </div>
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-calendar-days" aria-hidden="true" /></div>
          <h3>No convention is open yet</h3>
          <p>When the ATOP Secretariat publishes the next National Convention, it will appear here with its rates and registration form.</p>
        </div>
      </>
    )
  }

  const window = registrationWindow(event)
  const mine = registrations.filter((r) => r.status !== 'Cancelled')

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">ATOP {event.editionYear}</span>
          <h1 className="dash-h1">{event.name}</h1>
          <p className="dash-sub">
            {formatDate(event.startsAt)} – {formatDate(event.endsAt)} · {event.venueName}
          </p>
          <SeatsLeft remaining={event.seatsRemaining} />
        </div>
        {window.open && (
          <button className="dash-btn is-primary" onClick={() => navigate('/convention/register')}>
            <i className="fas fa-user-plus" aria-hidden="true" /> Register delegates
          </button>
        )}
      </div>

      {event.seatsRemaining === 0 && (
        <div className="dash-banner cv-banner-closed">
          <i className="fas fa-circle-info" aria-hidden="true" />
          <span>Every seat for the convention has been taken. No further registrations can be confirmed.</span>
        </div>
      )}

      {!window.open && (
        <div className="dash-banner cv-banner-closed">
          <i className="fas fa-circle-info" aria-hidden="true" />
          <span>{window.message}</span>
        </div>
      )}
      {window.open && window.message && (
        <div className="dash-banner cv-banner-soon">
          <i className="fas fa-clock" aria-hidden="true" />
          <span>{window.message}</span>
        </div>
      )}

      {/* Rates. Fee-inclusive — what's printed is what's charged. */}
      <div className="cv-rates">
        {event.rates.map((rate) => {
          const meta = modeMeta(rate.attendanceMode)
          return (
            <div key={rate.id} className={`dash-card cv-rate mode-${rate.attendanceMode.toLowerCase()}`}>
              <div className="cv-rate-head">
                <span className={`dash-badge tone-${meta.tone}`}>
                  <i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.label}
                </span>
              </div>
              <div className="cv-rate-amount">{formatPeso(rate.amount)}</div>
              <div className="cv-rate-label">{rate.label}</div>
              {rate.inclusionsText && <p className="cv-rate-incl">{rate.inclusionsText}</p>}
              <p className="cv-rate-note">Inclusive of all fees — this is the full amount payable.</p>
            </div>
          )
        })}
      </div>

      <div className="dash-card dash-card-pad cv-venue">
        <h2 className="dash-card-title">Venue &amp; contact</h2>
        <dl className="cv-dl">
          <div><dt>Venue</dt><dd>{event.venueName}</dd></div>
          <div><dt>Address</dt><dd>{event.venueAddress}</dd></div>
          <div>
            <dt>Registration</dt>
            <dd>{formatDate(event.registrationOpensAt)} – {formatDate(event.registrationClosesAt)}</dd>
          </div>
          {event.contactEmail && (
            <div>
              <dt>Contact</dt>
              <dd><a className="dash-inline-link" href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a></dd>
            </div>
          )}
        </dl>
        {event.refundPolicyText && <p className="cv-policy">{event.refundPolicyText}</p>}
      </div>

      <h2 className="cv-h2">Your registrations</h2>

      {mine.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-ticket" aria-hidden="true" /></div>
          <h3>You haven’t registered anyone yet</h3>
          <p>
            One registration covers your whole delegation — you can mix delegates attending in person
            with those joining online, and pay for all of them at once.
          </p>
          {window.open && (
            <button className="dash-btn is-primary" onClick={() => navigate('/convention/register')}>
              <i className="fas fa-user-plus" aria-hidden="true" /> Register delegates
            </button>
          )}
        </div>
      ) : (
        <div className="cv-list">
          {mine.map((r) => {
            const meta = registrationStatusMeta(r.status)
            // A draft is unfinished business: send them back into the form, not to a booking page.
            return (
              <Link
                key={r.id}
                to={r.status === 'Draft' ? `/convention/register/${r.id}` : `/convention/registrations/${r.id}`}
                className="dash-card cv-row"
              >
                <span className="cv-row-main">
                  <span className="cv-row-ref">{r.referenceCode}</span>
                  <span className="cv-row-meta">
                    {r.lguName || r.organizationName || r.contactName}
                    {' · '}
                    {r.inPersonCount > 0 && `${r.inPersonCount} in person`}
                    {r.inPersonCount > 0 && r.virtualCount > 0 && ', '}
                    {r.virtualCount > 0 && `${r.virtualCount} online`}
                  </span>
                </span>
                <span className="cv-row-side">
                  <span className="cv-row-total">{formatPeso(r.totalAmount)}</span>
                  <span className={`dash-badge tone-${meta.tone}`}>
                    <i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.label}
                  </span>
                </span>
                <i className="fas fa-chevron-right cv-chev" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      )}

      <style>{`
        .cv-banner-closed, .cv-banner-soon {
          display: flex; align-items: center; gap: 10px; margin-bottom: 18px;
          padding: 12px 16px; border-radius: 10px; font-size: 0.88rem;
        }
        .cv-banner-closed { background: #F3F4F6; border: 1px solid var(--gray-200); color: var(--gray-600); }
        .cv-banner-soon { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }

        .cv-rates { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 20px; }
        /* Compound selectors on purpose: DashboardLayout injects DASH_CSS *after* the routed
           page, so a bare .cv-rate loses its accent border to .dash-card's border shorthand. */
        .dash-card.cv-rate { padding: 22px; border-top: 3px solid var(--gray-200); }
        .dash-card.cv-rate.mode-inperson { border-top-color: var(--gold); }
        .dash-card.cv-rate.mode-virtual { border-top-color: var(--navy); }
        .cv-rate-head { margin-bottom: 12px; }
        .cv-rate-amount { font-family: var(--font-heading); font-size: 2rem; font-weight: 800; color: var(--navy); line-height: 1.1; }
        .cv-rate-label { font-weight: 700; color: var(--gray-700, #374151); margin-top: 2px; }
        .cv-rate-incl { font-size: 0.85rem; color: var(--gray-600); margin: 10px 0 0; }
        .cv-rate-note { font-size: 0.76rem; color: var(--gray-500, #6B7280); margin: 10px 0 0; font-style: italic; }

        .cv-venue { margin-bottom: 26px; }
        .cv-dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 24px; margin: 0; }
        .cv-dl dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gray-500, #6B7280); font-weight: 700; }
        .cv-dl dd { margin: 3px 0 0; font-size: 0.9rem; color: var(--navy); }
        .cv-policy { margin: 16px 0 0; padding-top: 14px; border-top: 1px solid var(--gray-200); font-size: 0.82rem; color: var(--gray-600); }

        .cv-h2 { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 0 0 12px; }

        .cv-list { display: flex; flex-direction: column; gap: 10px; }
        .cv-row {
          display: flex; align-items: center; gap: 16px; padding: 16px 18px;
          text-decoration: none; color: inherit; transition: var(--transition-fast);
        }
        .cv-row:hover { border-color: var(--gold); transform: translateY(-1px); }
        .cv-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .cv-row-ref { font-family: var(--font-heading); font-weight: 800; color: var(--navy); letter-spacing: 0.02em; }
        .cv-row-meta { font-size: 0.82rem; color: var(--gray-600); }
        .cv-row-side { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
        .cv-row-total { font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
        .cv-chev { color: var(--gray-400, #9CA3AF); flex-shrink: 0; }

        @media (max-width: 640px) {
          .cv-row { flex-wrap: wrap; }
          .cv-row-side { width: 100%; justify-content: space-between; }
          .cv-chev { display: none; }
        }
      `}</style>
    </>
  )
}

/**
 * How many seats are left, when the event is capped.
 *
 * The number is the one the checkout gate enforces — confirmed seats plus seats held by a checkout
 * in flight — so the page never promises a seat that the next click refuses. An uncapped event
 * says nothing rather than implying room it has not actually counted.
 */
function SeatsLeft({ remaining }) {
  if (remaining === null || remaining === undefined) return null

  const tone = remaining === 0 ? 'is-gone' : remaining <= 50 ? 'is-low' : 'is-open'
  const text =
    remaining === 0 ? 'Fully booked'
      : remaining === 1 ? '1 seat left'
        : `${remaining.toLocaleString()} seats left`

  return (
    <span className={`cv-seats ${tone}`}>
      <i className="fas fa-chair" aria-hidden="true" /> {text}
      <style>{`
        .cv-seats {
          display: inline-flex; align-items: center; gap: 7px; margin-top: 8px;
          padding: 3px 11px; border-radius: 999px; font-size: 0.8rem; font-weight: 700;
        }
        .cv-seats.is-open { background: var(--gray-100, #F3F4F6); color: var(--navy); }
        .cv-seats.is-low { background: #fef3c7; color: #b45309; }
        .cv-seats.is-gone { background: var(--gray-200, #E5E7EB); color: var(--gray-600, #4B5563); }
      `}</style>
    </span>
  )
}

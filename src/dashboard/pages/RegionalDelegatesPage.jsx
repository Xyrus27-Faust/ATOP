import { Link } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { labelFor, REGIONS, formatDate } from '@/lib/pearlAwards'

/**
 * The regional representative's home: how many of their region's seats are left,
 * and the delegations they have booked with them.
 *
 * The meter is the whole point of the page. A representative composing a
 * delegation needs to know before they start how many they may bring — finding
 * out at the last step that only two of their six fit is the failure this
 * avoids, which is why the count sits above the call to action and the button
 * goes dead (with its reason) at zero.
 *
 * They see only bookings they created; the backend scopes /registrations that
 * way, so there is no regional roster here by design.
 */
export default function RegionalDelegatesPage() {
  const { loading, error, data, reload } = useAsync(
    () =>
      api
        .get('/regional/allocation', { auth: true })
        .then(async (allocation) => ({
          allocation,
          // Everything this account booked. Filtered to the claimed ones below — a representative
          // may also have an ordinary paid booking of their own, and that is not region business.
          bookings: await api.get('/registrations', { auth: true }),
        }))
        // A 403 here is expected and specific: the role is granted but no region is assigned yet.
        // It is not an error state, it is an instruction, so it renders as one.
        .catch((e) => {
          if (e instanceof ApiError && e.status === 403) return { unassigned: e, allocation: null, bookings: [] }
          throw e
        }),
    [],
  )

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  if (data.unassigned) {
    return (
      <>
        <PageHead region={null} />
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-map-location-dot" aria-hidden="true" /></div>
          <h3>No region assigned yet</h3>
          <p>
            {data.unassigned.message ||
              'An administrator needs to assign you a region before you can register delegates.'}
          </p>
        </div>
      </>
    )
  }

  const { allocation, bookings } = data
  const claimed = (bookings || []).filter((b) => b.isRegionalAllocation)
  const spent = allocation.seatAllowance > 0
    ? Math.round((allocation.used / allocation.seatAllowance) * 100)
    : 0
  const full = allocation.remaining <= 0

  return (
    <>
      <PageHead region={allocation.region} />

      <div className="dash-card dash-card-pad">
        <div className="rd-meter-head">
          <div>
            <div className="dash-stat-value">
              {allocation.used} <span className="rd-of">of {allocation.seatAllowance}</span>
            </div>
            <div className="dash-stat-label">seats used</div>
          </div>
          <div className="rd-remaining">
            <div className="dash-stat-value">{allocation.remaining}</div>
            <div className="dash-stat-label">remaining</div>
          </div>
        </div>

        <div
          className="dash-meter rd-meter"
          role="progressbar"
          aria-valuenow={allocation.used}
          aria-valuemin={0}
          aria-valuemax={allocation.seatAllowance}
          aria-label={`${allocation.used} of ${allocation.seatAllowance} seats used`}
        >
          <span className={`dash-meter-fill${full ? ' is-complete' : ''}`} style={{ display: 'block', width: `${Math.min(100, spent)}%` }} />
        </div>

        {allocation.seatAllowance === 0 ? (
          <p className="rd-note">
            Your region has not been granted any seats for this convention yet. The ATOP Secretariat
            sets the number.
          </p>
        ) : full ? (
          <p className="rd-note">
            Your region’s allocation is fully used. Remove a delegate from one of your delegations to
            free a seat, or ask the Secretariat to increase the allocation.
          </p>
        ) : (
          <p className="rd-note">
            Delegates you register are confirmed without payment and count against this allocation.
          </p>
        )}

        <Link
          className="dash-btn is-primary"
          to="/convention/register"
          aria-disabled={full || undefined}
          onClick={(e) => { if (full) e.preventDefault() }}
          style={full ? { pointerEvents: 'none', opacity: 0.55 } : undefined}
        >
          <i className="fas fa-user-plus" aria-hidden="true" /> Register delegates
        </Link>
      </div>

      <h2 className="dash-card-title rd-section">Your delegations</h2>

      {claimed.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-users" aria-hidden="true" /></div>
          <h3>No delegations yet</h3>
          <p>Register your region’s delegates and they will appear here.</p>
        </div>
      ) : (
        <div className="rd-list">
          {claimed.map((b) => {
            const heads = (b.inPersonCount ?? 0) + (b.virtualCount ?? 0)
            return (
              <Link key={b.id} className="dash-card rd-row" to={`/convention/registrations/${b.id}`}>
                <span className="rd-row-main">
                  {/* Always 'Confirmed' underneath — the badge says *why* it needed no payment,
                      which is the part a representative is actually asked about. */}
                  <span className="dash-badge tone-success">
                    <i className="fas fa-award" aria-hidden="true" /> Regional slot
                  </span>
                  <span className="rd-ref">{b.referenceCode}</span>
                  <span className="rd-who">{b.lguName || '—'}</span>
                </span>
                <span className="rd-row-meta">
                  <strong>{heads}</strong> {heads === 1 ? 'delegate' : 'delegates'}
                  <span className="rd-date">{formatDate(b.confirmedAt || b.createdAt)}</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
      <style>{`
        .rd-meter-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
        .rd-of { font-size: 0.9rem; font-weight: 500; color: var(--gray-600); }
        .rd-remaining { text-align: right; }
        .rd-meter { margin-bottom: 12px; }
        .rd-note { font-size: 0.88rem; color: var(--gray-600); margin: 0 0 14px; }
        .rd-section { margin: 26px 0 12px; }
        .rd-list { display: flex; flex-direction: column; gap: 10px; }
        /* A row is a card that happens to be a link — same affordance as the admin list. */
        .rd-row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
                  padding: 14px 16px; text-decoration: none; color: inherit; transition: border-color .15s; }
        .rd-row:hover { border-color: var(--gold); }
        .rd-row-main { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-width: 0; }
        .rd-ref { font-family: var(--font-mono, monospace); font-weight: 600; }
        .rd-who { color: var(--gray-600); }
        .rd-row-meta { display: flex; align-items: baseline; gap: 12px; white-space: nowrap; font-size: 0.85rem; color: var(--gray-600); }
        .rd-date { color: var(--gray-500); }
        @media (max-width: 640px) {
          .rd-row { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </>
  )
}

function PageHead({ region }) {
  return (
    <div className="dash-page-head">
      <div>
        <span className="dash-eyebrow">National Convention 2026</span>
        <h1 className="dash-h1">My Region</h1>
        <p className="dash-sub">
          {region
            ? <>Register delegates for {labelFor(REGIONS, region)} against your allocated seats.</>
            : <>Your regional representative workspace.</>}
        </p>
      </div>
    </div>
  )
}

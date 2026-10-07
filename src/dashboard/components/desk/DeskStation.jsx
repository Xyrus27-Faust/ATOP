import { useCallback, useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { registrationStatusMeta } from '@/lib/events'
import { deskScan, deskSearch, deskCard, isBadgeCode, formatVenueTime, CAMERA_TROUBLE, DESK_REFUSAL } from '@/lib/checkin'
import { useAsync } from '../../useAsync'
import { Loading, ErrorState } from '../states'
import QrViewfinder from '../checkin/QrViewfinder'
import DelegateFace from '../checkin/DelegateFace'
import DeskCardView from './DeskCardView'
import DeskSearch from './DeskSearch'

/**
 * The Secretariat desk, as one post on the scanner: where the main gate sends every delegate.
 *
 * <p>A badge scanned here opens the delegate's card — checking them in too if they walked round the
 * gate; a second phone scanning the same badge changes nothing. The card says Desk A (fully paid) or
 * Desk B (balance to pay in cash), takes the cash, then hands over the ID & receipt and the kit in
 * either order. A name search only opens the card; the Confirm tap on it is the check-in, after a
 * look at the photo.</p>
 *
 * <p>Someone with no seat is never checked in. The desk shows whose booking it was and how to reach
 * them, so Desk B can sort it out with the person who booked.</p>
 *
 * <p>The scanner around it owns the bar, the idle sign-out and the way back to the post list;
 * {@code touch} is how a badge read counts as activity.</p>
 */
export default function DeskStation({ touch }) {
  const { loading, error, data: event, reload } = useAsync(fetchCurrentEvent, [])

  const [mode, setMode] = useState('scan')
  const [camera, setCamera] = useState('ok')
  const [cameraKey, setCameraKey] = useState(0)
  const [busy, setBusy] = useState(false)
  // What's on screen instead of the camera: { card, note } | { denied } | { failed }. Each new one
  // gets a fresh key, so a card left half-confirmed never carries over to the next delegate.
  const [view, setView] = useState(null)
  const show = useCallback((v) => setView({ ...v, key: Date.now() }), [])
  // The camera is unmounted while a card is up; the last badge it read is kept here, so the one
  // still in front of it after "Next delegate" doesn't reopen the same card.
  const [lastCode, setLastCode] = useState(null)

  const handleCode = useCallback(async (code) => {
    touch()
    setLastCode(code)
    if (!isBadgeCode(code)) {
      show({ failed: 'That isn’t an ATOP badge. Scan the QR on their pass, or search by name.' })
      return
    }
    setBusy(true)
    try {
      const r = await deskScan(event.id, code)
      show(r.result === 'denied' ? { denied: r } : { card: r.card, note: arrivalNote(r) })
    } catch (err) {
      show({ failed: `${err.message} Scan again, or search by name.` })
    } finally {
      setBusy(false)
    }
  }, [event, show, touch])

  const pick = async (row) => {
    setBusy(true)
    try {
      show({ card: await deskCard(event.id, row.id), note: null })
    } catch (err) {
      // 409: someone the desk turns away. Shown like a refused scan, with the name read back.
      const code = err.raw?.reasonCode
      show(code
        ? { denied: { reasonCode: code, reason: err.message, named: { fullName: row.fullName, lgu: row.lgu }, booking: err.raw.booking } }
        : { failed: err.message })
    } finally {
      setBusy(false)
    }
  }

  const nextDelegate = () => {
    setView(null)
    setMode('scan')
  }

  let body
  if (loading && !event) body = <Loading />
  else if (error) body = <div className="dsk-pad"><ErrorState error={error} onRetry={reload} /></div>
  else if (!event) {
    body = (
      <div className="dsk-pad">
        <div className="dash-card dash-empty"><h3>No published convention</h3><p>There is nothing to check in to yet.</p></div>
      </div>
    )
  } else if (view?.card) {
    body = <DeskCardView key={view.key} card={view.card} note={view.note} onDone={nextDelegate} />
  } else if (view) {
    body = <Refused view={view} onDone={nextDelegate} />
  } else if (mode === 'search') {
    body = <DeskSearch eventId={event.id} search={deskSearch} post="Secretariat desk" onPick={pick} onClose={() => setMode('scan')} />
  } else {
    const trouble = CAMERA_TROUBLE[camera]
    body = (
      <div className="dsk-stage">
        {trouble ? (
          <div className="dash-card dash-card-pad dsk-trouble">
            <i className="fas fa-video-slash" aria-hidden="true" />
            <h2>{trouble.title}</h2>
            <p>{trouble.body}</p>
            {camera === 'denied' && (
              <button type="button" className="dash-btn is-ghost" onClick={() => { setCamera('ok'); setCameraKey((k) => k + 1) }}>
                <i className="fas fa-rotate-right" aria-hidden="true" /> Try the camera again
              </button>
            )}
          </div>
        ) : (
          <QrViewfinder key={cameraKey} ready={!busy} onCode={handleCode} onUnavailable={setCamera} lastCode={lastCode} />
        )}
        <p className="dsk-aim">{trouble ? ' ' : busy ? 'Checking…' : 'Scan their pass'}</p>
      </div>
    )
  }

  const scanning = event && !view && mode === 'scan'

  return (
    <div className={`dsk-station${scanning ? ' is-scanning' : ''}`}>
      {body}

      {scanning && (
        <div className="dsk-dock">
          <button type="button" className="dsk-search-btn" onClick={() => setMode('search')}>
            <i className="fas fa-magnifying-glass" aria-hidden="true" /> Search by name
          </button>
        </div>
      )}

      <style>{DSK_CSS}</style>
    </div>
  )
}

/** The line above a scanned card: whether this scan checked them in, or someone already had. */
function arrivalNote(r) {
  if (r.justCheckedIn) return 'Checked in just now.'
  const at = r.card?.checkIn
  return at ? `Already checked in at ${formatVenueTime(at.at)} by ${at.by}.` : null
}

/**
 * Someone the desk turns away, or a scan that never reached a verdict. A refusal carries the booking
 * behind the seat — no cash button: Desk B only collects balances, and a seat never paid for has none.
 */
function Refused({ view, onDone }) {
  const denied = view.denied
  const person = denied?.named
  const booking = denied?.booking
  return (
    <div className="dsk-refused">
      <div className="dsk-refused-head">
        <i className="fas fa-circle-xmark" aria-hidden="true" />
        <span>{denied ? DESK_REFUSAL[denied.reasonCode] || 'Not checked in' : 'Scan failed'}</span>
      </div>
      {person && (
        <div className="dsk-refused-who">
          <DelegateFace name={person.fullName} photoUrl={null} size={64} />
          <div>
            <strong>{person.fullName}</strong>
            {person.lgu && <span>{person.lgu}</span>}
          </div>
        </div>
      )}
      <p>{denied ? denied.reason : view.failed}</p>
      {booking && (
        <dl className="dsk-booking">
          <div><dt>Booking</dt><dd>{booking.referenceCode} · {registrationStatusMeta(booking.status).label}</dd></div>
          <div><dt>Booked by</dt><dd>{booking.bookedBy}</dd></div>
          {booking.mobile && <div><dt>Mobile</dt><dd><a href={`tel:${booking.mobile}`}>{booking.mobile}</a></dd></div>}
          {booking.email && <div><dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd></div>}
        </dl>
      )}
      <button type="button" className="dash-btn is-primary dsk-refused-next" autoFocus onClick={onDone}>
        Next delegate
      </button>
    </div>
  )
}

const DSK_CSS = `
  /* Fills the scanner's main area; navy behind the camera, light behind a card. */
  .dsk-station { flex: 1; display: flex; flex-direction: column; background: var(--off-white); }
  .dsk-station.is-scanning { background: var(--navy); }

  .dsk-pad { padding: 20px 16px; }
  .dsk-stage { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 20px 16px 120px; }
  .dsk-aim { text-align: center; color: var(--white); font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; }
  .dsk-trouble { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-width: 420px; width: 100%; margin: 0 auto; }
  .dsk-trouble > i { font-size: 1.8rem; color: var(--bad); background: var(--bad-bg); width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; }
  .dsk-trouble h2 { font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem; color: var(--navy); }
  .dsk-trouble p { color: var(--gray-600); line-height: 1.6; }

  .dsk-dock {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(15,25,46,0) 0%, var(--navy) 35%);
  }
  .dsk-search-btn {
    width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--white); color: var(--navy); border: 0; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font-heading); font-weight: 700; font-size: 1rem; box-shadow: var(--shadow-lg);
  }
  .dsk-search-btn:hover { background: var(--gold-light); }

  .dsk-refused { display: flex; flex-direction: column; gap: 14px; padding: 16px; max-width: 560px; width: 100%; margin: 0 auto; }
  .dsk-refused-head {
    display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: var(--radius-sm);
    background: var(--bad-bg); color: var(--bad); font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; text-transform: uppercase;
  }
  .dsk-refused-head i { font-size: 1.5rem; }
  .dsk-refused-who { display: flex; align-items: center; gap: 12px; }
  .dsk-refused-who > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .dsk-refused-who strong { font-family: var(--font-heading); font-weight: 800; color: var(--navy); text-transform: uppercase; overflow-wrap: anywhere; }
  .dsk-refused-who span { font-size: 0.9rem; color: var(--gray-600); }
  .dsk-refused > p { font-size: 1rem; line-height: 1.5; color: var(--gray-800); }
  .dsk-booking { margin: 0; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .dsk-booking > div { display: grid; grid-template-columns: 96px 1fr; gap: 10px; }
  .dsk-booking dt { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); padding-top: 2px; }
  .dsk-booking dd { margin: 0; font-family: var(--font-heading); font-weight: 700; color: var(--navy); overflow-wrap: anywhere; }
  .dsk-booking a { color: var(--navy); }
  .dsk-refused-next { width: 100%; min-height: 56px; justify-content: center; font-size: 1rem; }

  @media (min-width: 640px) {
    .dsk-dock { left: 50%; right: auto; width: 480px; transform: translateX(-50%); background: none; bottom: 12px; }
    .dsk-stage { padding-top: 32px; }
  }
`

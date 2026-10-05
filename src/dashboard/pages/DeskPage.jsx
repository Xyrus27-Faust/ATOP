import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { deskScan, deskCard, isBadgeCode, formatVenueTime, CAMERA_TROUBLE, DESK_REFUSAL } from '@/lib/checkin'
import { useAsync } from '../useAsync'
import { useIdleSignOut } from '../useIdleSignOut'
import { Loading, ErrorState } from '../components/states'
import QrViewfinder from '../components/checkin/QrViewfinder'
import DelegateFace from '../components/checkin/DelegateFace'
import DeskCardView from '../components/desk/DeskCardView'
import DeskSearch from '../components/desk/DeskSearch'
import { DASH_CSS } from '../DashboardLayout'

/**
 * The Secretariat desk: the first stop for every delegate, on any of the four desk phones.
 *
 * <p>A badge scanned here checks the delegate in straight away — a second phone scanning the same
 * badge changes nothing — and opens their card, which says Desk A (fully paid) or Desk B (balance
 * to pay in cash), then walks them through payment, ID & receipt, and kit. A name search only opens
 * the card; the Confirm tap on it is the check-in, after a look at the photo.</p>
 *
 * <p>Full screen like the marshal's scanner, and signed out after 30 idle minutes for the same
 * reason: it's a shared phone on a table, and this one shows money.</p>
 */
export default function DeskPage() {
  const navigate = useNavigate()
  const { signOut, touch } = useIdleSignOut()
  const { loading, error, data: event, reload } = useAsync(async () => (await api.get('/events/'))[0] || null, [])

  const [mode, setMode] = useState('scan')
  const [camera, setCamera] = useState('ok')
  const [cameraKey, setCameraKey] = useState(0)
  const [busy, setBusy] = useState(false)
  // What's on screen instead of the camera: { card, note } | { denied } | { failed }. Each new one
  // gets a fresh key, so a card left half-confirmed never carries over to the next delegate.
  const [view, setView] = useState(null)
  const show = useCallback((v) => setView({ ...v, key: Date.now() }), [])

  const handleCode = useCallback(async (code) => {
    touch()
    if (!isBadgeCode(code)) {
      show({ failed: 'That isn’t an ATOP badge. Scan the QR on their pass, or search by name.' })
      return
    }
    setBusy(true)
    try {
      const r = await deskScan(code.trim().toUpperCase())
      show(r.result === 'denied' ? { denied: r } : { card: r.card, note: arrivalNote(r) })
    } catch (err) {
      show({ failed: `${err.message} Scan again, or search by name.` })
    } finally {
      setBusy(false)
    }
  }, [show, touch])

  const pick = async (row) => {
    setBusy(true)
    try {
      show({ card: await deskCard(row.id), note: null })
    } catch (err) {
      // 409: someone the desk turns away. Shown like a refused scan, with the name read back.
      const code = err.raw?.reasonCode
      show(code
        ? { denied: { reasonCode: code, reason: err.message, named: { fullName: row.fullName, lgu: row.lgu } } }
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
    body = <DeskSearch eventId={event.id} onPick={pick} onClose={() => setMode('scan')} />
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
          <QrViewfinder key={cameraKey} ready={!busy} onCode={handleCode} onUnavailable={setCamera} />
        )}
        <p className="dsk-aim">{trouble ? ' ' : busy ? 'Checking…' : 'Scan to check in'}</p>
      </div>
    )
  }

  const scanning = event && !view && mode === 'scan'

  return (
    <div className={`dsk-shell${scanning ? ' is-scanning' : ''}`}>
      <header className="dsk-bar">
        <img src="/Untitled.png" alt="ATOP" className="dsk-logo" />
        <span className="dsk-brand">Secretariat desk</span>
        <div className="dsk-spacer" />
        <button type="button" className="dsk-bar-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
        <button type="button" className="dsk-bar-btn is-icon" onClick={signOut} aria-label="Sign out">
          <i className="fas fa-arrow-right-from-bracket" aria-hidden="true" />
        </button>
      </header>

      <main className="dsk-main">{body}</main>

      {scanning && (
        <div className="dsk-dock">
          <button type="button" className="dsk-search-btn" onClick={() => setMode('search')}>
            <i className="fas fa-magnifying-glass" aria-hidden="true" /> Search by name
          </button>
        </div>
      )}

      <style>{DASH_CSS}</style>
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

/** Someone the desk turns away, or a scan that never reached a verdict. */
function Refused({ view, onDone }) {
  const denied = view.denied
  const person = denied?.named
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
      <button type="button" className="dash-btn is-primary dsk-refused-next" autoFocus onClick={onDone}>
        Next delegate
      </button>
    </div>
  )
}

const DSK_CSS = `
  .dsk-shell { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; background: var(--off-white); font-family: var(--font-body); }
  .dsk-shell.is-scanning { background: var(--navy); }
  .dsk-bar {
    position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 10px;
    min-height: 60px; padding: max(8px, env(safe-area-inset-top)) 12px 8px 16px;
    background: var(--navy); border-bottom: 2px solid var(--gold); color: var(--white);
  }
  .dsk-logo { height: 32px; width: auto; }
  .dsk-brand { font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; letter-spacing: 0.04em; }
  .dsk-spacer { flex: 1; }
  .dsk-bar-btn {
    min-height: 44px; padding: 0 14px; flex-shrink: 0; cursor: pointer; background: transparent; color: var(--white);
    border: 1.5px solid rgba(255,255,255,0.35); border-radius: var(--radius-sm);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem;
  }
  .dsk-bar-btn:hover { border-color: var(--gold); color: var(--gold-light); }
  .dsk-bar-btn.is-icon { width: 44px; padding: 0; }

  .dsk-main { flex: 1; display: flex; flex-direction: column; }
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
  .dsk-refused-next { width: 100%; min-height: 56px; justify-content: center; font-size: 1rem; }

  @media (min-width: 640px) {
    .dsk-dock { left: 50%; right: auto; width: 480px; transform: translateX(-50%); background: none; bottom: 12px; }
    .dsk-stage { padding-top: 32px; }
  }
`

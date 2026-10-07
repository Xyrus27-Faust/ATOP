import { useCallback, useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { gateScan, gateSearch, gateCheckIn, isBadgeCode, CAMERA_TROUBLE } from '@/lib/checkin'
import { useAsync } from '../../useAsync'
import { Loading, ErrorState } from '../states'
import QrViewfinder from '../checkin/QrViewfinder'
import ScanResultSheet from '../checkin/ScanResultSheet'
import DeskSearch from '../desk/DeskSearch'

/**
 * The main gate, as one post on the scanner: every delegate's first stop.
 *
 * <p>A badge scanned here checks the delegate in and says where to go — Desk A (paid in full), Desk B
 * (a balance to pay) or Go in (ID and kit already collected) — with their photo and name, and never
 * an amount, because marshals work the gate. Someone with no seat (never paid, cancelled, online) is
 * not checked in: the sheet names them and says Desk B.</p>
 *
 * <p>The gate is arrival, not attendance: nothing here counts at a session. A check-in from a name
 * search is one Confirm tap after picking the row, and the face shows on the result — if it's the
 * wrong person, the desk can take the check-in back.</p>
 *
 * <p>The scanner around it owns the bar, the idle sign-out and the way back to the post list;
 * {@code touch} is how a badge read counts as activity.</p>
 */
export default function GateStation({ touch }) {
  const { loading, error, data: event, reload } = useAsync(fetchCurrentEvent, [])

  const [mode, setMode] = useState('scan')
  const [camera, setCamera] = useState('ok')
  const [cameraKey, setCameraKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  // A row picked from the search, waiting for the Confirm tap.
  const [picked, setPicked] = useState(null)

  const handleCode = useCallback(async (code) => {
    touch()
    if (!isBadgeCode(code)) {
      setResult({ result: 'error', reason: 'That isn’t an ATOP badge. Scan the QR on their pass, or search by name.' })
      return
    }
    setBusy(true)
    try {
      setResult(await gateScan(event.id, code))
    } catch (err) {
      setResult({ result: 'error', reason: `${err.message} Scan again, or search by name.` })
    } finally {
      setBusy(false)
    }
  }, [event, touch])

  const confirm = async () => {
    setBusy(true)
    try {
      setResult(await gateCheckIn(event.id, picked.id))
    } catch (err) {
      setResult({ result: 'error', reason: err.message })
    } finally {
      setBusy(false)
      setPicked(null)
      setMode('scan')
    }
  }

  const next = useCallback(() => setResult(null), [])

  let body
  if (loading && !event) body = <Loading />
  else if (error) body = <div className="gte-pad"><ErrorState error={error} onRetry={reload} /></div>
  else if (!event) {
    body = (
      <div className="gte-pad">
        <div className="dash-card dash-empty"><h3>No published convention</h3><p>There is nothing to check in to yet.</p></div>
      </div>
    )
  } else if (picked) {
    body = (
      <div className="gte-confirm">
        <p className="gte-confirm-q">Check in this delegate?</p>
        <div className="gte-confirm-who">
          <strong>{picked.fullName}</strong>
          {picked.lgu && <span>{picked.lgu}</span>}
        </div>
        <p className="dash-help">Ask their name and LGU first. Their photo shows next, so you can check the face.</p>
        <div className="gte-row">
          <button type="button" className="dash-btn is-ghost" disabled={busy} onClick={() => setPicked(null)}>Back</button>
          <button type="button" className="dash-btn is-primary" disabled={busy} onClick={confirm}>
            {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />} Check in
          </button>
        </div>
      </div>
    )
  } else if (mode === 'search') {
    body = (
      <DeskSearch
        eventId={event.id}
        search={gateSearch}
        post="Main gate"
        onPick={(row) => { touch(); setPicked(row) }}
        onClose={() => setMode('scan')}
      />
    )
  } else {
    const trouble = CAMERA_TROUBLE[camera]
    body = (
      <div className="gte-stage">
        {trouble ? (
          <div className="dash-card dash-card-pad gte-trouble">
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
          <QrViewfinder key={cameraKey} ready={!busy && !result} onCode={handleCode} onUnavailable={setCamera} />
        )}
        <p className="gte-aim">{trouble ? ' ' : busy && !result ? 'Checking…' : 'Point at the QR code'}</p>
      </div>
    )
  }

  const scanning = event && !picked && mode === 'scan'

  return (
    <div className={`gte-station${scanning ? ' is-scanning' : ''}`}>
      {body}

      {scanning && (
        <div className="gte-dock">
          <button type="button" className="gte-search-btn" onClick={() => setMode('search')}>
            <i className="fas fa-magnifying-glass" aria-hidden="true" /> Search by name
          </button>
        </div>
      )}

      {result && <ScanResultSheet response={result} onNext={next} />}

      <style>{GTE_CSS}</style>
    </div>
  )
}

const GTE_CSS = `
  /* Fills the scanner's main area; navy behind the camera, light behind the confirm. */
  .gte-station { flex: 1; display: flex; flex-direction: column; background: var(--off-white); }
  .gte-station.is-scanning { background: var(--navy); }

  .gte-pad { padding: 20px 16px; }
  .gte-stage { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 20px 16px 120px; }
  .gte-aim { text-align: center; color: var(--white); font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; }
  .gte-trouble { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-width: 420px; width: 100%; margin: 0 auto; }
  .gte-trouble > i { font-size: 1.8rem; color: var(--bad); background: var(--bad-bg); width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; }
  .gte-trouble h2 { font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem; color: var(--navy); }
  .gte-trouble p { color: var(--gray-600); line-height: 1.6; }

  .gte-dock {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(15,25,46,0) 0%, var(--navy) 35%);
  }
  .gte-search-btn {
    width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--white); color: var(--navy); border: 0; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font-heading); font-weight: 700; font-size: 1rem; box-shadow: var(--shadow-lg);
  }
  .gte-search-btn:hover { background: var(--gold-light); }

  .gte-confirm { display: flex; flex-direction: column; gap: 14px; padding: 20px 16px; max-width: 560px; width: 100%; margin: 0 auto; }
  .gte-confirm-q { font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem; color: var(--navy); }
  .gte-confirm-who { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .gte-confirm-who strong { font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; color: var(--navy); text-transform: uppercase; overflow-wrap: anywhere; }
  .gte-confirm-who span { font-size: 0.9rem; color: var(--gray-600); }
  .gte-row { display: flex; gap: 10px; }
  .gte-row .dash-btn { flex: 1; min-height: 56px; justify-content: center; font-size: 1rem; }

  @media (min-width: 640px) {
    .gte-dock { left: 50%; right: auto; width: 480px; transform: translateX(-50%); background: none; bottom: 12px; }
    .gte-stage { padding-top: 32px; }
  }
`

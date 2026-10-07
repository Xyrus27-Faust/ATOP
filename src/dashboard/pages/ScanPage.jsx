import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/apiClient'
import {
  listMarshalCheckpoints, scanCode, formatDay, kindMeta, isPostGone, progressPct, readPost, writePost, isBadgeCode,
  tallyVerb, CAMERA_TROUBLE, GATE_POST, DESK_POST,
} from '@/lib/checkin'
import { useAuth } from '@/auth/AuthContext'
import { canManageCheckIn } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { useIdleSignOut } from '../useIdleSignOut'
import { Loading, ErrorState } from '../components/states'
import CheckpointPicker from '../components/checkin/CheckpointPicker'
import QrViewfinder from '../components/checkin/QrViewfinder'
import ScanResultSheet from '../components/checkin/ScanResultSheet'
import ManualSearch from '../components/checkin/ManualSearch'
import DeskStation from '../components/desk/DeskStation'
import GateStation from '../components/gate/GateStation'
import { DASH_CSS } from '../DashboardLayout'

/**
 * The one scanner: a full-screen page (no dashboard chrome) built for one hand and bright sun.
 *
 * <p>Pick a post — the main gate, the Secretariat desk, or one of today's checkpoints — then point
 * the camera at badges. The gate checks delegates in and says Desk A or Desk B ({@link GateStation});
 * the desk takes balances and hands over the ID & receipt and the kit ({@link DeskStation}).
 * Everything below is the checkpoint side.</p>
 *
 * <p>At a checkpoint, each code goes to the API, which returns a
 * verdict — green, amber or red with a reason — and the result sheet shows it over the camera.
 * When a badge won't read, the bar at the bottom opens a search by name. There is no offline mode:
 * a verdict needs the server, and a guard without signal sends people to the Secretariat desk.</p>
 */
export default function ScanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { signOut, touch } = useIdleSignOut()
  // The gate is every scanner's; the desk is Secretariat and Admin's, as on the API. A phone remembered
  // on the desk and then signed in as a marshal just lands on the post list.
  const canDesk = canManageCheckIn(user?.roles)
  const { loading, error, data: checkpoints, reload } = useAsync(listMarshalCheckpoints, [])

  const [postId, setPostId] = useState(readPost)
  const atGate = postId === GATE_POST
  const atDesk = canDesk && postId === DESK_POST
  const [mode, setMode] = useState('scan')
  const [camera, setCamera] = useState('ok')
  const [cameraKey, setCameraKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [counts, setCounts] = useState({})
  // The checkpoint the server just refused as closed or not today's, and the list it was refused
  // against. That list stays on screen while a fresh one loads, so the refused tile is left off it by
  // hand — but only off that list: the fresh one is the server's word, including on a reopened checkpoint.
  const [gone, setGone] = useState(null)

  // A remembered checkpoint the secretariat has since closed simply isn't in the list any more.
  const checkpoint = checkpoints?.find((c) => c.id === postId) || null
  const count = checkpoint ? counts[checkpoint.id] ?? checkpoint.scanCount : 0
  // The headcount comes with the list and holds until the next refresh: it only moves when a booking pays.
  const pct = checkpoint ? progressPct(count, checkpoint.expected) : 0

  const pick = (c) => {
    writePost(c.id)
    setPostId(c.id)
    setMode('scan')
  }

  const pickPost = (post) => {
    writePost(post)
    setPostId(post)
  }

  const change = () => {
    writePost(null)
    setPostId(null)
    setResult(null)
    setBusy(false)
    // The fresh list carries every marshal's count; this phone's last number would hide theirs.
    setCounts({})
    reload()
  }

  const show = useCallback((response, checkpointId) => {
    setResult(response)
    if (isPostGone(response.reasonCode)) setGone({ id: checkpointId, list: checkpoints })
    if (typeof response.scanCount === 'number')
      setCounts((c) => ({ ...c, [checkpointId]: response.scanCount }))
  }, [checkpoints])

  const offered = gone && gone.list === checkpoints ? checkpoints.filter((c) => c.id !== gone.id) : checkpoints

  const handleCode = useCallback(async (code) => {
    if (!checkpoint) return
    // A badge read by the camera is activity too, though nothing was touched.
    touch()
    if (!isBadgeCode(code)) {
      // Never sent: the camera read some other QR. The sheet pauses the camera until Next scan.
      setResult({ result: 'error', reason: 'That isn’t an ATOP badge. Scan the QR on their pass, or search by name.' })
      return
    }
    setBusy(true)
    try {
      show(await scanCode(checkpoint.id, code), checkpoint.id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // The checkpoint was deleted under us. Back to the picker, with a fresh list.
        change()
        return
      }
      setResult({ result: 'error', reason: `${err.message} Scan again, or search by name.` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoint, show, touch])

  // A checkpoint the secretariat closed mid-shift, or a phone left on yesterday's overnight: the
  // server refuses it, and the next tap goes straight back to the picker, which lists neither.
  const stale = isPostGone(result?.reasonCode)

  const next = useCallback(() => {
    setResult(null)
    setBusy(false)
    setMode('scan')
  }, [])

  let body
  // Before the checkpoint list: the gate and the desk don't need it, and shouldn't wait on it or fail with it.
  if (atGate) body = <GateStation touch={touch} />
  else if (atDesk) body = <DeskStation touch={touch} />
  else if (loading && !checkpoints) body = <Loading />
  else if (error) body = <div className="scn-pad"><ErrorState error={error} onRetry={reload} /></div>
  else if (!checkpoint) {
    body = (
      <CheckpointPicker
        checkpoints={offered}
        onPick={pick}
        onPickPost={pickPost}
        canDesk={canDesk}
        onRefresh={reload}
        refreshing={loading}
      />
    )
  }
  else if (mode === 'search') {
    body = (
      <ManualSearch
        checkpoint={checkpoint}
        onClose={() => setMode('scan')}
        onResult={(r) => show(r, checkpoint.id)}
        onGone={() => { setGone({ id: checkpoint.id, list: checkpoints }); change() }}
      />
    )
  } else {
    const trouble = CAMERA_TROUBLE[camera]
    body = (
      <div className="scn-stage">
        {trouble ? (
          <div className="dash-card dash-card-pad scn-trouble">
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
        <p className="scn-aim">
          {trouble ? ' ' : busy && !result ? 'Checking…' : 'Point at the QR code'}
        </p>
        <div className="scn-tally">
          <p className="scn-count">
            <strong>{count}</strong> of {checkpoint.expected} {tallyVerb(checkpoint.kind)} here
          </p>
          <div className="dash-meter scn-meter" aria-hidden="true">
            <div className={`dash-meter-fill${pct >= 100 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`scn-shell${checkpoint && mode === 'scan' ? ' is-scanning' : ''}`}>
      <header className="scn-bar">
        {atGate || atDesk ? (
          <>
            <div className="scn-post">
              <span className="scn-post-day">
                <i className={`fas ${atGate ? 'fa-door-open' : 'fa-id-card'}`} aria-hidden="true" />
                {atGate ? ' Check-in · Desk A / B' : ' Balance · ID · Kit'}
              </span>
              <span className="scn-post-label">{atGate ? 'Main gate' : 'Secretariat desk'}</span>
            </div>
            <button type="button" className="scn-bar-btn" onClick={change}>Change</button>
          </>
        ) : checkpoint ? (
          <>
            <div className="scn-post">
              <span className="scn-post-day">
                <i className={`fas ${kindMeta(checkpoint.kind).icon}`} aria-hidden="true" /> {formatDay(checkpoint.day)}
              </span>
              <span className="scn-post-label">{checkpoint.label}</span>
            </div>
            <button type="button" className="scn-bar-btn" onClick={change}>Change</button>
          </>
        ) : (
          <>
            <img src="/Untitled.png" alt="ATOP" className="scn-logo" />
            <span className="scn-brand">Check-in</span>
            <div className="scn-spacer" />
            {/* Always there: a guard's account is also an ordinary one, with its own bookings. */}
            <button type="button" className="scn-bar-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button type="button" className="scn-bar-btn is-icon" onClick={signOut} aria-label="Sign out">
              <i className="fas fa-arrow-right-from-bracket" aria-hidden="true" />
            </button>
          </>
        )}
      </header>

      <main className="scn-main">{body}</main>

      {checkpoint && mode === 'scan' && (
        <div className="scn-dock">
          <button type="button" className="scn-search-btn" onClick={() => setMode('search')}>
            <i className="fas fa-magnifying-glass" aria-hidden="true" /> Search by name
          </button>
        </div>
      )}

      {result && <ScanResultSheet response={result} kind={checkpoint?.kind} onNext={stale ? change : next} />}

      <style>{DASH_CSS}</style>
      <style>{SCN_CSS}</style>
    </div>
  )
}

const SCN_CSS = `
  .scn-shell {
    min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
    background: var(--off-white); font-family: var(--font-body);
  }
  .scn-shell.is-scanning { background: var(--navy); }

  .scn-bar {
    position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 10px;
    min-height: 60px; padding: max(8px, env(safe-area-inset-top)) 12px 8px 16px;
    background: var(--navy); border-bottom: 2px solid var(--gold); color: var(--white);
  }
  .scn-logo { height: 32px; width: auto; }
  .scn-brand { font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; letter-spacing: 0.04em; }
  .scn-spacer { flex: 1; }
  .scn-post { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .scn-post-day {
    font-family: var(--font-heading); font-weight: 700; font-size: 0.7rem; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--gold-light);
  }
  /* The one line a guard must never misread: which meal this phone is serving. */
  .scn-post-label {
    font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem; text-transform: uppercase;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .scn-bar-btn {
    min-height: 44px; padding: 0 14px; flex-shrink: 0; cursor: pointer;
    background: transparent; color: var(--white); border: 1.5px solid rgba(255,255,255,0.35);
    border-radius: var(--radius-sm); font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem;
  }
  .scn-bar-btn:hover { border-color: var(--gold); color: var(--gold-light); }
  .scn-bar-btn.is-icon { width: 44px; padding: 0; }

  .scn-main { flex: 1; display: flex; flex-direction: column; }
  .scn-pad { padding: 20px 16px; }

  .scn-stage { flex: 1; display: flex; flex-direction: column; align-items: stretch; gap: 14px; padding: 20px 16px 120px; }
  .scn-aim { text-align: center; color: var(--white); font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; }
  .scn-tally { width: min(100%, 320px); margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
  .scn-count { text-align: center; color: rgba(255,255,255,0.7); font-size: 0.9rem; }
  .dash-meter.scn-meter { height: 6px; background: rgba(255,255,255,0.15); }
  .scn-count strong { color: var(--gold-light); font-family: var(--font-heading); font-size: 1.1rem; }

  .scn-trouble { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-width: 420px; width: 100%; margin: 0 auto; }
  .scn-trouble > i { font-size: 1.8rem; color: var(--bad); background: var(--bad-bg); width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; }
  .scn-trouble h2 { font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem; color: var(--navy); }
  .scn-trouble p { color: var(--gray-600); line-height: 1.6; }

  /* The thumb's zone: the fallback is always one reach away, never hidden behind a menu. */
  .scn-dock {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
    padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(15,25,46,0) 0%, var(--navy) 35%);
  }
  .scn-search-btn {
    width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--white); color: var(--navy); border: 0; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font-heading); font-weight: 700; font-size: 1rem; box-shadow: var(--shadow-lg);
  }
  .scn-search-btn:hover { background: var(--gold-light); }

  @media (min-width: 640px) {
    .scn-dock { left: 50%; right: auto; width: 480px; transform: translateX(-50%); background: none; bottom: 12px; }
    .scn-stage { padding-top: 32px; }
  }
`

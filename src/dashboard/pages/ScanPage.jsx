import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/apiClient'
import {
  listMarshalCheckpoints, scanCode, boardDelegate, formatDay, kindMeta, isPostGone, progressPct, readPost, writePost, isBadgeCode,
  tallyVerb, CAMERA_TROUBLE, GATE_POST, DESK_POST,
} from '@/lib/checkin'
import { useAuth } from '@/auth/AuthContext'
import { canManageCheckIn, canWorkGate } from '../dashboardNav'
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
import { SCN_CSS } from '../components/checkin/scanShellCss'

/**
 * The one scanner: a full-screen page (no dashboard chrome) built for one hand and bright sun.
 *
 * <p>Pick a post — the main gate, the Secretariat desk, or one of today's checkpoints — then point
 * the camera at badges. The gate checks delegates in and says Desk A or Desk B ({@link GateStation});
 * the desk takes balances and hands over the ID & receipt and the kit ({@link DeskStation}).
 * Everything below is the checkpoint side.</p>
 *
 * <p>At a checkpoint, each code goes to the API, which returns a
 * verdict — green, amber or red with a reason — and the result sheet shows it over the camera. At a
 * bus the scan is only a look: the sheet shows their booking and the marshal's Board tap boards them.
 * When a badge won't read, the bar at the bottom opens a search by name. There is no offline mode:
 * a verdict needs the server, and a guard without signal sends people to the Secretariat desk.</p>
 */
export default function ScanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { signOut, touch } = useIdleSignOut()
  // The gate is the marshals' and the desk the secretariat's, as on the API; an admin works both. A
  // phone remembered on one post and then signed in as someone who can't work it lands on the post list.
  const canGate = canWorkGate(user?.roles)
  const canDesk = canManageCheckIn(user?.roles)
  const { loading, error, data: checkpoints, reload } = useAsync(listMarshalCheckpoints, [])

  const [postId, setPostId] = useState(readPost)
  const atGate = canGate && postId === GATE_POST
  const atDesk = canDesk && postId === DESK_POST
  const [mode, setMode] = useState('scan')
  const [camera, setCamera] = useState('ok')
  const [cameraKey, setCameraKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  // How the person on the sheet was found — { code } scanned or { delegateId } by name — so the Board
  // tap sends the same.
  const [source, setSource] = useState(null)
  const [counts, setCounts] = useState({})
  // The checkpoint the server just refused as closed or not today's, and the list it was refused
  // against. That list stays on screen while a fresh one loads, so the refused tile is left off it by
  // hand — but only off that list: the fresh one is the server's word, including on a reopened checkpoint.
  const [gone, setGone] = useState(null)
  // Bumped whenever the sheet changes hands — a new scan, Next, Change — so a Board reply that comes
  // back after that is dropped rather than shown over someone else.
  const sheet = useRef(0)

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
    sheet.current += 1
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
    sheet.current += 1
    setBusy(true)
    setSource({ code })
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
    sheet.current += 1
    setResult(null)
    setSource(null)
    setBusy(false)
    setMode('scan')
  }, [])

  // The Board tap, with the booking the marshal was shown: if it changed since, the API boards nobody.
  const board = async () => {
    touch()
    const mine = sheet.current
    try {
      const reply = await boardDelegate(checkpoint.id, { ...source, from: result.boarding?.bookedBatchId })
      if (mine === sheet.current) show(reply, checkpoint.id)
    } catch (err) {
      if (mine !== sheet.current) return
      // The bus checkpoint was deleted while the sheet was up: back to the picker, as a scan does.
      if (err instanceof ApiError && err.status === 404) change()
      else setResult({ result: 'error', reason: `${err.message} Scan again, or search by name.` })
    }
  }

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
        canGate={canGate}
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
        onResult={(r, note) => { setSource({ delegateId: r.delegate?.id, note }); show(r, checkpoint.id) }}
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

      {result && (
        <ScanResultSheet
          response={result}
          kind={checkpoint?.kind}
          onNext={stale ? change : next}
          onAct={checkpoint?.kind === 'Tour' && source ? board : undefined}
        />
      )}

      <style>{DASH_CSS}</style>
      <style>{SCN_CSS}</style>
    </div>
  )
}

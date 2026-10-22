import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/apiClient'
import {
  listMarshalCheckpoints, scanCode, boardDelegate, formatDay, kindMeta, isPostGone, progressPct, readPost, writePost, isBadgeCode,
  tallyVerb, isQuickResult, CAMERA_TROUBLE, GATE_POST, DESK_POST,
} from '@/lib/checkin'
import { useAuth } from '@/auth/AuthContext'
import { canManageCheckIn, canWorkGate } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { useIdleSignOut } from '../useIdleSignOut'
import { Loading, ErrorState } from '../components/states'
import CheckpointPicker from '../components/checkin/CheckpointPicker'
import QrViewfinder from '../components/checkin/QrViewfinder'
import ScanResultSheet from '../components/checkin/ScanResultSheet'
import ScanStrip from '../components/checkin/ScanStrip'
import ManualSearch from '../components/checkin/ManualSearch'
import BusList from '../components/checkin/BusList'
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
 * At a session door a pass is only a strip under the camera, which reads on — the next badge replaces
 * it, or it clears after three seconds; meals and buses keep the sheet, which waits for a tap.
 * When a badge won't read, the bar at the bottom opens a search by name. There is no offline mode:
 * a verdict needs the server, and a guard without signal sends people to the Secretariat desk.</p>
 *
 * <p>At a bus the dock also opens the bus's list, for a headcount before it leaves (ATOP,
 * 2026-10-21). And a phone opened on the wrong bus gives itself away: everyone scanned is booked on
 * the same other one. After {@link WRONG_BUS_STREAK} of those in a row the sheet asks whether the
 * marshal is at that bus, and offers to switch to it, before anyone is moved off it by mistake.</p>
 */
// Wrong-bus scans in a row, all booked on one other bus, before the sheet asks whether this is the
// right bus. Two would catch a couple travelling together; three is a pattern.
const WRONG_BUS_STREAK = 3

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
  // A badge with the server right now. The strip's timer can run out in the same frame the next badge
  // is read, before `busy` reaches it; while this is set, that timer leaves the screen alone.
  const inFlight = useRef(false)
  // Consecutive scans here booked on one other bus — { batchId, tour, n } — and the buses the marshal
  // has already said "I'm at the right bus" about, so the question isn't asked again for them.
  const [streak, setStreak] = useState(null)
  const [keptBus, setKeptBus] = useState(() => new Set())

  // A remembered checkpoint the secretariat has since closed simply isn't in the list any more.
  const checkpoint = checkpoints?.find((c) => c.id === postId) || null
  const count = checkpoint ? counts[checkpoint.id] ?? checkpoint.scanCount : 0
  // The headcount comes with the list and holds until the next refresh: it only moves when a booking pays.
  const pct = checkpoint ? progressPct(count, checkpoint.expected) : 0
  // Only a session door reads on behind a pass. A meal or a bus waits for the guard's tap.
  const quickPost = checkpoint?.kind === 'Entry'
  const quick = quickPost && isQuickResult(result)

  const pick = (c) => {
    writePost(c.id)
    setPostId(c.id)
    setMode('scan')
    setStreak(null)
  }

  const pickPost = (post) => {
    writePost(post)
    setPostId(post)
  }

  const change = () => {
    sheet.current += 1
    inFlight.current = false
    writePost(null)
    setPostId(null)
    setResult(null)
    setBusy(false)
    setStreak(null)
    // The fresh list carries every marshal's count; this phone's last number would hide theirs.
    setCounts({})
    reload()
  }

  const show = useCallback((response, checkpointId) => {
    setResult(response)
    // Only a scan's verdict counts towards the streak: someone booked here breaks it, someone booked
    // on another bus adds to it if it's the same other bus. A Board reply, a refusal or a failure
    // says nothing about which bus this is.
    if (response.reasonCode === 'board_own') setStreak(null)
    else if (response.reasonCode === 'board_other' && response.boarding?.bookedBatchId) {
      const { bookedBatchId: batchId, bookedTour: tour } = response.boarding
      setStreak((s) => ({ batchId, tour, n: s?.batchId === batchId ? s.n + 1 : 1 }))
    }
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
    const mine = sheet.current
    inFlight.current = true
    setBusy(true)
    setSource({ code })
    try {
      const reply = await scanCode(checkpoint.id, code)
      // Change was tapped while it was out: the reply is for a post no longer open, so it isn't shown or counted.
      if (mine !== sheet.current) return
      inFlight.current = false
      show(reply, checkpoint.id)
      setBusy(false)
    } catch (err) {
      if (mine !== sheet.current) return
      inFlight.current = false
      if (err instanceof ApiError && err.status === 404) {
        // The checkpoint was deleted under us. Back to the picker, with a fresh list.
        change()
        return
      }
      setResult({ result: 'error', reason: `${err.message} Scan again, or search by name.` })
      setBusy(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoint, show, touch])

  // A checkpoint the secretariat closed mid-shift, or a phone left on yesterday's overnight: the
  // server refuses it, and the next tap goes straight back to the picker, which lists neither.
  const stale = isPostGone(result?.reasonCode)

  const next = useCallback(() => {
    // The next badge is already with the server: its reply takes the screen, so there is nothing to clear.
    if (inFlight.current) return
    sheet.current += 1
    setResult(null)
    setSource(null)
    setBusy(false)
    setMode('scan')
  }, [])

  // The Board tap, with the booking the marshal was shown: if it changed since, the API boards nobody.
  // The dock's search and bus list close a pass strip first: left up, its timer's Next would send the
  // marshal back to the camera mid-search. Held while a badge is with the server, a second at most.
  const open = (to) => {
    sheet.current += 1
    setResult(null)
    setSource(null)
    setMode(to)
  }

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

  // Asked on the sheet itself, before the marshal reaches for Board here instead.
  const suspect = checkpoint?.kind === 'Tour' && streak && streak.n >= WRONG_BUS_STREAK
    && result?.reasonCode === 'board_other' && !keptBus.has(streak.batchId)
  const rightBus = suspect ? checkpoints?.find((c) => c.kind === 'Tour' && c.tourBatchId === streak.batchId) : null
  const wrongBus = suspect && (
    <div className="scn-wrongbus" onClick={(e) => e.stopPropagation()}>
      <p>
        <i className="fas fa-triangle-exclamation" aria-hidden="true" />{' '}
        <strong>{streak.n} in a row are booked on {streak.tour}.</strong> Are you at that bus?
      </p>
      {rightBus ? (
        <button type="button" className="dash-btn is-primary" onClick={() => { next(); pick(rightBus) }}>
          <i className="fas fa-right-left" aria-hidden="true" /> Switch to {rightBus.label}
        </button>
      ) : (
        <p className="scn-wrongbus-hint">That bus isn&rsquo;t open on this phone. Tap Change and pick it, or ask the admin to open it.</p>
      )}
      <button type="button" className="dash-btn is-ghost" onClick={() => { setKeptBus((k) => new Set(k).add(streak.batchId)); setStreak(null) }}>
        I&rsquo;m at the right bus
      </button>
    </div>
  )

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
        onBookTours={canDesk ? () => navigate('/scan/tours') : undefined}
        canGate={canGate}
        canDesk={canDesk}
        onRefresh={reload}
        refreshing={loading}
      />
    )
  }
  else if (mode === 'list') body = <BusList checkpoint={checkpoint} onClose={() => setMode('scan')} />
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
          <QrViewfinder key={cameraKey} ready={!busy && (!result || quick)} onCode={handleCode} onUnavailable={setCamera} />
        )}
        <p className="scn-aim">
          {trouble ? ' ' : busy ? 'Checking…' : 'Point at the QR code'}
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
              <span className={`scn-post-label${checkpoint.kind === 'Tour' ? ' is-bus' : ''}`}>{checkpoint.label}</span>
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
          <button type="button" className="scn-search-btn" onClick={() => open('search')} disabled={busy}>
            <i className="fas fa-magnifying-glass" aria-hidden="true" /> Search by name
          </button>
          {checkpoint.kind === 'Tour' && (
            <button type="button" className="scn-search-btn" onClick={() => open('list')} disabled={busy}>
              <i className="fas fa-list-check" aria-hidden="true" /> Bus list
            </button>
          )}
        </div>
      )}

      {result && (quick ? (
        <ScanStrip response={result} kind={checkpoint.kind} checking={busy} onNext={next} />
      ) : (
        <ScanResultSheet
          response={result}
          kind={checkpoint?.kind}
          onNext={stale ? change : next}
          onAct={checkpoint?.kind === 'Tour' && source ? board : undefined}
          swipe={quickPost}
          notice={wrongBus}
        />
      ))}

      <style>{DASH_CSS}</style>
      <style>{SCN_CSS}</style>
    </div>
  )
}

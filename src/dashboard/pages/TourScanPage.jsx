import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/apiClient'
import { lookupTour, bookTour, isBadgeCode, formatDay, CAMERA_TROUBLE } from '@/lib/checkin'
import { useIdleSignOut } from '../useIdleSignOut'
import QrViewfinder from '../components/checkin/QrViewfinder'
import { DASH_CSS } from '../DashboardLayout'
import { SCN_CSS } from '../components/checkin/scanShellCss'

/**
 * The tour scanner (ATOP, 2026-10-20): delegates already in the venue are booked on a tour by badge
 * instead of on paper. Scan, ask which tour, tap the batch — one tap books or moves them, and a wrong
 * tap is fixed by tapping the right one.
 *
 * <p>Not linked from the scanner or the dashboard: only marshals who were briefed open it, at
 * /scan/tours. A full batch is refused and they go to the tech booth; nobody here books past capacity.</p>
 */
export default function TourScanPage() {
  const navigate = useNavigate()
  const { touch } = useIdleSignOut()
  const [camera, setCamera] = useState('ok')
  const [cameraKey, setCameraKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState(null)
  const [card, setCard] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [booked, setBooked] = useState([])
  // Bumped on every new scan and on Next, so a slow reply never lands on the next person's card.
  const turn = useRef(0)

  const handleCode = useCallback(async (text) => {
    touch()
    if (!isBadgeCode(text)) {
      setNotice({ tone: 'bad', text: 'That isn’t an ATOP badge. Scan the QR on their pass.' })
      return
    }
    const mine = ++turn.current
    setBusy(true)
    setNotice(null)
    try {
      const found = await lookupTour(text)
      if (mine !== turn.current) return
      setCode(text)
      setCard(found)
    } catch (err) {
      if (mine !== turn.current) return
      setNotice({ tone: 'bad', text: err instanceof ApiError && err.status === 404
        ? 'Code not recognised. Send them to the tech booth.'
        : `${err.message} Scan again.` })
    } finally {
      if (mine === turn.current) setBusy(false)
    }
  }, [touch])

  const next = () => {
    turn.current += 1
    setCard(null)
    setCode(null)
    setNotice(null)
    setBusy(false)
    setSavingId(null)
  }

  const book = async (pkg, batch) => {
    if (savingId || batch.id === card.tourBatchId) return
    touch()
    const mine = turn.current
    const from = card.tourBatchId ? `${card.tourPackageName} — ${card.tourBatchLabel}` : null
    const to = `${pkg.name} — ${batch.label}`
    setSavingId(batch.id)
    setNotice(null)
    try {
      const reply = await bookTour(code, batch.id)
      if (mine !== turn.current) return
      setCard(reply.scan)
      setNotice({ tone: 'good', text: reply.outcome === 'Moved' ? `Moved from ${from} to ${to}.` : `Booked on ${to}.` })
      setBooked((list) => [
        { id: `${reply.scan.delegateId}-${Date.now()}`, name: reply.scan.fullName, tour: to, moved: reply.outcome === 'Moved' },
        ...list.filter((b) => !b.id.startsWith(reply.scan.delegateId)),
      ].slice(0, 30))
    } catch (err) {
      if (mine !== turn.current) return
      setNotice({ tone: 'bad', text: err.message })
      // Seats moved under us: show the live counts.
      try {
        const fresh = await lookupTour(code)
        if (mine === turn.current) setCard(fresh)
      } catch { /* the notice already says what failed */ }
    } finally {
      if (mine === turn.current) setSavingId(null)
    }
  }

  const trouble = CAMERA_TROUBLE[camera]

  return (
    <div className={`scn-shell${card ? '' : ' is-scanning'}`}>
      <header className="scn-bar">
        <div className="scn-post">
          <span className="scn-post-day"><i className="fas fa-bus" aria-hidden="true" /> Book a tour</span>
          <span className="scn-post-label">Tour booking</span>
        </div>
        <button type="button" className="scn-bar-btn" onClick={() => navigate('/scan')}>Scanner</button>
      </header>

      <main className="scn-main">
        {card ? (
          <div className="tsc-card">
            <div className="dash-card dash-card-pad tsc-who">
              <h2>{card.fullName}</h2>
              <p className="tsc-sub">{[card.lgu, card.designation].filter(Boolean).join(' · ')}</p>
              <p className="tsc-code">{card.referenceCode}</p>
              <p className="tsc-now">
                <span>Tour</span>
                <strong>{card.tourBatchId ? `${card.tourPackageName} — ${card.tourBatchLabel}` : 'None yet'}</strong>
              </p>
            </div>

            {notice && <p className={`tsc-notice is-${notice.tone}`} role="status">{notice.text}</p>}

            {!card.canChoose ? (
              <p className="tsc-notice is-bad">{card.ineligibleReason || 'This delegate can’t join a tour.'} Send them to the tech booth.</p>
            ) : (
              <>
                <p className="tsc-ask">Ask which tour, then tap it.</p>
                {card.packages.map((pkg) => (
                  <section key={pkg.id} className="tsc-pkg">
                    <h3>{pkg.name}</h3>
                    {pkg.batches.map((b) => {
                      const current = b.id === card.tourBatchId
                      const full = b.isFull && !current
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`tsc-batch${current ? ' is-current' : ''}`}
                          disabled={full || current || !!savingId}
                          onClick={() => book(pkg, b)}
                        >
                          <span className="tsc-batch-main">
                            <strong>{b.label}</strong>
                            <span>{[b.tourDate && formatDay(b.tourDate), b.session, b.assemblyTime].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span className="tsc-batch-seats">
                            {savingId === b.id ? 'Booking…' : current ? 'Booked' : full ? 'Full' : `${b.seatsLeft} left`}
                          </span>
                        </button>
                      )
                    })}
                  </section>
                ))}
              </>
            )}
          </div>
        ) : (
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
              <QrViewfinder key={cameraKey} ready={!busy && !card} onCode={handleCode} onUnavailable={setCamera} lastCode={code} />
            )}
            <p className="scn-aim">{busy ? 'Checking…' : 'Scan their QR'}</p>
            {notice && <p className={`tsc-notice is-${notice.tone}`} role="status">{notice.text}</p>}

            {booked.length > 0 && (
              <section className="tsc-log" aria-label="Booked on this phone">
                <h3>Booked on this phone</h3>
                <ul>
                  {booked.map((b) => (
                    <li key={b.id}><strong>{b.name}</strong><span>{b.moved ? 'Moved to ' : ''}{b.tour}</span></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>

      {card && (
        <div className="scn-dock">
          <button type="button" className="scn-search-btn" onClick={next}>
            <i className="fas fa-qrcode" aria-hidden="true" /> Next scan
          </button>
        </div>
      )}

      <style>{DASH_CSS}</style>
      <style>{SCN_CSS}</style>
      <style>{TSC_CSS}</style>
    </div>
  )
}

const TSC_CSS = `
  .scn-stage { padding-bottom: 40px; }
  .scn-dock { background: linear-gradient(180deg, rgba(247,247,247,0) 0%, var(--off-white) 35%); }
  .scn-search-btn { background: var(--navy); color: var(--white); }
  .scn-search-btn:hover { background: var(--navy); color: var(--gold-light); }
  .tsc-card { display: flex; flex-direction: column; gap: 12px; padding: 16px 16px 110px; width: 100%; max-width: 560px; margin: 0 auto; }
  .tsc-who h2 { font-family: var(--font-heading); font-weight: 800; font-size: 1.3rem; color: var(--navy); }
  .tsc-sub { color: var(--gray-600); margin-top: 2px; }
  .tsc-code { font-family: monospace; color: var(--gray-600); font-size: 0.85rem; margin-top: 4px; }
  .tsc-now { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--gray-200); }
  .tsc-now span { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); }
  .tsc-now strong { font-family: var(--font-heading); font-size: 1.05rem; color: var(--navy); }
  .tsc-notice { padding: 12px 14px; border-radius: var(--radius-sm); font-weight: 600; line-height: 1.45; }
  .tsc-notice.is-good { background: var(--ok-bg); color: var(--ok); }
  .tsc-notice.is-bad { background: var(--bad-bg); color: var(--bad); }
  .tsc-ask { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
  .tsc-pkg { display: flex; flex-direction: column; gap: 6px; }
  .tsc-pkg h3 { font-family: var(--font-heading); font-weight: 800; font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); margin-top: 6px; }
  .tsc-batch {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; padding: 10px 14px;
    background: var(--white); border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); cursor: pointer; text-align: left;
  }
  .tsc-batch:hover:not(:disabled) { border-color: var(--navy); }
  .tsc-batch:disabled { cursor: default; }
  .tsc-batch:disabled:not(.is-current) { opacity: 0.5; }
  .tsc-batch.is-current { border-color: var(--ok); background: var(--ok-bg); }
  .tsc-batch-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .tsc-batch-main strong { color: var(--navy); font-family: var(--font-heading); }
  .tsc-batch-main span { color: var(--gray-600); font-size: 0.85rem; }
  .tsc-batch-seats { flex-shrink: 0; font-family: var(--font-heading); font-weight: 700; font-size: 0.85rem; color: var(--navy); }
  .tsc-batch.is-current .tsc-batch-seats { color: var(--ok); }
  .tsc-log { width: min(100%, 480px); margin: 8px auto 0; background: rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 12px 14px; }
  .tsc-log h3 { color: var(--gold-light); font-family: var(--font-heading); font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px; }
  .tsc-log ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .tsc-log li { display: flex; flex-direction: column; color: var(--white); font-size: 0.88rem; }
  .tsc-log li span { color: rgba(255,255,255,0.7); }
`

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import SeatQr from '@/dashboard/components/SeatQr'
import WelcomeOverlay from './WelcomeOverlay'
import { usePassStatus } from './usePassStatus'
import {
  conventionDay, dayLabel, formatClock, hostCityName, longDate, nextStep, phaseChip, phaseOf, timeAt, welcomeFor,
} from './passCopy'

/**
 * A delegate's live pass, at /pass/:token (ATOP, 2026-10-11). The QR they were always given, on a
 * page that knows where they are in the convention: a countdown before it, the one next step during
 * it, and a welcome on their own screen the moment the gate scans them.
 *
 * Public on purpose — delegates have no accounts. The link is the credential, and the page shows
 * only what the pass picture already did plus their own progress: no phone, no email, no amounts.
 */
export default function PassPage() {
  const { token: raw } = useParams()
  const navigate = useNavigate()
  // A share sheet's "Copy" can glue the message onto the link ("…/pass/<token> Ramon, here is your
  // pass…"), and pasting that whole line into a browser sends it all here. A token never holds a
  // space, so everything from the first one on was never part of it.
  const token = raw.split(/\s/)[0]

  // Put the clean link back in the address bar, so a bookmark or Add to Home Screen saves that one.
  useEffect(() => {
    if (token !== raw) navigate(`/pass/${token}`, { replace: true })
  }, [token, raw, navigate])

  const { pass, status, updatedAt, fresh, clearFresh } = usePassStatus(token)

  useEffect(() => {
    if (pass) document.title = `${pass.greetingName}'s pass — ATOP`
  }, [pass])

  const welcome = useMemo(() => (pass && fresh.length ? welcomeFor(pass, fresh) : null), [pass, fresh])

  if (!pass) {
    return (
      <Shell>
        {status === 'missing' ? (
          <StateCard icon="fa-link-slash" title="This link doesn't open a pass">
            It may have been mistyped or cut short when it was forwarded. Ask whoever booked your seat to
            send it again from their booking page.
          </StateCard>
        ) : status === 'offline' ? (
          <StateCard icon="fa-wifi" title="Can't reach ATOP right now">
            Check your connection — this page tries again by itself. Once it has opened once, your pass
            works even without signal.
          </StateCard>
        ) : (
          <div className="lp-loading" aria-live="polite"><i className="fas fa-circle-notch fa-spin" /> Opening your pass…</div>
        )}
      </Shell>
    )
  }

  return (
    <Shell pass={pass}>
      {welcome && <WelcomeOverlay title={welcome.title} line={welcome.line} onDone={clearFresh} />}
      {pass.state === 'active' ? <ActivePass pass={pass} /> : <InactivePass pass={pass} />}
      <Freshness status={status} updatedAt={updatedAt} />
    </Shell>
  )
}

function ActivePass({ pass }) {
  const phase = phaseOf(pass)
  const step = nextStep(pass, phase)
  const city = hostCityName(pass.event)

  return (
    <>
      <section className="lp-ticket" aria-label="Your pass">
        <div className="lp-ticket-top">
          <p className="lp-hello">
            {pass.checkedInAt ? `Welcome to ${city},` : phase.kind === 'before' ? 'See you soon,' : 'Hello,'}
          </p>
          <h1 className="lp-name">{pass.greetingName}</h1>
          <p className="lp-fullname">{pass.fullName}{pass.where ? ` · ${pass.where}` : ''}</p>
        </div>

        <div className="lp-qr">
          <SeatQr code={pass.referenceCode} size={248} />
          <code className="lp-code">{pass.referenceCode}</code>
        </div>

        <div className="lp-ticket-tear" aria-hidden="true" />

        <div className={`lp-status ${pass.checkedInAt ? 'is-in' : ''}`}>
          {pass.checkedInAt ? (
            <><i className="fas fa-circle-check" aria-hidden="true" /> Checked in at {timeAt(pass.checkedInAt)}</>
          ) : (
            <><i className="fas fa-qrcode" aria-hidden="true" /> Ready to scan at the main gate</>
          )}
        </div>
      </section>

      <section className={`lp-step tone-${step.tone}`} aria-live="polite">
        <span className="lp-step-icon" aria-hidden="true"><i className={`fas ${step.icon}`} /></span>
        <div>
          <p className="lp-step-kicker">Your next step</p>
          <h2 className="lp-step-title">{step.title}</h2>
          <p className="lp-step-body">{step.body}</p>
        </div>
      </section>

      <Timeline pass={pass} />
      <Tips />

      <p className="lp-foot">
        Booking {pass.bookingReference} · {pass.event.venueName}
      </p>
    </>
  )
}

/** The programme as this delegate lives it: each session, and whether they were counted there. */
function Timeline({ pass }) {
  const days = useMemo(() => {
    const byDay = new Map()
    for (const s of pass.sessions) byDay.set(s.day, [...(byDay.get(s.day) || []), s])
    return [...byDay.entries()]
  }, [pass.sessions])

  if (!days.length && !pass.tour) return null
  const { total } = phaseOf(pass)

  return (
    <section className="lp-card" aria-label="My convention">
      <h2 className="lp-card-title"><i className="fas fa-route" aria-hidden="true" /> My convention</h2>

      {days.map(([day, sessions]) => {
        // A checkpoint the Secretariat dated outside the convention (a rehearsal, a pre-event
        // briefing) gets its date only — "Day -12" means nothing to a delegate.
        const n = conventionDay(pass.event, day)
        return (
          <div key={day} className="lp-day">
            <p className="lp-day-label">
              {n >= 1 && n <= total ? `Day ${n} · ` : ''}{dayLabel(day)}{day === pass.today ? ' · Today' : ''}
            </p>
            <ol className="lp-tl">
              {sessions.map((s) => {
                const state = s.attendedAt ? 'done' : s.isOpen ? 'now' : day < pass.today ? 'missed' : 'next'
                return (
                  <li key={s.id} className={`lp-tl-item is-${state}`}>
                    <span className="lp-tl-dot" aria-hidden="true">
                      {state === 'done' && <i className="fas fa-check" />}
                    </span>
                    <div>
                      <p className="lp-tl-label">{s.label}</p>
                      <p className="lp-tl-note">
                        {state === 'done' && `Attendance recorded · ${timeAt(s.attendedAt)}`}
                        {state === 'now' && 'Happening now — show your QR at the door'}
                        {state === 'missed' && 'Not recorded'}
                        {state === 'next' && 'Coming up'}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )
      })}

      {pass.tour && (
        <div className="lp-day">
          <p className="lp-day-label">Tour{pass.tour.day ? ` · ${dayLabel(pass.tour.day)}` : ''}</p>
          <ol className="lp-tl">
            <li className={`lp-tl-item is-${pass.tour.boardedAt ? 'done' : 'next'}`}>
              <span className="lp-tl-dot" aria-hidden="true">
                {pass.tour.boardedAt ? <i className="fas fa-check" /> : <i className="fas fa-bus" />}
              </span>
              <div>
                <p className="lp-tl-label">{pass.tour.package} — {pass.tour.batch}</p>
                <p className="lp-tl-note">
                  {pass.tour.boardedAt
                    ? `On board · ${timeAt(pass.tour.boardedAt)}`
                    : `Assembly ${formatClock(pass.tour.assemblyTime)}${pass.tour.assemblyPoint ? ` at ${pass.tour.assemblyPoint}` : ''} — show your QR as you board`}
                </p>
              </div>
            </li>
          </ol>
        </div>
      )}
    </section>
  )
}

/** The gate would turn this pass away; the page says why, in the same terms, and shows no QR. */
function InactivePass({ pass }) {
  const copy = {
    cancelled: {
      icon: 'fa-ban', title: 'This pass is no longer active',
      body: 'This seat was cancelled. If that is a surprise, contact whoever booked your seat or the ATOP Secretariat.',
    },
    no_show: {
      icon: 'fa-ban', title: 'This pass is no longer active',
      body: 'This seat was marked as not attending. If you are here after all, please see Desk B.',
    },
    online: {
      icon: 'fa-video', title: "You're joining online",
      body: 'Your seat is a virtual one, so there is no gate pass. The Secretariat sends your stream details before the convention.',
    },
    no_pass: {
      icon: 'fa-hourglass-half', title: 'Your pass is on its way',
      body: 'Your seat is not paid for yet. Your QR appears on this page as soon as it is. Already at the venue? Please go to Desk B.',
    },
  }[pass.state] || { icon: 'fa-circle-info', title: 'This pass is not active', body: 'Please see the ATOP Secretariat.' }

  return (
    <StateCard icon={copy.icon} title={copy.title} name={pass.greetingName} event={pass.event}>
      {copy.body}
    </StateCard>
  )
}

function StateCard({ icon, title, name, event, children }) {
  return (
    <section className="lp-card lp-state">
      <span className="lp-state-icon" aria-hidden="true"><i className={`fas ${icon}`} /></span>
      {name && <p className="lp-hello">Hi {name},</p>}
      <h1 className="lp-state-title">{title}</h1>
      <p className="lp-state-body">{children}</p>
      {event && <p className="lp-foot">{event.name} · {longDate(event.startsAt)}</p>}
    </section>
  )
}

const TIPS_KEY = 'atop-pass-tips-hidden'

/** Getting back here without the email: a home-screen icon, and a brighter screen at the gate. */
function Tips() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(TIPS_KEY) === '1' } catch { return false }
  })
  const standalone = typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone)
  if (hidden) return null

  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const hide = () => {
    setHidden(true)
    try { localStorage.setItem(TIPS_KEY, '1') } catch { /* shows again next time: harmless */ }
  }

  return (
    <section className="lp-card lp-tips" aria-label="Tips">
      {!standalone && (
        <p className="lp-tip">
          <i className="fas fa-mobile-screen-button" aria-hidden="true" />
          <span>
            <strong>Keep it one tap away.</strong>{' '}
            {ios
              ? <>In Safari, tap <i className="fas fa-arrow-up-from-bracket" aria-label="Share" /> then <em>Add to Home Screen</em>.</>
              : <>Open your browser menu <i className="fas fa-ellipsis-vertical" aria-label="menu" /> and choose <em>Add to Home screen</em>.</>}
          </span>
        </p>
      )}
      <p className="lp-tip">
        <i className="fas fa-sun" aria-hidden="true" />
        <span><strong>At the gate,</strong> turn your screen brightness up — the scan is quicker.</span>
      </p>
      <button type="button" className="lp-tips-hide" onClick={hide}>Got it</button>
    </section>
  )
}

function Freshness({ status, updatedAt }) {
  if (status === 'cached' || status === 'offline')
    return (
      <p className="lp-fresh is-off" role="status">
        <i className="fas fa-cloud-arrow-down" aria-hidden="true" /> No connection — showing your saved pass. Your QR still works.
      </p>
    )
  if (!updatedAt) return null
  return (
    <p className="lp-fresh" role="status">
      <span className="lp-live-dot" aria-hidden="true" /> Live · updated {updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
    </p>
  )
}

function Shell({ pass, children }) {
  const chip = pass?.state === 'active' ? phaseChip(phaseOf(pass)) : null
  return (
    <div className="lp">
      <header className="lp-head">
        <img src="/Untitled.png" alt="ATOP" className="lp-logo" />
        <div className="lp-head-text">
          <span className="lp-event">{pass?.event.name || 'ATOP Convention'}</span>
          {pass && <span className="lp-dates">{longDate(pass.event.startsAt)}</span>}
        </div>
        {chip && <span className="lp-chip">{chip}</span>}
      </header>
      <main className="lp-main">{children}</main>
      <style>{PASS_CSS}</style>
    </div>
  )
}

const PASS_CSS = `
  .lp { min-height: 100dvh; background: var(--off-white); color: var(--text-body); font-family: var(--font-body); }
  .lp-head {
    display: flex; align-items: center; gap: 12px; padding: 16px 16px 72px;
    background: linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 60%, var(--navy-light) 100%);
    color: var(--white);
  }
  .lp-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; background: var(--white); padding: 3px; }
  .lp-head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .lp-event { font-family: var(--font-heading); font-weight: 700; font-size: 0.92rem; line-height: 1.2; }
  .lp-dates { font-size: 0.76rem; color: rgba(255, 255, 255, 0.7); }
  .lp-chip {
    flex-shrink: 0; padding: 6px 12px; border-radius: 999px; font-family: var(--font-heading);
    font-weight: 800; font-size: 0.78rem; color: var(--navy);
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
  }
  .lp-main { max-width: 440px; margin: -56px auto 0; padding: 0 16px 32px; display: flex; flex-direction: column; gap: 14px; }
  .lp-loading { background: var(--white); border-radius: 18px; padding: 48px 16px; text-align: center; color: var(--gray-600); box-shadow: var(--shadow-md); }

  .lp-ticket {
    background: var(--white); border-radius: 22px; box-shadow: var(--shadow-lg); overflow: hidden;
    border-top: 5px solid var(--gold);
  }
  .lp-ticket-top { padding: 20px 20px 4px; text-align: center; }
  .lp-hello { margin: 0; font-size: 0.9rem; color: var(--gray-600); }
  .lp-name {
    margin: 2px 0 0; font-family: var(--font-heading); font-weight: 800; color: var(--navy);
    font-size: clamp(1.8rem, 9vw, 2.3rem); line-height: 1.1; overflow-wrap: anywhere;
  }
  .lp-fullname { margin: 6px 0 0; font-size: 0.86rem; color: var(--gray-600); }
  .lp-qr { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 20px 18px; }
  .lp-qr .sq { border: none; padding: 0; cursor: default; }
  .lp-code {
    font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem; letter-spacing: 0.1em;
    color: var(--navy); font-variant-numeric: tabular-nums; background: none;
  }
  .lp-ticket-tear { position: relative; border-top: 2px dashed var(--gray-200); margin: 0 18px; }
  .lp-ticket-tear::before, .lp-ticket-tear::after {
    content: ''; position: absolute; top: -12px; width: 22px; height: 22px; border-radius: 50%; background: var(--off-white);
  }
  .lp-ticket-tear::before { left: -30px; }
  .lp-ticket-tear::after { right: -30px; }
  .lp-status {
    display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 16px;
    font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; color: var(--navy-light);
  }
  .lp-status.is-in { color: var(--ok); }

  .lp-step {
    display: flex; gap: 14px; align-items: flex-start; padding: 16px; border-radius: 18px;
    background: var(--white); box-shadow: var(--shadow-md); border-left: 5px solid var(--navy-light);
  }
  .lp-step.tone-go { border-left-color: var(--gold); }
  .lp-step.tone-warn { border-left-color: var(--warn); background: var(--warn-bg); }
  .lp-step.tone-done { border-left-color: var(--ok); }
  .lp-step-icon {
    flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
    background: var(--navy); color: var(--gold-light); font-size: 1.1rem;
  }
  .lp-step.tone-warn .lp-step-icon { background: var(--warn); color: var(--white); }
  .lp-step.tone-done .lp-step-icon { background: var(--ok); color: var(--white); }
  .lp-step-kicker { margin: 0; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gray-400); }
  .lp-step-title { margin: 2px 0 0; font-family: var(--font-heading); font-size: 1.08rem; font-weight: 800; color: var(--navy); line-height: 1.25; }
  .lp-step-body { margin: 4px 0 0; font-size: 0.9rem; line-height: 1.5; }

  .lp-card { background: var(--white); border-radius: 18px; padding: 16px; box-shadow: var(--shadow-md); }
  .lp-card-title { margin: 0 0 6px; font-family: var(--font-heading); font-size: 1rem; font-weight: 800; color: var(--navy); display: flex; gap: 8px; align-items: center; }
  .lp-card-title i { color: var(--gold); }
  .lp-day { margin-top: 12px; }
  .lp-day-label { margin: 0 0 8px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-400); }
  .lp-tl { list-style: none; margin: 0; padding: 0; }
  .lp-tl-item { position: relative; display: flex; gap: 12px; padding-bottom: 14px; }
  .lp-tl-item:not(:last-child)::before {
    content: ''; position: absolute; left: 11px; top: 26px; bottom: 2px; width: 2px; background: var(--gray-200);
  }
  .lp-tl-dot {
    flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
    border: 2px solid var(--gray-200); background: var(--white); font-size: 0.7rem; color: var(--gray-400);
  }
  .lp-tl-item.is-done .lp-tl-dot { background: var(--ok); border-color: var(--ok); color: var(--white); }
  .lp-tl-item.is-now .lp-tl-dot { border-color: var(--gold); background: var(--gold-light); animation: lp-pulse 1.6s ease-out infinite; }
  .lp-tl-label { margin: 1px 0 0; font-weight: 700; color: var(--navy); font-size: 0.94rem; }
  .lp-tl-note { margin: 2px 0 0; font-size: 0.82rem; color: var(--gray-600); }
  .lp-tl-item.is-done .lp-tl-note { color: var(--ok); }
  .lp-tl-item.is-now .lp-tl-note { color: var(--gold-dark); font-weight: 600; }
  .lp-tl-item.is-missed .lp-tl-label { color: var(--gray-400); }
  @keyframes lp-pulse {
    0% { box-shadow: 0 0 0 0 rgba(200, 168, 75, 0.5) }
    100% { box-shadow: 0 0 0 10px rgba(200, 168, 75, 0) }
  }

  .lp-tips { display: flex; flex-direction: column; gap: 10px; background: var(--navy); color: rgba(255, 255, 255, 0.86); }
  .lp-tip { margin: 0; display: flex; gap: 12px; font-size: 0.86rem; line-height: 1.5; }
  .lp-tip > i { color: var(--gold); margin-top: 3px; width: 16px; text-align: center; }
  .lp-tip strong { color: var(--white); }
  .lp-tips-hide {
    align-self: flex-end; border: 1px solid rgba(255, 255, 255, 0.3); background: none; color: var(--white);
    border-radius: 999px; padding: 6px 14px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }

  .lp-state { text-align: center; padding: 28px 20px; }
  .lp-state-icon {
    width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%; display: grid; place-items: center;
    background: var(--gray-100); color: var(--navy-light); font-size: 1.6rem;
  }
  .lp-state-title { margin: 4px 0 0; font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800; color: var(--navy); }
  .lp-state-body { margin: 10px auto 0; max-width: 32ch; font-size: 0.92rem; line-height: 1.55; }

  .lp-foot { margin: 4px 0 0; text-align: center; font-size: 0.76rem; color: var(--gray-400); }
  .lp-fresh { margin: 0; display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 0.76rem; color: var(--gray-400); }
  .lp-fresh.is-off { color: var(--warn); }
  .lp-live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); animation: lp-blink 2s ease-in-out infinite; }
  @keyframes lp-blink { 50% { opacity: 0.3 } }

  @media (prefers-reduced-motion: reduce) {
    .lp-tl-item.is-now .lp-tl-dot, .lp-live-dot { animation: none; }
  }
`

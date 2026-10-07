import { useEffect, useRef } from 'react'
import DelegateFace from './DelegateFace'
import { RESULT, GATE_LANE, resultHeadline, formatVenueTime } from '@/lib/checkin'

// Long enough to read a name and where to send them, short enough that a queue keeps moving.
const DISMISS_MS = 4000

/**
 * The verdict on one scan, as a sheet over the camera.
 *
 * <p>Every verdict closes itself after four seconds, or sooner on a tap anywhere on the sheet, and the
 * camera is live again for the next badge. Each one says where to send someone who can't go on, so
 * the guard reads one line and points.</p>
 *
 * <p>At a meal the API sends {@code diet} for a plate handed to someone with dietary needs; it sits at
 * the top, above the name, with an allergy in red.</p>
 *
 * <p>At the main gate the response carries a {@code lane} instead of a checkpoint verdict: Desk A,
 * Desk B or Go in, in letters big enough to read from the queue — never an amount.</p>
 *
 * <p>The phone buzzes once for green and twice for anything else, so a guard watching the queue
 * rather than the screen still knows. iOS has no vibration API and ignores this silently.</p>
 *
 * <p>{@code response} is the API's ScanResponse or GateResponse, or {@code { result: 'error', reason }}
 * when the request itself failed — which gets the red treatment and a nudge to search by name.</p>
 */
export default function ScanResultSheet({ response, kind, onNext }) {
  const button = useRef(null)
  const isError = response.result === 'error'
  const lane = !isError && response.result === 'ok' ? GATE_LANE[response.lane] : null
  const meta = lane || (isError ? RESULT.denied : RESULT[response.result] || RESULT.denied)
  const person = response.delegate
  const diet = person?.diet
  const green = meta.tone === 'ok'
  // The four seconds run from when the sheet opened, whatever the page re-renders meanwhile.
  const next = useRef(onNext)
  useEffect(() => { next.current = onNext }, [onNext])

  useEffect(() => {
    navigator.vibrate?.(green ? 80 : [90, 60, 90])
    const t = setTimeout(() => next.current(), DISMISS_MS)
    // Focus the one action, so a keyboard or a screen reader lands on it.
    button.current?.focus()
    return () => clearTimeout(t)
  }, [green])

  return (
    <div className={`srs tone-${meta.tone}`} role="status" aria-live="assertive" onClick={onNext}>
      <div className={`srs-head${lane ? ' is-lane' : ''}`}>
        <i className={`fas ${meta.icon}`} aria-hidden="true" />
        <span>{isError ? 'Scan failed' : lane ? lane.headline : resultHeadline(response, kind)}</span>
      </div>

      {diet && <DietStrip diet={diet} />}

      {person && (
        <div className="srs-person">
          <DelegateFace name={person.fullName} photoUrl={person.photoUrl} />
          <div className="srs-who">
            <strong>{person.fullName}</strong>
            <span>{[person.designation, person.lgu].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
      )}

      {/* At a bus: theirs when they board, and the right one when this isn't it. */}
      {person?.tour && (
        <p className="srs-tour">
          <i className="fas fa-bus" aria-hidden="true" /> {person.tour}
        </p>
      )}

      {(response.reasonCode === 'already_scanned' || response.reasonCode === 'reentry') && response.scannedAt && (
        <p className="srs-when">
          <i className="fas fa-clock" aria-hidden="true" />
          {response.reasonCode === 'reentry' ? ' First in ' : ' '}{formatVenueTime(response.scannedAt)}
          {response.scannedBy && <> · by {response.scannedBy}</>}
        </p>
      )}

      {lane && (
        <p className="srs-when">
          <i className="fas fa-clock" aria-hidden="true" />
          {response.justCheckedIn ? ' Checked in just now' : ` Already checked in at ${formatVenueTime(response.checkedInAt)}`}
        </p>
      )}

      {lane ? <p className="srs-reason">{lane.line}</p> : response.reason && <p className="srs-reason">{response.reason}</p>}

      <div className="srs-auto" aria-hidden="true"><span style={{ animationDuration: `${DISMISS_MS}ms` }} /></div>
      {/* Its click reaches the sheet's, which closes it: one tap, one close. */}
      <button ref={button} type="button" className="dash-btn is-primary srs-next">
        Next scan
      </button>
      <style>{SRS_CSS}</style>
    </div>
  )
}

/** The allergy first and in red; the rest of what they can't eat after it, then their own words. */
function DietStrip({ diet }) {
  return (
    <div className={`srs-diet${diet.hasAllergy ? ' is-allergy' : ''}`}>
      <p className="srs-diet-head">
        <i className={`fas ${diet.hasAllergy ? 'fa-triangle-exclamation' : 'fa-utensils'}`} aria-hidden="true" />
        {diet.hasAllergy ? 'Food allergy' : 'Dietary needs'}
      </p>
      {diet.restrictions.length > 0 && <p className="srs-diet-tags">{diet.restrictions.join(' · ')}</p>}
      {diet.notes && <p className="srs-diet-note">“{diet.notes}”</p>}
    </div>
  )
}

const SRS_CSS = `
  .srs {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
    padding: 18px 18px max(18px, env(safe-area-inset-bottom));
    background: var(--white); border-top: 6px solid var(--srs-c); cursor: pointer;
    border-radius: 18px 18px 0 0; box-shadow: 0 -12px 40px rgba(15,25,46,0.35);
    animation: srs-up 0.18s ease-out;
  }
  .srs.tone-ok { --srs-c: var(--ok); --srs-bg: var(--ok-bg); }
  .srs.tone-warn { --srs-c: var(--warn); --srs-bg: var(--warn-bg); }
  .srs.tone-bad { --srs-c: var(--bad); --srs-bg: var(--bad-bg); }
  @keyframes srs-up { from { transform: translateY(100%); } to { transform: none; } }

  .srs-head {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 14px;
    background: var(--srs-bg); color: var(--srs-c); border-radius: var(--radius-sm);
    font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .srs-head i { font-size: 1.5rem; }
  /* The gate's answer is read from the queue, not just by the guard. */
  .srs-head.is-lane { font-size: 2rem; font-weight: 900; letter-spacing: 0.05em; padding: 16px; }
  .srs-head.is-lane i { font-size: 2rem; }

  .srs-person { display: flex; align-items: center; gap: 14px; }
  .srs-who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .srs-who strong {
    font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; color: var(--navy);
    text-transform: uppercase; line-height: 1.2; overflow-wrap: anywhere;
  }
  .srs-who span { font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }

  .srs-diet {
    margin-bottom: 14px; padding: 12px 14px; border-radius: var(--radius-sm);
    background: var(--warn-bg); border-left: 5px solid var(--warn);
  }
  .srs-diet.is-allergy { background: var(--bad-bg); border-left-color: var(--bad); }
  .srs-diet-head {
    display: flex; align-items: center; gap: 8px; color: var(--warn);
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .srs-diet.is-allergy .srs-diet-head { color: var(--bad); }
  .srs-diet-tags { margin-top: 6px; font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; color: var(--navy); }
  .srs-diet-note { margin-top: 4px; font-family: var(--font-body); font-size: 1rem; line-height: 1.4; color: var(--gray-800); overflow-wrap: anywhere; }

  .srs-tour {
    margin-top: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--gray-100);
    font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem; color: var(--navy); overflow-wrap: anywhere;
  }
  .srs-tour i { color: var(--gold-dark); margin-right: 6px; }

  .srs-when {
    margin-top: 12px; font-family: var(--font-heading); font-weight: 700; font-size: 1rem; color: var(--navy);
  }
  .srs-when i { color: var(--srs-c); margin-right: 4px; }
  .srs-reason { margin-top: 10px; font-family: var(--font-body); font-size: 1rem; line-height: 1.5; color: var(--gray-800); }

  .srs-next { width: 100%; min-height: 56px; margin-top: 16px; font-size: 1rem; justify-content: center; }
  .srs-auto { margin-top: 16px; height: 6px; border-radius: 999px; background: var(--gray-200); overflow: hidden; }
  .srs-auto span {
    display: block; height: 100%; width: 100%; background: var(--srs-c);
    transform-origin: left; animation: srs-drain linear forwards;
  }
  @keyframes srs-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  @media (min-width: 640px) {
    .srs { left: 50%; right: auto; width: 480px; transform: translateX(-50%); bottom: 24px; border-radius: 18px; }
    @keyframes srs-up { from { opacity: 0; } to { opacity: 1; } }
  }
  @media (prefers-reduced-motion: reduce) {
    .srs { animation: none; }
    .srs-auto span { animation: none; }
  }
`

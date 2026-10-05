import { useEffect, useRef } from 'react'
import DelegateFace from './DelegateFace'
import { RESULT, resultHeadline, formatVenueTime } from '@/lib/checkin'

// Long enough to read a name, short enough that a queue keeps moving.
const OK_DISMISS_MS = 2000

/**
 * The verdict on one scan, as a sheet over the camera.
 *
 * <p>Green closes itself: the guard glances, waves them through, and the camera is already live for
 * the next badge. Amber and red stay until tapped — each asks the guard to do or say something
 * (send them to the secretariat, turn them away), so they must not vanish before being read.</p>
 *
 * <p>A plate handed to someone with dietary needs is the exception: the API sends {@code diet} only
 * then, and the sheet holds until tapped, because an allergy read in a two-second flash isn't read.</p>
 *
 * <p>The phone buzzes once for green and twice for anything else, so a guard watching the queue
 * rather than the screen still knows. iOS has no vibration API and ignores this silently.</p>
 *
 * <p>{@code response} is the API's ScanResponse, or {@code { result: 'error', reason }} when the
 * request itself failed — which gets the red treatment and a nudge to search by name.</p>
 */
export default function ScanResultSheet({ response, kind, onNext }) {
  const button = useRef(null)
  const isError = response.result === 'error'
  const meta = isError ? RESULT.denied : RESULT[response.result] || RESULT.denied
  const person = response.delegate
  const diet = person?.diet
  const autoClose = response.result === 'ok' && !diet

  useEffect(() => {
    navigator.vibrate?.(autoClose ? 80 : [90, 60, 90])
    if (autoClose) {
      const t = setTimeout(onNext, OK_DISMISS_MS)
      return () => clearTimeout(t)
    }
    // Focus the one action, so a keyboard or a screen reader lands on it.
    button.current?.focus()
    return undefined
  }, [autoClose, onNext])

  return (
    <div className={`srs tone-${meta.tone}`} role="status" aria-live="assertive">
      <div className="srs-head">
        <i className={`fas ${meta.icon}`} aria-hidden="true" />
        <span>{isError ? 'Scan failed' : resultHeadline(response, kind)}</span>
      </div>

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

      {diet && <DietStrip diet={diet} />}

      {(response.reasonCode === 'already_scanned' || response.reasonCode === 'reentry') && response.scannedAt && (
        <p className="srs-when">
          <i className="fas fa-clock" aria-hidden="true" />
          {response.reasonCode === 'reentry' ? ' First in ' : ' '}{formatVenueTime(response.scannedAt)}
          {response.scannedBy && <> · by {response.scannedBy}</>}
        </p>
      )}

      {response.reason && <p className="srs-reason">{response.reason}</p>}

      {autoClose ? (
        <div className="srs-auto" aria-hidden="true"><span style={{ animationDuration: `${OK_DISMISS_MS}ms` }} /></div>
      ) : (
        <button ref={button} type="button" className="dash-btn is-primary srs-next" onClick={onNext}>
          Next scan
        </button>
      )}
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
    background: var(--white); border-top: 6px solid var(--srs-c);
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

  .srs-person { display: flex; align-items: center; gap: 14px; }
  .srs-who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .srs-who strong {
    font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; color: var(--navy);
    text-transform: uppercase; line-height: 1.2; overflow-wrap: anywhere;
  }
  .srs-who span { font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }

  .srs-diet {
    margin-top: 14px; padding: 12px 14px; border-radius: var(--radius-sm);
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
    display: block; height: 100%; width: 100%; background: var(--ok);
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

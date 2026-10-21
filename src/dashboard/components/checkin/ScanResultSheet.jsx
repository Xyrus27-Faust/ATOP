import { useEffect, useRef, useState } from 'react'
import DelegateFace from './DelegateFace'
import DietStrip from './DietStrip'
import { useSwipeDown } from '../../useSwipeDown'
import {
  RESULT, PENDING_ACTION, resultHeadline, formatVenueTime, paymentLine, busLine, overCapacityLine,
} from '@/lib/checkin'

/**
 * The verdict on one scan, as a sheet over the camera.
 *
 * <p>The sheet stays until the guard taps it — anywhere, or Next scan — so no verdict goes by unread;
 * behind it the camera is frozen, and the tap sets it reading again. Each verdict says where to send
 * someone who can't go on, so the guard reads one line and points.</p>
 *
 * <p>Every result with a person on it shows their diet — at the top, above the name, an allergy in red,
 * or a grey "No dietary needs" — and their shirt size, refusals included (ATOP, 2026-10-16).</p>
 *
 * <p>A {@code pending} result writes nothing yet: it shows who it is and offers the one tap that acts —
 * Check in at the gate, Board at a bus ({@code onAct}). At a bus it says where their booking stands
 * and how full the bus is; moving someone off another bus asks once more, so the marshal says it to
 * them before they sit down. A full bus still boards, with the warning in front of the marshal.
 * Someone not yet checked in ({@code checksIn}) is checked in by that same tap, and the button says so.</p>
 *
 * <p>A pass at the main gate or a session door doesn't come here: it shows as a {@link ScanStrip}
 * and the camera reads on. What does — a refusal there, a failed scan — can be swiped down as well
 * as tapped away ({@code swipe}). Every result with a delegate on it says what they still owe
 * ("Paid in full", "Balance ₱6,000"), so the marshal can say it before the desk has to — except at
 * a bus, which boards them either way.</p>
 *
 * <p>{@code notice} is something the page needs the guard to read before acting — at a bus, the
 * question whether this phone is open on the right bus at all. It sits under the headline.</p>
 *
 * <p>The phone buzzes once for green and twice for anything else, so a guard watching the queue
 * rather than the screen still knows. iOS has no vibration API and ignores this silently.</p>
 *
 * <p>{@code response} is the API's ScanResponse or GateResponse, or {@code { result: 'error', reason }}
 * when the request itself failed — which gets the red treatment and a nudge to search by name.</p>
 */
export default function ScanResultSheet({ response, kind, onNext, onAct, swipe = false, notice = null }) {
  const button = useRef(null)
  const actButton = useRef(null)
  const [confirming, setConfirming] = useState(false)
  const [acting, setActing] = useState(false)
  const isError = response.result === 'error'
  const meta = isError ? RESULT.denied : RESULT[response.result] || RESULT.denied
  const person = response.delegate
  // Not at a bus (ATOP, 2026-10-22): the bus boards whoever owes, so the amount is only noise there.
  const pay = kind === 'Tour' ? null : paymentLine(person?.payment)
  const boarding = response.boarding
  const over = boarding ? overCapacityLine(boarding) : null
  const action = response.result === 'pending' && onAct ? PENDING_ACTION[response.reasonCode] : null
  const tone = (response.result === 'pending' && BUS_TONE[response.reasonCode]) || meta.tone
  const calm = tone === 'ok' || tone === 'pend' || tone === 'info'
  const { handlers, offset } = useSwipeDown(onNext, swipe && !acting)
  // Per result, not per tone: a tap that turns "pending" into "ok" is a new result in the same calm
  // tone, and it still needs its buzz and the focus moved off the action that just went away.
  useEffect(() => {
    navigator.vibrate?.(calm ? 80 : [90, 60, 90])
    // Focus the one action, so a keyboard or a screen reader lands on it.
    ;(actButton.current || button.current)?.focus()
  }, [response, calm])

  // The sheet closes on any tap; the action buttons are the taps that don't.
  const act = async (event) => {
    event.stopPropagation()
    if (action.confirm && !confirming) {
      setConfirming(true)
      return
    }
    setActing(true)
    try {
      await onAct()
    } finally {
      setActing(false)
      setConfirming(false)
    }
  }

  // While a tap is with the server the sheet stays: closing it would bring the camera back, and the
  // reply would land on whoever is scanned next.
  return (
    <div
      className={`srs tone-${tone}${swipe ? ' is-swipe' : ''}${offset != null ? ' is-dragging' : ''}`}
      style={offset != null ? { '--srs-drag': `${offset}px` } : undefined}
      role="status"
      aria-live="assertive"
      onClick={acting ? undefined : onNext}
      {...handlers}
    >
      {swipe && <span className="srs-handle" aria-hidden="true" />}
      <div className="srs-head">
        <i className={`fas ${meta.icon}`} aria-hidden="true" />
        <span>{isError ? 'Scan failed' : resultHeadline(response, kind)}</span>
      </div>

      {notice}

      {person?.diet && <DietStrip diet={person.diet} />}

      {person && (
        <div className="srs-person">
          <DelegateFace name={person.fullName} photoUrl={person.photoUrl} />
          <div className="srs-who">
            <strong>{person.fullName}</strong>
            <span>{[person.designation, person.lgu].filter(Boolean).join(' · ')}</span>
            <span className="srs-shirt">
              <i className="fas fa-shirt" aria-hidden="true" /> {person.shirtSize ? `Shirt ${person.shirtSize}` : 'No shirt size'}
            </span>
          </div>
        </div>
      )}

      {pay && (
        <p className={`srs-pay is-${pay.tone}`}>
          <i className="fas fa-peso-sign" aria-hidden="true" /> {pay.text}
        </p>
      )}

      {/* At a bus: the booking they hold, which may be another bus or none. */}
      {boarding ? (
        <div className="srs-bus">
          <p className="srs-tour">
            <i className="fas fa-bus" aria-hidden="true" /> {boarding.bookedTour || 'No tour booked'}
          </p>
          <p className="srs-bus-count">{busLine(boarding)}</p>
          {over && (
            <p className="srs-over">
              <i className="fas fa-triangle-exclamation" aria-hidden="true" /> {over}
            </p>
          )}
        </div>
      ) : person?.tour && (
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

      {response.reason && <p className="srs-reason">{response.reason}</p>}

      {action && confirming && (
        <p className="srs-confirm" onClick={(e) => e.stopPropagation()}>
          Moving <strong>{person.fullName}</strong> from <strong>{boarding.bookedTour}</strong> to{' '}
          <strong>{boarding.bus}</strong>. Confirm with them before they sit down.
        </p>
      )}

      {action && (
        <button ref={actButton} type="button" className="dash-btn is-primary srs-act" disabled={acting} onClick={act}>
          {acting
            ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
            : <i className={`fas ${action.icon}`} aria-hidden="true" />}
          {' '}{confirming ? 'Yes, move them here' : checkInAnd(action.label, response.checksIn)}
        </button>
      )}

      {/* Its click reaches the sheet's, which closes it: one tap, one close. */}
      <button ref={button} type="button" className={`dash-btn ${action ? 'is-ghost' : 'is-primary'} srs-next`} disabled={acting}>
        {action ? 'Not now · next scan' : 'Next scan'}
      </button>
      <style>{SRS_CSS}</style>
    </div>
  )
}

/**
 * A bus scan is coloured by where they're booked, so the marshal reads it before the words (ATOP,
 * 2026-10-22): this bus green, no tour blue, another bus orange. The gate and session taps stay gold.
 */
const BUS_TONE = { board_own: 'ok', board_none: 'info', board_other: 'warn' }

/** "Board" becomes "Check in & board" for someone the tap will check in too. */
function checkInAnd(label, checksIn) {
  return checksIn ? `Check in & ${label.charAt(0).toLowerCase()}${label.slice(1)}` : label
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
  .srs.tone-pend { --srs-c: var(--navy); --srs-bg: var(--gold-light); }
  .srs.tone-info { --srs-c: var(--info); --srs-bg: var(--info-bg); }
  @keyframes srs-up { from { transform: translateY(100%); } to { transform: none; } }

  .srs-head {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 14px;
    background: var(--srs-bg); color: var(--srs-c); border-radius: var(--radius-sm);
    font-family: var(--font-heading); font-weight: 800; font-size: 1.15rem;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .srs-head i { font-size: 1.5rem; }

  /* Swipe down to close: the sheet follows the finger, then springs back or goes. */
  .srs.is-swipe { touch-action: none; transform: translateY(var(--srs-drag, 0px)); transition: transform 0.18s ease-out; }
  .srs.is-dragging { transition: none; }
  .srs-handle { display: block; width: 40px; height: 4px; border-radius: 999px; background: var(--gray-400); margin: -6px auto 12px; }

  .srs-person { display: flex; align-items: center; gap: 14px; }
  .srs-who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .srs-who strong {
    font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; color: var(--navy);
    text-transform: uppercase; line-height: 1.2; overflow-wrap: anywhere;
  }
  .srs-who span { font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }

  .srs-shirt { font-family: var(--font-heading); font-weight: 700; font-size: 0.85rem; color: var(--navy); }
  .srs-shirt i { color: var(--gold-dark); margin-right: 2px; }

  .srs-tour {
    margin-top: 12px; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--gray-100);
    font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem; color: var(--navy); overflow-wrap: anywhere;
  }
  .srs-tour i { color: var(--gold-dark); margin-right: 6px; }
  .srs-bus-count { margin-top: 8px; font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; color: var(--gray-600); }
  .srs-over {
    margin-top: 8px; padding: 8px 14px; border-radius: var(--radius-sm); background: var(--warn-bg); color: var(--warn);
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem;
  }
  .srs-confirm {
    margin-top: 14px; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--warn-bg); cursor: default;
    border-left: 5px solid var(--warn); font-family: var(--font-body); font-size: 1rem; line-height: 1.5; color: var(--navy);
  }
  .srs-act { width: 100%; min-height: 56px; margin-top: 16px; font-size: 1.05rem; justify-content: center; }
  /* At a bus the Board button wears the header's colour; the gate's Check in keeps the gold. */
  .srs:is(.tone-ok, .tone-info, .tone-warn) .dash-btn.srs-act,
  .srs:is(.tone-ok, .tone-info, .tone-warn) .dash-btn.srs-act:hover {
    background: var(--srs-c); border-color: var(--srs-c); color: var(--white); box-shadow: none;
  }

  .srs-pay {
    margin-top: 12px; padding: 8px 14px; border-radius: var(--radius-sm); width: fit-content;
    font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem;
  }
  .srs-pay i { margin-right: 4px; }
  .srs-pay.is-ok { background: var(--ok-bg); color: var(--ok); }
  .srs-pay.is-warn { background: var(--warn-bg); color: var(--warn); }
  .srs-pay.is-bad { background: var(--bad-bg); color: var(--bad); }

  .srs-when {
    margin-top: 12px; font-family: var(--font-heading); font-weight: 700; font-size: 1rem; color: var(--navy);
  }
  .srs-when i { color: var(--srs-c); margin-right: 4px; }
  .srs-reason { margin-top: 10px; font-family: var(--font-body); font-size: 1rem; line-height: 1.5; color: var(--gray-800); }

  .srs-next { width: 100%; min-height: 56px; margin-top: 16px; font-size: 1rem; justify-content: center; }
  .srs-act + .srs-next { margin-top: 10px; min-height: 48px; }

  @media (min-width: 640px) {
    .srs { left: 50%; right: auto; width: 480px; transform: translateX(-50%); bottom: 24px; border-radius: 18px; }
    .srs.is-swipe { transform: translateX(-50%) translateY(var(--srs-drag, 0px)); }
    @keyframes srs-up { from { opacity: 0; } to { opacity: 1; } }
  }
  @media (prefers-reduced-motion: reduce) {
    .srs { animation: none; }
  }
`

import { useEffect } from 'react'
import DelegateFace from './DelegateFace'
import { useSwipeDown } from '../../useSwipeDown'
import { gateLane, gateSteps, resultHeadline, paymentLine, dietSummary, justScanned, formatVenueTime } from '@/lib/checkin'

// How long a pass stays up before the strip clears itself. A finger on it holds it.
const AUTO_CLOSE_MS = 3000

/**
 * A clean pass at the main gate or a session door, as a short strip under the camera (ATOP, 2026-10-21).
 *
 * <p>The camera keeps reading behind it, so the next badge simply replaces it; on its own it clears
 * after three seconds, or the guard swipes it away. Only a pass gets this — a refusal, an error or
 * anything that needs a tap still gets the full {@link ScanResultSheet}, which stops the camera.</p>
 *
 * <p>At the gate the big word is the lane — Desk A, Desk B, Desk C or Go in — with what they still
 * owe, so the marshal can say it, and how far through check-in → ID & OR → kit they are. At a
 * session it is "Present", or "Just scanned" for the same badge read again within a minute. Diet and shirt size are on every strip, an allergy in red (ATOP, 2026-10-16).</p>
 *
 * <p>{@code checking} is the next badge with the server: the strip says so and holds, so the name on
 * it isn't taken for the person now in front of the guard.</p>
 */
export default function ScanStrip(props) {
  // One strip per result: a new one replays the slide-in, the buzz and the full three seconds.
  return <Strip key={stripId(props.response)} {...props} />
}

const ids = new WeakMap()
let lastId = 0
function stripId(response) {
  if (!ids.has(response)) ids.set(response, ++lastId)
  return ids.get(response)
}

function Strip({ response, kind, checking, onNext }) {
  const { handlers, offset, pressed } = useSwipeDown(onNext, !checking)
  const lane = gateLane(response)
  const tone = lane ? lane.tone : 'ok'
  const person = response.delegate
  const pay = lane ? paymentLine(person?.payment) : null
  const diet = dietSummary(person?.diet)
  const repeat = justScanned(response)
  const when = lane
    ? repeat ? 'Just scanned'
      : !response.justCheckedIn && response.checkedInAt && `Already in since ${formatVenueTime(response.checkedInAt)}`
    : !repeat && response.reasonCode === 'reentry' && response.scannedAt && `First in ${formatVenueTime(response.scannedAt)}`
  // At the gate the lane stays the headline — it's where they go next; a session door just says so.
  const verdict = checking ? 'Checking…' : lane ? lane.headline : repeat ? 'Just scanned' : resultHeadline(response, kind)

  useEffect(() => {
    navigator.vibrate?.(tone === 'ok' ? 80 : [90, 60, 90])
  }, [tone])

  const dragging = offset != null
  return (
    <div
      className={`sst tone-${tone}${dragging ? ' is-dragging' : ''}${checking ? ' is-checking' : ''}`}
      style={dragging ? { '--sst-drag': `${offset}px` } : undefined}
      role="status"
      aria-live="assertive"
      {...handlers}
    >
      <div
        className={`sst-timer${pressed || checking ? ' is-held' : ''}`}
        style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }}
        onAnimationEnd={onNext}
        aria-hidden="true"
      />
      <span className="sst-handle" aria-hidden="true" />
      <button type="button" className="sst-close" onClick={onNext} disabled={checking} aria-label="Close · next scan">
        <i className="fas fa-xmark" aria-hidden="true" />
      </button>

      <div className="sst-row">
        <div className="sst-face">
          <DelegateFace name={person?.fullName} photoUrl={person?.photoUrl} size={64} />
          <i className={`fas ${checking ? 'fa-spinner fa-spin' : lane ? lane.icon : 'fa-circle-check'} sst-badge`} aria-hidden="true" />
        </div>
        <div className="sst-who">
          <span className="sst-verdict">{verdict}</span>
          {person && <strong>{person.fullName}</strong>}
          {(person?.lgu || pay) && (
            <span className="sst-meta">
              {person?.lgu}
              {person?.lgu && pay && ' · '}
              {pay && <b className={`is-${pay.tone}`}>{pay.text}</b>}
            </span>
          )}
          {person && (
            <span className={`sst-diet${diet?.allergy ? ' is-allergy' : ''}`}>
              {diet?.allergy && <i className="fas fa-triangle-exclamation" aria-hidden="true" />}
              {[diet?.text, person.shirtSize ? `Shirt ${person.shirtSize}` : 'No shirt size'].filter(Boolean).join(' · ')}
            </span>
          )}
          {when && <span className="sst-when">{when}</span>}
        </div>
      </div>

      {lane && (
        <ol className="sst-steps" aria-label="Progress">
          {gateSteps(response.lane).map((step) => (
            <li key={step.label} className={step.done ? 'is-done' : undefined}>
              {step.label}<span className="sr-only">{step.done ? ' done' : ' not yet'}</span>
            </li>
          ))}
        </ol>
      )}
      <style>{SST_CSS}</style>
    </div>
  )
}

const SST_CSS = `
  /* Sits just above the Search by name dock, so search stays in reach while a strip is up. */
  .sst {
    position: fixed; left: 12px; right: 12px; z-index: 40;
    bottom: calc(76px + max(12px, env(safe-area-inset-bottom, 0px)));
    padding: 6px 14px 12px; overflow: hidden; cursor: grab; touch-action: none; user-select: none;
    background: var(--white); border-radius: 16px; box-shadow: 0 -8px 30px rgba(15,25,46,0.45);
    transform: translateY(var(--sst-drag, 0px)); transition: transform 0.18s ease-out;
    animation: sst-up 0.18s ease-out;
  }
  .sst.is-dragging { transition: none; cursor: grabbing; }
  .sst.tone-ok { --sst-c: var(--ok); }
  .sst.tone-warn { --sst-c: var(--warn); }
  @keyframes sst-up { from { opacity: 0; transform: translateY(40px); } }

  .sst-timer {
    position: absolute; left: 0; top: 0; height: 4px; width: 100%; background: var(--sst-c);
    transform-origin: left; animation-name: sst-drain; animation-timing-function: linear; animation-fill-mode: forwards;
  }
  .sst-timer.is-held { animation-play-state: paused; }
  @keyframes sst-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  .sst::before { content: ""; position: absolute; left: 0; top: 0; height: 4px; width: 100%; background: var(--gray-200); }

  .sst-handle { display: block; width: 40px; height: 4px; border-radius: 999px; background: var(--gray-400); margin: 6px auto 8px; }
  .sst-close {
    position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; display: grid; place-items: center;
    border: 0; border-radius: 50%; background: none; color: var(--gray-600); font-size: 1.1rem; cursor: pointer;
  }
  .sst-close:focus-visible { outline: 3px solid var(--gold); outline-offset: 1px; }

  .sst-row { display: flex; align-items: center; gap: 12px; padding-right: 28px; }
  .sst.is-checking .sst-row { opacity: 0.5; }
  .sst-face { position: relative; flex-shrink: 0; }
  .sst-badge {
    position: absolute; right: -6px; bottom: -6px; width: 26px; height: 26px; display: grid; place-items: center;
    border-radius: 50%; border: 2px solid var(--white); background: var(--sst-c); color: var(--white); font-size: 0.8rem;
  }
  .sst-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sst-verdict {
    font-family: var(--font-heading); font-weight: 900; font-size: 1.15rem; line-height: 1.15;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--sst-c);
  }
  .sst.is-checking .sst-verdict { color: var(--navy); }
  .sst-who strong {
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem; color: var(--navy);
    text-transform: uppercase; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sst-meta, .sst-when { font-family: var(--font-body); font-size: 0.85rem; color: var(--gray-600); }
  .sst-meta b { font-family: var(--font-heading); font-weight: 800; }
  .sst-meta b.is-ok { color: var(--ok); }
  .sst-meta b.is-warn { color: var(--warn); }
  .sst-meta b.is-bad { color: var(--bad); }
  .sst-diet {
    font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem; color: var(--navy);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .sst-diet.is-allergy { color: var(--bad); }
  .sst-diet i { margin-right: 4px; }

  .sst-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; padding: 0; list-style: none; }
  .sst-steps li {
    padding-top: 6px; border-top: 4px solid var(--gray-200);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.7rem; color: var(--gray-600);
  }
  .sst-steps li.is-done { border-top-color: var(--ok); color: var(--ok); }

  @media (min-width: 640px) {
    .sst { left: 50%; right: auto; width: 480px; margin-left: -240px; bottom: 80px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sst { animation: none; transition: none; }
  }
`

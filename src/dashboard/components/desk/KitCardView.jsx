import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/apiClient'
import { formatPeso } from '@/lib/events'
import { deskCard, deskStep, DESK_STEPS, formatVenueTime } from '@/lib/checkin'
import DelegateFace from '../checkin/DelegateFace'
import { DSK_CARD_CSS } from './DeskCardView'

/**
 * One delegate at the kit table: who they are, their shirt size in large type, and one question —
 * "Release kit to NAME?". Yes records the kit against whoever tapped it, and the same tick shows on
 * the desk card, the Desk list and the master list.
 *
 * <p>The kit comes last, after check-in, any balance and the ID & receipt. Someone who isn't there
 * yet is told where to go instead of being offered the button; the server refuses it anyway.</p>
 */
export default function KitCardView({ card: initial, onDone }) {
  const [card, setCard] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [justReleased, setJustReleased] = useState(false)
  const first = useRef(null)

  useEffect(() => { first.current?.focus() }, [])

  async function run(call, released) {
    setBusy(true)
    setError(null)
    try {
      setCard(await call())
      setJustReleased(released)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const blocker = blockerOf(card)
  const ready = card.nextStep === 'Kit'
  // Another phone handed the kit, or undid a step, since this card loaded.
  const stale = error instanceof ApiError && error.raw?.reasonCode === 'step_refused'

  return (
    <div className="dsk-card">
      {justReleased ? (
        <div className="kit-head is-ok"><i className="fas fa-circle-check" aria-hidden="true" /> Kit released</div>
      ) : card.kit ? (
        <div className="kit-head is-warn">
          <i className="fas fa-box-open" aria-hidden="true" />
          <span>Kit already released<small>{formatVenueTime(card.kit.at)} · {card.kit.by}</small></span>
        </div>
      ) : blocker ? (
        <div className="kit-head is-bad">
          <i className="fas fa-circle-xmark" aria-hidden="true" />
          <span>{blocker.title}<small>{blocker.send}</small></span>
        </div>
      ) : null}

      <div className="dsk-person">
        <DelegateFace name={card.fullName} photoUrl={card.photoUrl} size={96} />
        <div className="dsk-who">
          <strong>{card.fullName}</strong>
          <span>{[card.designation, card.lgu].filter(Boolean).join(' · ')}</span>
          <span className="dsk-ref">{card.referenceCode}</span>
        </div>
      </div>

      {/* What the person at the table actually reaches for. */}
      <div className="kit-shirt">
        <span>Shirt</span>
        <strong>{card.shirtSize || '—'}</strong>
      </div>

      <ol className="dsk-steps">
        {DESK_STEPS.map((s) => {
          const at = card[s.field]
          if (s.step === 'Payment' && !at && card.balance <= 0) return null
          return (
            <li key={s.step} className={at ? 'is-done' : ''}>
              <i className={`fas ${at ? 'fa-circle-check' : 'fa-circle'}`} aria-hidden="true" />
              <span className="dsk-step-label">{s.label}</span>
              {at && <span className="dsk-step-when">{formatVenueTime(at.at)} · {at.by}</span>}
            </li>
          )
        })}
      </ol>

      {error && (
        <div className="dash-banner tone-error dsk-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{error.message}</span>
          {stale && (
            <button type="button" className="dash-btn is-ghost is-sm" disabled={busy} onClick={() => run(() => deskCard(card.id), false)}>
              Reload card
            </button>
          )}
        </div>
      )}

      {ready ? (
        <div className="kit-ask">
          <p>Release kit to <strong>{card.fullName}</strong>?</p>
          <div className="dsk-row">
            <button type="button" className="dash-btn is-ghost" disabled={busy} onClick={onDone}>Cancel</button>
            <button type="button" className="dash-btn is-primary" ref={first} disabled={busy} onClick={() => run(() => deskStep(card.id, 'Kit'), true)}>
              {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />} Yes, release kit
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="dash-btn is-primary dsk-next" ref={first} onClick={onDone}>
          Next delegate
        </button>
      )}

      <style>{DSK_CARD_CSS}</style>
      <style>{KIT_CSS}</style>
    </div>
  )
}

/** Why there's no kit yet, and where to send them — in the desk's order. Null once the kit is next. */
function blockerOf(card) {
  if (card.kit || card.nextStep === 'Kit') return null
  if (!card.checkIn) return { title: 'Not checked in', send: 'Send them to the Secretariat desk first.' }
  if (card.balance > 0) return { title: `Balance ${formatPeso(card.balance)}`, send: 'Send them to Desk B to pay first.' }
  return { title: 'No ID & receipt yet', send: 'Send them back to the desk for their ID first.' }
}

const KIT_CSS = `
  .kit-head {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: var(--radius-sm);
    font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; text-transform: uppercase;
  }
  .kit-head > i { font-size: 1.5rem; flex: 0 0 auto; }
  .kit-head > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .kit-head small { font-family: var(--font-body); font-weight: 600; font-size: 0.9rem; text-transform: none; }
  .kit-head.is-ok { background: var(--ok); color: var(--white); }
  .kit-head.is-warn { background: var(--warn-bg); color: var(--warn); }
  .kit-head.is-bad { background: var(--bad-bg); color: var(--bad); }

  .kit-shirt {
    display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 12px 16px;
    background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
  }
  .kit-shirt span { font-family: var(--font-heading); font-weight: 700; font-size: 0.74rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gray-600); }
  .kit-shirt strong { font-family: var(--font-heading); font-weight: 900; font-size: 2rem; color: var(--navy); }

  .kit-ask { padding: 14px; border: 2px solid var(--ok); background: var(--white); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 12px; }
  .kit-ask p { font-family: var(--font-body); font-size: 1.05rem; color: var(--gray-800); line-height: 1.5; overflow-wrap: anywhere; }
  .kit-ask .dsk-row .dash-btn { min-height: 56px; }
`

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/apiClient'
import { formatPeso } from '@/lib/events'
import { deskCard, deskStep, deskUndo, DESK_STEPS, lastDeskStep, formatVenueTime, REASON_MAX } from '@/lib/checkin'
import DelegateFace from '../checkin/DelegateFace'

/**
 * One delegate at the Secretariat desk: which desk they belong at, what they owe, how far through
 * check-in → payment → ID & receipt → kit they are, and the one button for whatever comes next.
 *
 * <p>The server decides the order and refuses anything out of it; this only offers the next step.
 * Taking cash is two taps — the amount is read back before it is recorded — and undoing a step
 * always asks why, because the API keeps the reason on record.</p>
 *
 * <p>{@code note} is the line above the card: "Checked in just now", or "Already checked in".</p>
 */
export default function DeskCardView({ card: initial, note, onDone }) {
  const [card, setCard] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmCash, setConfirmCash] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [reason, setReason] = useState('')
  const done = useRef(null)

  const next = DESK_STEPS.find((s) => s.step === card.nextStep) || null
  const last = lastDeskStep(card)
  const owes = card.balance > 0
  const deskB = card.desk === 'B'

  useEffect(() => { done.current?.focus() }, [])

  async function run(call) {
    setBusy(true)
    setError(null)
    try {
      setCard(await call())
      setConfirmCash(false)
      setUndoing(false)
      setReason('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const doNext = () => {
    if (next.step === 'Payment' && !confirmCash) {
      setConfirmCash(true)
      return
    }
    run(() => deskStep(card.id, next.step))
  }

  const undo = (e) => {
    e.preventDefault()
    if (!reason.trim()) return
    run(() => deskUndo(card.id, last.step, reason.trim()))
  }

  // Another phone moved this delegate on since the card loaded: the fix is the fresh card.
  const stale = error instanceof ApiError && ['not_last_step', 'nothing_to_undo', 'step_refused'].includes(error.raw?.reasonCode)

  return (
    <div className="dsk-card">
      <div className={`dsk-desk ${deskB ? 'is-b' : 'is-a'}`}>
        <span className="dsk-desk-name">Desk {card.desk}</span>
        <span className="dsk-desk-why">
          {card.complimentary ? 'Complimentary'
            : owes ? `Balance ${formatPeso(card.balance)}`
              : card.payment ? 'Paid at the desk'
                : 'Fully paid'}
        </span>
      </div>

      {note && <p className="dsk-note">{note}</p>}

      <div className="dsk-person">
        <DelegateFace name={card.fullName} photoUrl={card.photoUrl} size={96} />
        <div className="dsk-who">
          <strong>{card.fullName}</strong>
          <span>{[card.designation, card.lgu].filter(Boolean).join(' · ')}</span>
          <span className="dsk-ref">{card.referenceCode}</span>
        </div>
      </div>

      <dl className="dsk-facts">
        <div><dt>Fee</dt><dd>{card.complimentary ? 'Waived' : formatPeso(card.amount)}</dd></div>
        <div><dt>Paid</dt><dd>{formatPeso(card.amountPaid)}</dd></div>
        <div className={owes ? 'is-owed' : ''}><dt>Balance</dt><dd>{formatPeso(card.balance)}</dd></div>
        {card.shirtSize && <div><dt>Shirt</dt><dd>{card.shirtSize}</dd></div>}
        {card.tour && <div className="is-wide"><dt>Tour</dt><dd>{card.tour}</dd></div>}
      </dl>

      <ol className="dsk-steps">
        {DESK_STEPS.map((s) => {
          const at = card[s.field]
          // Payment is a step only for someone who owed: a fully paid seat skips it.
          if (s.step === 'Payment' && !at && !owes) return null
          const isNext = s.step === card.nextStep
          return (
            <li key={s.step} className={at ? 'is-done' : isNext ? 'is-next' : ''}>
              <i className={`fas ${at ? 'fa-circle-check' : isNext ? 'fa-circle-dot' : 'fa-circle'}`} aria-hidden="true" />
              <span className="dsk-step-label">{s.label}</span>
              {at && (
                <span className="dsk-step-when">
                  {formatVenueTime(at.at)} · {at.by}{at.amount != null && <> · {formatPeso(at.amount)}</>}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {error && (
        <div className="dash-banner tone-error dsk-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{error.message}</span>
          {stale && (
            <button type="button" className="dash-btn is-ghost is-sm" disabled={busy} onClick={() => run(() => deskCard(card.id))}>
              Reload card
            </button>
          )}
        </div>
      )}

      {next ? (
        confirmCash ? (
          <div className="dsk-cash">
            <p>Received <strong>{formatPeso(card.balance)}</strong> in cash from {card.fullName}?</p>
            <div className="dsk-row">
              <button type="button" className="dash-btn is-ghost" disabled={busy} onClick={() => setConfirmCash(false)}>Cancel</button>
              <button type="button" className="dash-btn is-primary" disabled={busy} onClick={doNext}>
                {busy ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />} Yes, mark paid
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="dash-btn is-primary dsk-go" disabled={busy} onClick={doNext}>
            {busy
              ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</>
              : next.step === 'Payment'
                ? <><i className="fas fa-money-bill-wave" aria-hidden="true" /> Collect {formatPeso(card.balance)} cash</>
                : <><i className="fas fa-check" aria-hidden="true" /> {next.action}</>}
          </button>
        )
      ) : (
        <p className="dsk-all-done"><i className="fas fa-circle-check" aria-hidden="true" /> All done at the desk.</p>
      )}
      {next?.step === 'CheckIn' && <p className="dash-help dsk-face">Check the face against the person first.</p>}

      {last && !undoing && (
        <button type="button" className="dsk-undo-link" disabled={busy} onClick={() => { setUndoing(true); setConfirmCash(false) }}>
          Undo {last.undo}
        </button>
      )}
      {last && undoing && (
        <form className="dsk-undo" onSubmit={undo}>
          <label className="dash-field">
            <span className="dash-label">Why undo the {last.undo}?</span>
            <input
              className="dash-input"
              maxLength={REASON_MAX}
              value={reason}
              autoFocus
              placeholder="e.g. Tapped the wrong delegate"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="dsk-row">
            <button type="button" className="dash-btn is-ghost" disabled={busy} onClick={() => { setUndoing(false); setReason('') }}>Keep it</button>
            <button type="submit" className="dash-btn is-danger" disabled={busy || !reason.trim()}>Undo</button>
          </div>
        </form>
      )}

      <button ref={done} type="button" className="dash-btn dsk-next" onClick={onDone}>
        <i className="fas fa-qrcode" aria-hidden="true" /> Next delegate
      </button>
      <style>{DSK_CARD_CSS}</style>
    </div>
  )
}

const DSK_CARD_CSS = `
  .dsk-card { display: flex; flex-direction: column; gap: 14px; padding: 16px; max-width: 560px; width: 100%; margin: 0 auto; }
  .dsk-desk {
    display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    padding: 14px 16px; border-radius: var(--radius-sm); color: var(--white);
    font-family: var(--font-heading); text-transform: uppercase;
  }
  .dsk-desk.is-a { background: var(--ok); }
  .dsk-desk.is-b { background: var(--warn); }
  .dsk-desk-name { font-weight: 900; font-size: 1.8rem; letter-spacing: 0.04em; }
  .dsk-desk-why { font-weight: 700; font-size: 1rem; }
  .dsk-note { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }

  .dsk-person { display: flex; align-items: center; gap: 14px; }
  .dsk-who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .dsk-who strong { font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; color: var(--navy); text-transform: uppercase; overflow-wrap: anywhere; }
  .dsk-who span { font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }
  .dsk-ref { font-family: var(--font-heading) !important; font-weight: 700; letter-spacing: 0.06em; }

  .dsk-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
  .dsk-facts > div { padding: 10px 12px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); min-width: 0; }
  .dsk-facts > div.is-wide { grid-column: 1 / -1; }
  .dsk-facts > div.is-owed { border-color: var(--warn); background: var(--warn-bg); }
  .dsk-facts dt { font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); }
  .dsk-facts dd { margin: 2px 0 0; font-family: var(--font-heading); font-weight: 800; color: var(--navy); overflow-wrap: anywhere; }

  .dsk-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .dsk-steps li { display: grid; grid-template-columns: 22px 1fr; column-gap: 10px; align-items: center; color: var(--gray-400); }
  .dsk-steps li i { font-size: 1.05rem; }
  .dsk-steps li.is-done { color: var(--ok); }
  .dsk-steps li.is-next { color: var(--gold-dark); }
  .dsk-step-label { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
  .dsk-steps li:not(.is-done):not(.is-next) .dsk-step-label { color: var(--gray-400); }
  .dsk-step-when { grid-column: 2; font-family: var(--font-body); font-size: 0.82rem; color: var(--gray-600); }

  .dsk-error { flex-wrap: wrap; }
  .dsk-go, .dsk-next { width: 100%; min-height: 56px; justify-content: center; font-size: 1rem; }
  .dsk-cash { padding: 14px; border: 2px solid var(--warn); background: var(--warn-bg); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 12px; }
  .dsk-cash p { font-family: var(--font-body); color: var(--gray-800); line-height: 1.5; }
  .dsk-row { display: flex; gap: 10px; }
  .dsk-row .dash-btn { flex: 1; min-height: 48px; justify-content: center; }
  .dsk-all-done { font-family: var(--font-heading); font-weight: 800; color: var(--ok); text-align: center; padding: 8px; }
  .dsk-face { text-align: center; }
  .dsk-undo-link {
    align-self: center; min-height: 44px; padding: 0 12px; background: none; border: 0; cursor: pointer;
    color: var(--gray-600); text-decoration: underline; font-family: var(--font-body); font-size: 0.9rem;
  }
  .dsk-undo { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .dsk-undo .dash-input { font-size: 16px; min-height: 48px; }
`

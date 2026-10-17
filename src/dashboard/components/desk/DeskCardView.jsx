import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/apiClient'
import { formatPeso } from '@/lib/events'
import { deskCard, deskShirtSize, deskStep, deskUndo, DESK_STEPS, canUndoDeskStep, arrivalNote, formatVenueTime, formatDay, kindMeta, sessionLine, TRAIL_STATUS, REASON_MAX } from '@/lib/checkin'
import DelegateFace from '../checkin/DelegateFace'
import DietStrip from '../checkin/DietStrip'

/**
 * One delegate at the Secretariat desk: which desk they're at, what they owe, and where they are with
 * check-in → ID & OR (Desk A, or Desk B where it is the payment) → kit (Desk C).
 *
 * <p>The server enforces the order and refuses anything out of it; this only offers what it would
 * accept, as one big button for whatever is next. At Desk B the ID & OR button names the balance, and
 * one tap hands them over and records that cash (ATOP, 2026-10-13: a thousand-plus partial payers, so
 * no separate cash confirm). A wrong tap is fixed with Undo on the ID & OR, which takes the cash back
 * with it; undoing always asks why, because the API keeps the reason on record. If the balance moved
 * while the card was open (an online payment came in), the API records nothing and the card reloads
 * onto the new figure, so the cashier just counts again. Cash that cancels the group's online link
 * names the others on it who still owe, so the cashier can tell them to pay here.</p>
 *
 * <p>{@code note} is the line above the card: "Checked in just now", "Already checked in", or "Not
 * checked in yet" (which the Check in tap replaces);
 * {@code session} the one under it — "Counted for Opening Ceremony" — when a session is open.
 * {@code code} is the badge scanned to open the card, if one was: the Check in tap sends it, so the
 * session's log says scanned rather than found by name.</p>
 *
 * <p>{@code countIn} is the scan's prompt when they're checked in already but not yet counted at the
 * open session (ATOP, 2026-10-17): the scan wrote nothing, and its own Count in button — the check-in
 * tap again, which only counts them — does it.</p>
 *
 * <p>An ID or kit already handed over folds to one "released ✓" line (its undo stays on it), so the
 * card's height goes to what is still to do.</p>
 */
export default function DeskCardView({ card: initial, note: initialNote, session: initialSession, countIn: initialCountIn, code, onDone }) {
  const [card, setCard] = useState(initial)
  const [note, setNote] = useState(initialNote)
  const [session, setSession] = useState(initialSession)
  const [countIn, setCountIn] = useState(initialCountIn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  // The step whose undo form is open, or null.
  const [undoing, setUndoing] = useState(null)
  const [reason, setReason] = useState('')
  const done = useRef(null)

  // The big button does whatever is next; the order is the API's.
  const next = DESK_STEPS.find((s) => s.step === card.nextStep && s.action) ?? null
  const owes = card.balance > 0
  // Once the ID & OR are out, the kit is Desk C's, whichever desk they came through.
  const station = card.idRelease && !card.kit ? 'C' : card.desk

  useEffect(() => { done.current?.focus() }, [])

  // The note speaks of the check-in as it was. A card whose check-in has since changed — an undo, or
  // a reload that finds another phone's tap — drops it rather than contradict itself.
  function showCard(next) {
    if (Boolean(next.checkIn) !== Boolean(card.checkIn)) setNote(null)
    setCard(next)
  }

  async function run(call) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await call()
      // The check-in answers as a scan does — the card inside, with the session it counted at, or a
      // refusal; every other step answers with the card itself.
      if (res?.result === 'denied') throw new Error(res.reason || 'The desk can’t check this delegate in.')
      const updated = res?.card ?? res
      if (res?.card) {
        setCountIn(null)
        setSession(sessionLine(res.session))
        setNote(arrivalNote(res))
        setCard(updated)
      } else {
        showCard(updated)
      }
      // A link can't drop one person, so cash here cancels the whole link the group was sent.
      const others = updated.cancelledLinkAlsoBilled ?? []
      if (others.length > 0)
        setNotice(`Their group's online payment link was cancelled. ${others.join(', ')} still owe${others.length === 1 ? 's' : ''}. Ask them to pay here.`)
      setUndoing(null)
      setReason('')
    } catch (err) {
      if (err instanceof ApiError && err.raw?.reasonCode === 'balance_changed') await catchUp(err)
      else setError(err)
    } finally {
      setBusy(false)
    }
  }

  // Nothing was recorded: put the new balance on the button, or say there's nothing left to take.
  async function catchUp(err) {
    try {
      const fresh = await deskCard(card.eventId, card.id)
      showCard(fresh)
      const owesNow = fresh.balance > 0 && !fresh.idRelease
      setNotice(owesNow
        ? `An online payment just came in. The balance is now ${formatPeso(fresh.balance)}. Collect that instead.`
        : 'They just paid the rest online. No cash needed.')
    } catch {
      setError(err)
    }
  }

  const doNext = () => run(() => deskStep(card, next.step, code))
  const doCountIn = () => run(() => deskStep(card, 'CheckIn', code))
  const fillShirt = (size) => run(() => deskShirtSize(card, size))

  const startUndo = (s) => {
    setUndoing(s)
    setReason('')
  }

  const undo = (e) => {
    e.preventDefault()
    if (!reason.trim()) return
    run(() => deskUndo(card, undoing.step, reason.trim()))
  }

  // Another phone moved this delegate on since the card loaded: the fix is the fresh card.
  const stale = error instanceof ApiError && ['not_last_step', 'nothing_to_undo', 'step_refused', 'balance_changed', 'shirt_size_set'].includes(error.raw?.reasonCode)

  return (
    <div className="dsk-card">
      <div className={`dsk-desk is-${station.toLowerCase()}`}>
        <span className="dsk-desk-name">Desk {station}</span>
        <span className="dsk-desk-why">
          {station === 'C' ? 'Kit'
            : card.complimentary ? 'Complimentary'
            : owes ? `Balance ${formatPeso(card.balance)}`
              : card.payment ? 'Paid at the desk'
                : 'Fully paid'}
        </span>
      </div>

      {note && <p className="dsk-note">{note}</p>}
      {session && <p className="dsk-note dsk-session"><i className="fas fa-door-open" aria-hidden="true" /> {session}</p>}
      {countIn && (
        <div className="dsk-countin">
          <p className="dsk-note">{countIn}</p>
          <button type="button" className="dash-btn is-primary dsk-countin-go" disabled={busy} onClick={doCountIn}>
            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-door-open'}`} aria-hidden="true" /> Count in
          </button>
        </div>
      )}

      <div className="dsk-person">
        <DelegateFace name={card.fullName} photoUrl={card.photoUrl} size={96} />
        <div className="dsk-who">
          <strong>{card.fullName}</strong>
          <span>{[card.designation, card.lgu].filter(Boolean).join(' · ')}</span>
          <span className="dsk-ref">{card.referenceCode}</span>
        </div>
      </div>

      {card.diet && <DietStrip diet={card.diet} />}

      <dl className="dsk-facts">
        <div><dt>Fee</dt><dd>{card.complimentary ? 'Waived' : formatPeso(card.amount)}</dd></div>
        <div><dt>Paid</dt><dd>{formatPeso(card.amountPaid)}</dd></div>
        <div className={owes ? 'is-owed' : ''}><dt>Balance</dt><dd>{formatPeso(card.balance)}</dd></div>
        <div className={card.shirtSizeChoices ? 'is-missing' : ''}><dt>Shirt</dt><dd>{card.shirtSize || 'None given'}</dd></div>
        {card.tour && <div className="is-wide"><dt>Tour</dt><dd>{card.tour}</dd></div>}
      </dl>

      {/* A prompt, not a gate: ask them now, and the kit still goes out if they can't say. */}
      {card.shirtSizeChoices && (
        <div className="dsk-shirt" role="group" aria-label="Record their shirt size">
          <p><i className="fas fa-shirt" aria-hidden="true" /> No shirt size on file. Ask them, then tap it:</p>
          <div className="dsk-shirt-sizes">
            {card.shirtSizeChoices.map((size) => (
              <button key={size} type="button" className="dash-btn is-ghost" disabled={busy} onClick={() => fillShirt(size)}>
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="dsk-steps">
        {DESK_STEPS.map((s) => {
          const at = card[s.field]
          // The payment row is a record, not a step: it shows once the ID & OR took the cash.
          if (s.step === 'Payment' && !at) return null
          const due = s.step === next?.step
          const released = s.step === 'Id' || s.step === 'Kit'
          // Handed over: one short line, so what is still to do stays in view.
          const folded = released && at
          return (
            <li key={s.step} className={folded ? 'is-done is-folded' : at ? 'is-done' : due ? 'is-next' : ''}>
              <i className={`fas ${at ? 'fa-circle-check' : due ? 'fa-circle-dot' : 'fa-circle'}`} aria-hidden="true" />
              <span className="dsk-step-label">
                {folded ? <>{s.label} released ✓ <small>{formatVenueTime(at.at)}</small></> : s.label}
              </span>
              {at && canUndoDeskStep(card, s.step) && undoing?.step !== s.step && (
                <button type="button" className="dsk-step-undo" disabled={busy} onClick={() => startUndo(s)}>
                  Undo
                </button>
              )}
              {at && !folded && (
                <span className="dsk-step-when">
                  {formatVenueTime(at.at)} · {at.by}{at.amount != null && <> · {formatPeso(at.amount)}</>}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {notice && (
        <div className="dash-banner tone-warn dsk-error" role="status">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" /> <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="dash-banner tone-error dsk-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{error.message}</span>
          {stale && (
            <button type="button" className="dash-btn is-ghost is-sm" disabled={busy} onClick={() => run(() => deskCard(card.eventId, card.id))}>
              Reload card
            </button>
          )}
        </div>
      )}

      {next ? (
        <button type="button" className="dash-btn is-primary dsk-go" disabled={busy} onClick={doNext}>
          {busy
            ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</>
            : next.step === 'Id' && owes
              ? <><i className="fas fa-money-bill-wave" aria-hidden="true" /> Release ID & OR · {formatPeso(card.balance)} paid</>
              : <><i className="fas fa-check" aria-hidden="true" /> {next.step === 'CheckIn' ? next.action : `Release ${next.label}`}</>}
        </button>
      ) : card.idRelease && card.kit ? (
        <p className="dsk-all-done"><i className="fas fa-circle-check" aria-hidden="true" /> All done at the desk.</p>
      ) : null}
      {next?.step === 'Id' && owes && <p className="dash-help dsk-face">Take the {formatPeso(card.balance)} first. The tap records it as paid.</p>}
      {next?.step === 'Kit' && <p className="dash-help dsk-face">Send them to Desk C for their kit.</p>}
      {next?.step === 'CheckIn' && <p className="dash-help dsk-face">Check the face against the person first.</p>}

      {undoing && (
        <form className="dsk-undo" onSubmit={undo}>
          <label className="dash-field">
            <span className="dash-label">Why undo the {undoing.undo}?</span>
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
            <button type="button" className="dash-btn is-ghost" disabled={busy} onClick={() => { setUndoing(null); setReason('') }}>Keep it</button>
            <button type="submit" className="dash-btn is-danger" disabled={busy || !reason.trim()}>Undo</button>
          </div>
        </form>
      )}

      <Trail stops={card.trail} />

      <button ref={done} type="button" className="dash-btn dsk-next" onClick={onDone}>
        <i className="fas fa-qrcode" aria-hidden="true" /> Next delegate
      </button>
      <style>{DSK_CARD_CSS}</style>
    </div>
  )
}

/**
 * Every checkpoint that applies to this delegate and how they stand at each — the answer to "did
 * they eat yesterday?" or "were they on their bus?" without opening each checkpoint's log. A bus is
 * only listed for those booked on it, so a missed one here is one they really missed.
 */
function Trail({ stops = [] }) {
  if (stops.length === 0) return null
  const missed = stops.filter((s) => s.status === 'Missed').length
  return (
    <section className="dsk-trail" aria-label="Checkpoints">
      <h3>
        Checkpoints
        {missed > 0 && <span className="dsk-trail-missed">{missed} missed</span>}
      </h3>
      <ol>
        {stops.map((s) => {
          const meta = TRAIL_STATUS[s.status] || TRAIL_STATUS.Upcoming
          return (
            <li key={s.checkpointId} className={meta.tone}>
              <i className={`fas ${meta.icon}`} aria-hidden="true" />
              <span className="dsk-trail-label">
                <i className={`fas ${kindMeta(s.kind).icon}`} aria-hidden="true" /> {s.label}
              </span>
              <span className="dsk-trail-when">
                {formatDay(s.day)} · {s.status === 'Scanned' ? formatVenueTime(s.at) : meta.label}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
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
  .dsk-desk.is-c { background: var(--navy); }
  .dsk-desk-name { font-weight: 900; font-size: 1.8rem; letter-spacing: 0.04em; }
  .dsk-desk-why { font-weight: 700; font-size: 1rem; }
  .dsk-note { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
  .dsk-session i { color: var(--ok); margin-right: 4px; }
  .dsk-countin { display: flex; flex-direction: column; gap: 8px; }
  .dsk-countin-go { width: 100%; min-height: 56px; justify-content: center; font-size: 1rem; }

  .dsk-person { display: flex; align-items: center; gap: 14px; }
  .dsk-who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .dsk-who strong { font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; color: var(--navy); text-transform: uppercase; overflow-wrap: anywhere; }
  .dsk-who span { font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }
  .dsk-ref { font-family: var(--font-heading) !important; font-weight: 700; letter-spacing: 0.06em; }

  /* Two across on a phone, so a peso amount never breaks mid-number; three once there's room. */
  .dsk-facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 0; }
  @media (min-width: 420px) { .dsk-facts { grid-template-columns: repeat(3, 1fr); } }
  .dsk-facts > div { padding: 10px 12px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); min-width: 0; }
  .dsk-facts > div.is-wide { grid-column: 1 / -1; }
  .dsk-facts > div.is-owed, .dsk-facts > div.is-missing { border-color: var(--warn); background: var(--warn-bg); }
  .dsk-shirt { margin-top: 10px; padding: 10px 12px; border: 1px dashed var(--warn); border-radius: var(--radius-sm); background: var(--white); }
  .dsk-shirt p { margin: 0 0 8px; font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; color: var(--navy); }
  .dsk-shirt p i { color: var(--warn); margin-right: 4px; }
  .dsk-shirt-sizes { display: flex; flex-wrap: wrap; gap: 8px; }
  .dsk-shirt-sizes .dash-btn { min-width: 52px; min-height: 44px; justify-content: center; font-weight: 800; }
  .dsk-facts dt { font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); }
  .dsk-facts dd { margin: 2px 0 0; font-family: var(--font-heading); font-weight: 800; color: var(--navy); overflow-wrap: anywhere; }

  .dsk-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .dsk-steps li { display: grid; grid-template-columns: 22px 1fr auto; column-gap: 10px; align-items: center; color: var(--gray-400); min-height: 44px; }
  .dsk-steps li i { font-size: 1.05rem; }
  .dsk-steps li.is-done { color: var(--ok); }
  .dsk-steps li.is-next { color: var(--gold-dark); }
  .dsk-step-label { font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
  .dsk-steps li.is-folded { min-height: 32px; }
  .dsk-steps li.is-folded .dsk-step-label { font-size: 0.9rem; color: var(--ok); }
  .dsk-step-label small { font-family: var(--font-body); font-weight: 400; font-size: 0.8rem; color: var(--gray-600); margin-left: 4px; }
  .dsk-steps li:not(.is-done):not(.is-next) .dsk-step-label { color: var(--gray-400); }
  .dsk-step-undo {
    grid-column: 3; grid-row: 1; min-height: 44px; padding: 0 12px; background: none; border: 0; cursor: pointer;
    color: var(--gray-600); text-decoration: underline; font-family: var(--font-body); font-size: 0.9rem;
  }
  .dsk-step-when { grid-column: 2; font-family: var(--font-body); font-size: 0.82rem; color: var(--gray-600); }

  .dsk-error { flex-wrap: wrap; }
  .dsk-go, .dsk-next { width: 100%; min-height: 56px; justify-content: center; font-size: 1rem; }
  .dsk-row { display: flex; gap: 10px; }
  .dsk-row .dash-btn { flex: 1; min-height: 48px; justify-content: center; }
  .dsk-all-done { font-family: var(--font-heading); font-weight: 800; color: var(--ok); text-align: center; padding: 8px; }
  .dsk-face { text-align: center; }
  .dsk-undo { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .dsk-undo .dash-input { font-size: 16px; min-height: 48px; }

  .dsk-trail { padding: 14px 16px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .dsk-trail h3 {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px;
    font-family: var(--font-heading); font-weight: 800; font-size: 0.74rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gray-600);
  }
  .dsk-trail-missed { padding: 2px 8px; border-radius: 999px; background: var(--bad-bg); color: var(--bad); letter-spacing: 0.04em; }
  .dsk-trail ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .dsk-trail li { display: grid; grid-template-columns: 22px 1fr; column-gap: 10px; align-items: center; }
  .dsk-trail li > i { font-size: 1.05rem; }
  .dsk-trail-label { font-family: var(--font-heading); font-weight: 700; color: var(--navy); overflow-wrap: anywhere; }
  .dsk-trail-label i { color: var(--gray-400); font-size: 0.8rem; margin-right: 2px; }
  .dsk-trail-when { grid-column: 2; font-family: var(--font-body); font-size: 0.82rem; color: var(--gray-600); }
  .dsk-trail li.is-scanned > i { color: var(--ok); }
  .dsk-trail li.is-missed > i, .dsk-trail li.is-missed .dsk-trail-when { color: var(--bad); }
  .dsk-trail li.is-notyet > i { color: var(--gold-dark); }
  .dsk-trail li.is-upcoming > i, .dsk-trail li.is-upcoming .dsk-trail-label { color: var(--gray-400); }
`

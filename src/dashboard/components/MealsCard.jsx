import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { formatDate } from '@/lib/pearlAwards'
import { useAsync } from '../useAsync'

/**
 * Dietary restrictions, per in-person delegate, on the booking page.
 *
 * <p>Built for the people with nothing to declare, because that is nearly everyone. Silence means
 * "no restrictions" (ATOP, 2026-09-25), so an unanswered row is shown as exactly that — not as a
 * warning — and the only call to action is for the few who need one. The optional "confirm the
 * rest" button exists to spare a delegation the reminder mail, not because anything is missing.</p>
 *
 * <p>The options come from the API, so adding one never touches this file. Food allergy and Other
 * ask for a sentence, because "allergy" alone gives a kitchen nothing to act on.</p>
 */
export default function MealsCard({ registrationId }) {
  const { data, loading, error, reload } = useAsync(
    () => api.get(`/registrations/${registrationId}/dietary`, { auth: true }),
    [registrationId],
  )

  // Saves write the fresh card straight in, so the list never blinks through a reload.
  const [fresh, setFresh] = useState(null)
  const card = fresh ?? data

  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [bulkError, setBulkError] = useState(null)

  // The request mail links to `#meals`. The card loads after the page does, so the browser's own
  // jump to the anchor has already missed; do it once the card is actually there.
  const location = useLocation()
  const ref = useRef(null)
  const scrolled = useRef(false)
  useEffect(() => {
    if (card && location.hash === '#meals' && !scrolled.current && ref.current) {
      scrolled.current = true
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [card, location.hash])

  if (error && !card) {
    return (
      <div className="dash-card dash-card-pad rd-card" id="meals">
        <h2 className="dash-card-title"><i className="fas fa-utensils" aria-hidden="true" /> Meals</h2>
        <p className="dash-help">{error.message || 'We couldn’t load the meal preferences just now.'}</p>
        <button type="button" className="dash-btn" onClick={reload}>
          <i className="fas fa-rotate-right" aria-hidden="true" /> Try again
        </button>
      </div>
    )
  }

  // Nobody here is attending in person — there is no meal to ask about.
  if (loading && !card) return null
  if (!card || card.delegates.length === 0) return null

  const labels = Object.fromEntries(card.options.map((o) => [o.code, o.label]))
  const unanswered = card.delegates.filter((d) => !d.answeredAt)
  const withNeeds = card.delegates.filter((d) => d.restrictions.length > 0 || d.notes)
  const open = card.open

  async function confirmRest() {
    setBulkError(null)
    setConfirming(true)
    try {
      setFresh(await api.post(`/registrations/${registrationId}/dietary/none`, undefined, { auth: true }))
      setEditing(null)
    } catch (err) {
      setBulkError(err)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="dash-card dash-card-pad rd-card mc-card" id="meals" ref={ref}>
      <h2 className="dash-card-title">
        <i className="fas fa-utensils" aria-hidden="true" /> Meals
        {withNeeds.length > 0 && (
          <span className="mc-count">{withNeeds.length} with dietary needs</span>
        )}
      </h2>

      {open ? (
        <div className="mc-callout">
          <i className="fas fa-circle-check" aria-hidden="true" />
          <div>
            <strong>No restrictions? You don’t need to do anything.</strong>
            <span>
              Anyone we haven’t heard from is catered as having no restrictions.
              {' '}If someone is vegetarian, halal, avoids pork or seafood, or has a food allergy,
              add it below{card.closesAt ? ` by ${formatDate(card.closesAt)}` : ''}.
            </span>
          </div>
        </div>
      ) : (
        <p className="dash-help mc-intro">
          Meal preferences have closed and gone to the caterer. Contact the ATOP Secretariat for changes.
        </p>
      )}

      {bulkError && <div className="mc-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {bulkError.message}</div>}

      <div className="mc-rows">
        {card.delegates.map((d) =>
          editing === d.delegateId ? (
            <DietEditor
              key={d.delegateId}
              saveUrl={`/registrations/${registrationId}/delegates/${d.delegateId}/dietary`}
              attendee={d}
              options={card.options}
              onCancel={() => setEditing(null)}
              onSaved={(next) => { setFresh(next); setEditing(null) }}
            />
          ) : (
            <div key={d.delegateId} className="mc-row">
              <div className="mc-who">
                <span className="mc-name">{d.fullName}</span>
                <DietAnswer attendee={d} labels={labels} />
              </div>
              {open && (
                <button
                  type="button"
                  className="dash-btn is-sm mc-action"
                  onClick={() => setEditing(d.delegateId)}
                >
                  {d.restrictions.length > 0 || d.notes
                    ? <><i className="fas fa-pen" aria-hidden="true" /> Edit</>
                    : <><i className="fas fa-plus" aria-hidden="true" /> Add restriction</>}
                </button>
              )}
            </div>
          ),
        )}
      </div>

      {open && unanswered.length > 0 && editing === null && (
        <div className="mc-bulk">
          <button type="button" className="dash-btn is-ghost is-sm" disabled={confirming} onClick={confirmRest}>
            <i className={`fas ${confirming ? 'fa-spinner fa-spin' : 'fa-check-double'}`} aria-hidden="true" />
            {unanswered.length === card.delegates.length
              ? ' Confirm no one has restrictions'
              : ` Confirm no restrictions for the other ${unanswered.length}`}
          </button>
          <span className="dash-help">Optional — it just means we won’t send you a reminder.</span>
        </div>
      )}

      <style>{mcStyles}</style>
    </div>
  )
}

export function DietAnswer({ attendee, labels }) {
  if (attendee.restrictions.length > 0 || attendee.notes) {
    return (
      <span className="mc-needs">
        {attendee.restrictions.map((code) => (
          <span key={code} className="mc-chip is-static">{labels[code] ?? code}</span>
        ))}
        {attendee.notes && <span className="mc-note">“{attendee.notes}”</span>}
      </span>
    )
  }

  return attendee.answeredAt
    ? <span className="mc-none"><i className="fas fa-check" aria-hidden="true" /> No restrictions</span>
    : <span className="mc-none is-assumed">No restrictions</span>
}

/**
 * One delegate's chips and note. Exported for the secretariat's booking view, which saves the
 * same shape to its own endpoint — answers come in by phone.
 */
export function DietEditor({ saveUrl, attendee, options, onCancel, onSaved }) {
  const [chosen, setChosen] = useState(attendee.restrictions)
  const [notes, setNotes] = useState(attendee.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const needsNotes = options.some((o) => o.needsNotes && chosen.includes(o.code))
  const notesMissing = needsNotes && !notes.trim()

  const toggle = (code) =>
    setChosen((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]))

  async function save(restrictions, note) {
    setError(null)
    setSaving(true)
    try {
      onSaved(await api.put(
        saveUrl,
        { restrictions, notes: note || null },
        { auth: true },
      ))
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  const fieldError = error?.fieldErrors?.notes?.[0] ?? error?.fieldErrors?.restrictions?.[0]

  return (
    <div className="mc-row is-editing">
      <span className="mc-name">{attendee.fullName}</span>

      <div className="mc-chips" role="group" aria-label={`Dietary restrictions for ${attendee.fullName}`}>
        {options.map((o) => {
          const on = chosen.includes(o.code)
          return (
            <button
              key={o.code}
              type="button"
              className={`mc-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(o.code)}
            >
              {on && <i className="fas fa-check" aria-hidden="true" />} {o.label}
            </button>
          )
        })}
      </div>

      <label className="dash-field mc-notes">
        <span className="dash-label">
          {needsNotes ? <>What is the allergy or restriction?<span className="req">*</span></> : 'Anything else the kitchen should know?'}
        </span>
        <input
          className={`dash-input${notesMissing && error ? ' has-error' : ''}`}
          value={notes}
          maxLength={300}
          placeholder={needsNotes ? 'e.g. Peanuts — severe; shellfish' : 'Optional'}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {(fieldError || (error && !fieldError)) && (
        <div className="dash-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {fieldError ?? error.message}</div>
      )}

      <div className="mc-editor-actions">
        <button
          type="button"
          className="dash-btn is-primary is-sm"
          disabled={saving || notesMissing || (chosen.length === 0 && !notes.trim())}
          onClick={() => save(chosen, notes.trim())}
        >
          {saving ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-check" aria-hidden="true" />} Save
        </button>
        <button type="button" className="dash-btn is-sm" disabled={saving} onClick={() => save([], '')}>
          No restrictions
        </button>
        <button type="button" className="dash-btn is-ghost is-sm" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export const mcStyles = `
  .mc-count { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.02em; text-transform: none; color: var(--navy); background: #eef2f9; padding: 3px 9px; border-radius: 999px; margin-left: 4px; }
  .mc-intro { margin-bottom: 14px; }
  .mc-callout { display: flex; gap: 11px; align-items: flex-start; background: #F0FDF4; border: 1px solid #BBF7D0; color: #14532D; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; font-size: 0.86rem; line-height: 1.5; }
  .mc-callout i { color: #15803D; margin-top: 3px; }
  .mc-callout strong { display: block; }
  .mc-callout span { color: #166534; }
  .mc-error { display: flex; gap: 8px; align-items: center; background: #fdeaea; color: #8a1c1c; border-radius: 8px; padding: 10px 12px; font-size: 0.85rem; margin-bottom: 12px; }

  .mc-rows { display: grid; gap: 8px; }
  .mc-row { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-lg); }
  .mc-row.is-editing { display: grid; gap: 12px; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,168,75,0.12); }
  .mc-who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .mc-name { font-weight: 600; color: var(--navy); font-size: 0.88rem; }
  .mc-none { font-size: 0.78rem; color: #15803D; }
  .mc-none.is-assumed { color: var(--gray-400); }
  .mc-needs { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .mc-note { font-size: 0.78rem; color: var(--gray-600); font-style: italic; }
  .mc-action { flex-shrink: 0; }

  .mc-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .mc-chip { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-body); font-size: 0.8rem; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--gray-200); background: var(--white); color: var(--text-body); cursor: pointer; transition: var(--transition-fast); }
  .mc-chip:hover { border-color: var(--navy); }
  .mc-chip.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .mc-chip.is-on i { font-size: 0.68rem; }
  .mc-chip.is-static { cursor: default; font-size: 0.72rem; padding: 3px 9px; background: #FFF7ED; border-color: #FED7AA; color: #9A3412; }
  .mc-notes { max-width: 520px; }
  .mc-editor-actions { display: flex; flex-wrap: wrap; gap: 8px; }

  .mc-bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 12px; }

  @media (max-width: 640px) {
    .mc-row { flex-direction: column; align-items: stretch; }
    .mc-action { align-self: flex-start; }
  }
`

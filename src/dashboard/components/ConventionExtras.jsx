import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'

/**
 * Tour and shirt size, per delegate, on the booking page.
 *
 * <p>The person reading this is usually the LGU focal point who booked for five other people, so
 * the card is a checklist of who is still missing something rather than a form. Anyone not yet
 * eligible is shown too, with the reason — most often an unpaid seat, and being told that here is
 * the point.</p>
 *
 * <p>Fetches its own data. The registration endpoint knows nothing about tours, and threading a
 * second payload through the parent's polling — which runs every five seconds while an invoice is
 * open — would refetch the whole catalogue for no reason.</p>
 */
export default function ConventionExtras({ registrationId }) {
  const { data, loading, error, reload } = useAsync(
    () => api.get(`/registrations/${registrationId}/tours`, { auth: true }),
    [registrationId],
  )

  const navigate = useNavigate()
  const [savingSize, setSavingSize] = useState(null)
  const [sizeError, setSizeError] = useState(null)

  // The picker is a route, not a dialog — the posters need the whole page to be legible.
  const pick = (delegateId) =>
    navigate(`/convention/registrations/${registrationId}/tours/${delegateId}`)

  // Still keyed on `data` for the happy path: useAsync flips loading on every reload while keeping
  // the last payload, and hiding the card each time someone picks a tour would make it blink out
  // from under the cursor. So only the *first* load — the one with nothing to show yet — reports
  // its state.
  //
  // It used to stay silent on failure too, on the reasoning that the booking is the page and this
  // is an addition to it. That stopped being true the day ATOP mailed every delegate a link telling
  // them to come here and choose: a failed load removed the entire card, and a page that looks
  // complete with no tour section on it is indistinguishable from an event with no tours. People
  // reported it as "I paid but I can't get into the tour", which is exactly what they saw.
  if (error && !data) {
    return (
      <div className="dash-card dash-card-pad rd-card">
        <h2 className="dash-card-title">Tours &amp; convention kit</h2>
        <p className="dash-help">
          {error.message || 'We couldn’t load the tours just now.'}
        </p>
        <button type="button" className="dash-btn" onClick={reload}>
          <i className="fas fa-rotate-right" aria-hidden="true" /> Try again
        </button>
        <style>{ceStyles}</style>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="dash-card dash-card-pad rd-card">
        <h2 className="dash-card-title">Tours &amp; convention kit</h2>
        <p className="dash-help" role="status" aria-live="polite">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading the tours…
        </p>
        <style>{ceStyles}</style>
      </div>
    )
  }

  if (!data || data.packages.length === 0) return null

  const eligible = data.delegates.filter((d) => d.canChoose)
  const reasons = new Set(data.delegates.map((d) => d.ineligibleReason).filter(Boolean))

  // Nobody on this booking can choose yet. One line explaining why beats a card of disabled
  // controls — but only when there is genuinely one reason to give. A mixed delegation has more
  // than one, and picking the first delegate's told a five-person booking with two online and
  // three unpaid seats that "the tours are for delegates attending in person": true of the two the
  // list happened to be sorted by, useless to the three whose seats simply need settling. Where
  // the reasons differ, fall through to the rows, which name each person beside their own.
  if (eligible.length === 0 && reasons.size === 1) {
    return (
      <div className="dash-card dash-card-pad rd-card">
        <h2 className="dash-card-title">Tours &amp; convention kit</h2>
        <p className="dash-help">{[...reasons][0]}</p>
        <style>{ceStyles}</style>
      </div>
    )
  }

  if (eligible.length === 0 && reasons.size === 0) return null

  const outstanding = eligible.filter((d) => !d.tourBatchId || !d.shirtSize).length
  const closed = !data.selectionOpen

  async function setSize(delegateId, shirtSize) {
    setSizeError(null)
    setSavingSize(delegateId)
    try {
      await api.put(
        `/registrations/${registrationId}/delegates/${delegateId}/shirt-size`,
        { shirtSize: shirtSize || null },
        { auth: true },
      )
      reload()
    } catch (err) {
      setSizeError(err)
    } finally {
      setSavingSize(null)
    }
  }

  return (
    <div className="dash-card dash-card-pad rd-card">
      <h2 className="dash-card-title">
        Tours &amp; convention kit
        {outstanding > 0 && !closed && (
          <span className="ce-todo">{outstanding} still to complete</span>
        )}
      </h2>

      <p className="dash-help ce-intro">
        {closed
          ? 'Tour selection and kit sizing have closed. Contact the ATOP Secretariat for changes.'
          : 'Every delegate attending in person can join one free half-day tour of Ormoc. '
            + 'Seats are limited and first-come.'}
      </p>

      {sizeError && (
        <div className="ce-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{sizeError.message}</span>
        </div>
      )}

      <div className="ce-rows">
        {data.delegates.map((d) => (
          <div key={d.delegateId} className={`ce-row${d.canChoose ? '' : ' is-off'}`}>
            <div className="ce-who">
              <span className="ce-name">{d.fullName}</span>
              {!d.canChoose && <span className="ce-why">{d.ineligibleReason}</span>}
            </div>

            {d.canChoose && (
              <>
                <div className="ce-tour">
                  {d.tourBatchId ? (
                    <button
                      type="button"
                      className="ce-chosen"
                      disabled={closed}
                      onClick={() => pick(d.delegateId)}
                    >
                      <i className="fas fa-van-shuttle" aria-hidden="true" />
                      <span>
                        <strong>{d.tourPackageName}</strong>
                        <em>{d.tourBatchLabel}</em>
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ce-choose"
                      disabled={closed}
                      onClick={() => pick(d.delegateId)}
                    >
                      <i className="fas fa-plus" aria-hidden="true" /> Choose a tour
                    </button>
                  )}
                </div>

                <label className="ce-size">
                  <span className="ce-size-label">Shirt</span>
                  <select
                    className="dash-input ce-size-select"
                    value={d.shirtSize ?? ''}
                    disabled={closed || savingSize === d.delegateId}
                    onChange={(e) => setSize(d.delegateId, e.target.value)}
                  >
                    <option value="">—</option>
                    {data.shirtSizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        ))}
      </div>

      <style>{ceStyles}</style>
    </div>
  )
}

const ceStyles = `
  .ce-intro { margin-bottom: 14px; }
  .ce-todo { font-size: 0.72rem; font-weight: 700; color: #a35c00; background: #fff3e0; padding: 3px 8px; border-radius: 999px; margin-left: 8px; }
  .ce-error { display: flex; gap: 8px; align-items: flex-start; background: #fdeaea; color: #8a1c1c; border-radius: 8px; padding: 10px 12px; font-size: 0.85rem; margin-bottom: 12px; }

  .ce-rows { display: grid; gap: 8px; }
  .ce-row { display: grid; grid-template-columns: minmax(120px, 1.1fr) minmax(0, 1.4fr) auto; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-lg); }
  .ce-row.is-off { grid-template-columns: 1fr; background: var(--gray-50, #fafbfc); }
  .ce-name { display: block; font-weight: 600; color: var(--navy); font-size: 0.88rem; }
  .ce-why { display: block; color: var(--gray-600); font-size: 0.76rem; line-height: 1.4; margin-top: 3px; }

  .ce-choose { width: 100%; padding: 8px 10px; border: 1px dashed var(--gray-300); border-radius: 8px; background: none; color: var(--gray-600); font-size: 0.82rem; cursor: pointer; text-align: left; }
  .ce-choose:hover:not(:disabled) { border-color: var(--navy); color: var(--navy); }
  .ce-chosen { display: flex; gap: 9px; align-items: center; width: 100%; padding: 7px 10px; border: 1px solid var(--gray-200); border-radius: 8px; background: #f7f9fd; cursor: pointer; text-align: left; }
  .ce-chosen:hover:not(:disabled) { border-color: var(--navy); }
  .ce-chosen i { color: var(--navy); }
  .ce-chosen strong { display: block; font-size: 0.82rem; color: var(--navy); font-weight: 700; line-height: 1.25; }
  .ce-chosen em { display: block; font-style: normal; font-size: 0.74rem; color: var(--gray-600); margin-top: 1px; }
  .ce-choose:disabled, .ce-chosen:disabled { cursor: default; opacity: 0.7; }

  .ce-size { display: flex; align-items: center; gap: 7px; }
  .ce-size-label { font-size: 0.76rem; color: var(--gray-600); }
  .ce-size-select { width: 76px; padding: 6px 8px; font-size: 0.82rem; }

  @media (max-width: 640px) {
    .ce-row { grid-template-columns: 1fr; gap: 8px; }
    .ce-size { justify-content: space-between; }
  }
`

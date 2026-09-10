import { useState } from 'react'
import { api } from '@/lib/apiClient'
import Modal from './Modal'

/**
 * Choose one tour batch for one delegate.
 *
 * Two steps on purpose. The six packages are posters people have already seen on Facebook, so the
 * first screen shows them as posters and nothing else; the batch — the thing that is actually
 * capped, and the thing they have to be back from before the afternoon sessions — gets a screen of
 * its own rather than a dropdown buried on a card.
 *
 * Seat counts come from the server and are stale the moment they render. That is not a bug to paper
 * over: the picker shows what it last heard, and a claim that loses the race comes back 409 with the
 * batch marked full, at which point the parent refetches. Optimistically hiding a full batch would
 * only move the disappointment somewhere less explicable.
 */
export default function TourPicker({ registrationId, delegate, packages, onClose, onDone }) {
  const chosenPackage = packages.find((p) => p.batches.some((b) => b.id === delegate.tourBatchId))

  const [pkg, setPkg] = useState(chosenPackage ?? null)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  async function choose(batchId) {
    setError(null)
    setSaving(batchId)
    try {
      await api.put(
        `/registrations/${registrationId}/delegates/${delegate.delegateId}/tour`,
        { batchId },
        { auth: true },
      )
      onDone()
    } catch (err) {
      setError(err)
      // The counts on screen are now provably wrong, so pull fresh ones rather than leaving a
      // "3 left" next to a batch we have just been told is full.
      onDone({ keepOpen: true })
    } finally {
      setSaving(null)
    }
  }

  async function clear() {
    setError(null)
    setSaving('clear')
    try {
      await api.delete(
        `/registrations/${registrationId}/delegates/${delegate.delegateId}/tour`,
        { auth: true },
      )
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Modal title={`Tour for ${delegate.fullName}`} onClose={onClose}>
      {error && (
        <div className="tp-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{error.message}</span>
        </div>
      )}

      {!pkg ? (
        <>
          <p className="dash-help tp-intro">
            Six half-day tours, all free and all limited. Pick one to see its batches.
          </p>

          <div className="tp-packages">
            {packages.map((p) => {
              const soldOut = p.seatsLeft <= 0
              return (
                <button
                  type="button"
                  key={p.id}
                  className={`tp-pkg${soldOut ? ' is-out' : ''}`}
                  disabled={soldOut}
                  onClick={() => setPkg(p)}
                >
                  {p.posterKey ? (
                    <img className="tp-pkg-poster" src={`/tours/${p.posterKey}`} alt="" loading="lazy" />
                  ) : (
                    <div className="tp-pkg-poster tp-pkg-noposter" />
                  )}
                  <div className="tp-pkg-body">
                    <span className="tp-pkg-name">{p.name}</span>
                    {p.tagline && <span className="tp-pkg-tag">{p.tagline}</span>}
                    <span className={`tp-pkg-left${soldOut ? ' is-out' : ''}`}>
                      {soldOut ? 'Fully booked' : `${p.seatsLeft} of ${p.capacity} seats left`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {delegate.tourBatchId && (
            <button type="button" className="tp-clear" disabled={saving === 'clear'} onClick={clear}>
              <i className="fas fa-xmark" aria-hidden="true" />
              {saving === 'clear' ? ' Removing…' : ` Remove ${delegate.fullName} from ${delegate.tourBatchLabel}`}
            </button>
          )}
        </>
      ) : (
        <>
          <button type="button" className="tp-back" onClick={() => setPkg(null)}>
            <i className="fas fa-arrow-left" aria-hidden="true" /> All tours
          </button>

          <h4 className="tp-detail-name">{pkg.name}</h4>
          {pkg.summary && <p className="tp-detail-summary">{pkg.summary}</p>}

          {/* The poster gives this the same weight — a health warning under a fold nobody scrolls
              to is not a warning. */}
          {pkg.advisory && (
            <p className="tp-advisory">
              <i className="fas fa-triangle-exclamation" aria-hidden="true" /> {pkg.advisory}
            </p>
          )}

          <div className="tp-lists">
            <div>
              <h5>Included</h5>
              <ul className="tp-inc">
                {pkg.inclusions.map((item) => (
                  <li key={item}><i className="fas fa-check" aria-hidden="true" /> {item}</li>
                ))}
              </ul>
            </div>
            {pkg.exclusions.length > 0 && (
              <div>
                <h5>Not included</h5>
                <ul className="tp-exc">
                  {pkg.exclusions.map((item) => (
                    <li key={item}><i className="fas fa-xmark" aria-hidden="true" /> {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <h5 className="tp-batches-head">Choose a batch</h5>

          <div className="tp-batches">
            {pkg.batches.map((b) => {
              const mine = b.id === delegate.tourBatchId
              return (
                <div key={b.id} className={`tp-batch${mine ? ' is-mine' : ''}${b.isFull && !mine ? ' is-full' : ''}`}>
                  <div className="tp-batch-head">
                    <div>
                      <span className="tp-batch-label">{b.label}</span>
                      <span className="tp-batch-time">
                        <i className="fas fa-clock" aria-hidden="true" /> assembly {b.assemblyTime}
                        {b.tourDate ? ` · ${b.tourDate}` : ' · date to be announced'}
                      </span>
                    </div>
                    <span className={`tp-batch-left${b.isFull ? ' is-out' : ''}`}>
                      {b.isFull ? 'Full' : `${b.seatsLeft} left`}
                    </span>
                  </div>

                  {b.assemblyPoint && (
                    <p className="tp-batch-where">
                      <i className="fas fa-location-dot" aria-hidden="true" /> {b.assemblyPoint}
                    </p>
                  )}

                  <ol className="tp-itin">
                    {b.itinerary.map((stop, i) => (
                      <li key={`${stop.time}-${stop.activity}-${i}`}>
                        {stop.time && <span className="tp-itin-time">{stop.time}</span>}
                        <span className="tp-itin-what">{stop.activity}</span>
                      </li>
                    ))}
                  </ol>

                  <button
                    type="button"
                    className={`tp-pick${mine ? ' is-mine' : ''}`}
                    disabled={mine || (b.isFull && !mine) || saving === b.id}
                    onClick={() => choose(b.id)}
                  >
                    {mine
                      ? <><i className="fas fa-check" aria-hidden="true" /> Booked on this batch</>
                      : saving === b.id
                        ? 'Booking…'
                        : b.isFull ? 'Fully booked' : 'Book this batch'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`
        .tp-error { display: flex; gap: 8px; align-items: flex-start; background: #fdeaea; color: #8a1c1c; border-radius: 8px; padding: 10px 12px; font-size: 0.85rem; margin-bottom: 14px; }
        .tp-intro { margin-bottom: 12px; }

        /* Six portrait flyers do not fit a viewport, and the shared Modal has no height cap of its
           own — without this the dialog grows past the top of the screen and takes its close button
           with it. Scrolling the list rather than the dialog keeps the title and X reachable. */
        .tp-packages { display: grid; gap: 10px; max-height: min(62vh, 520px); overflow-y: auto; padding-right: 2px; }
        .tp-pkg { display: flex; gap: 12px; align-items: stretch; text-align: left; padding: 0; overflow: hidden; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-lg); cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s; }
        .tp-pkg:hover:not(:disabled) { border-color: var(--navy); box-shadow: 0 4px 14px rgba(15,25,46,0.09); }
        .tp-pkg.is-out { opacity: 0.55; cursor: not-allowed; }
        /* Framed on the title band rather than the whole sheet: at this size a full flyer is an
           unreadable stamp, while the headline is the part someone recognises from Facebook. */
        .tp-pkg-poster { width: 82px; flex: 0 0 82px; object-fit: cover; object-position: center 20%; display: block; align-self: stretch; }
        .tp-pkg-noposter { background: var(--gray-100); }
        .tp-pkg-body { display: flex; flex-direction: column; gap: 3px; padding: 11px 12px 11px 0; min-width: 0; }
        .tp-pkg-name { font-weight: 700; color: var(--navy); font-size: 0.92rem; line-height: 1.25; }
        .tp-pkg-tag { color: var(--gray-600); font-size: 0.78rem; line-height: 1.3; }
        .tp-pkg-left { font-size: 0.75rem; font-weight: 600; color: #1c7a4a; margin-top: 2px; }
        .tp-pkg-left.is-out { color: #8a1c1c; }

        .tp-clear { margin-top: 14px; width: 100%; padding: 9px; border: 1px dashed var(--gray-300); border-radius: 8px; background: none; color: var(--gray-600); font-size: 0.82rem; cursor: pointer; }
        .tp-clear:hover { border-color: #8a1c1c; color: #8a1c1c; }

        .tp-back { border: none; background: none; color: var(--gray-600); font-size: 0.82rem; cursor: pointer; padding: 0 0 10px; }
        .tp-back:hover { color: var(--navy); }
        .tp-detail-name { font-family: var(--font-heading); font-size: 1rem; font-weight: 800; color: var(--navy); }
        .tp-detail-summary { color: var(--gray-600); font-size: 0.84rem; line-height: 1.5; margin-top: 4px; }

        .tp-advisory { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; padding: 10px 12px; background: #fff6e5; border-left: 3px solid #c8871a; border-radius: 6px; color: #7a5210; font-size: 0.82rem; line-height: 1.45; }

        .tp-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
        .tp-lists h5 { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gray-600); margin-bottom: 6px; }
        .tp-inc, .tp-exc { display: grid; gap: 4px; font-size: 0.8rem; color: var(--gray-700, #3d4a5c); line-height: 1.4; }
        .tp-inc li, .tp-exc li { display: grid; grid-template-columns: 14px 1fr; gap: 7px; align-items: start; }
        .tp-inc i { color: #1c7a4a; margin-top: 3px; }
        .tp-exc i { color: #a33; margin-top: 3px; }

        .tp-batches-head { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gray-600); margin: 18px 0 8px; }
        .tp-batches { display: grid; gap: 10px; max-height: min(46vh, 420px); overflow-y: auto; padding-right: 2px; }
        .tp-batch { border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: 12px 13px; }
        .tp-batch.is-mine { border-color: var(--navy); background: #f7f9fd; }
        .tp-batch.is-full { opacity: 0.6; }
        .tp-batch-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .tp-batch-label { display: block; font-weight: 700; color: var(--navy); font-size: 0.88rem; }
        .tp-batch-time { display: block; color: var(--gray-600); font-size: 0.76rem; margin-top: 2px; }
        .tp-batch-left { font-size: 0.75rem; font-weight: 700; color: #1c7a4a; white-space: nowrap; }
        .tp-batch-left.is-out { color: #8a1c1c; }
        .tp-batch-where { color: var(--gray-600); font-size: 0.76rem; margin-top: 6px; }

        .tp-itin { margin: 9px 0 0; padding: 0; list-style: none; display: grid; gap: 3px; }
        .tp-itin li { display: grid; grid-template-columns: 62px 1fr; gap: 8px; font-size: 0.76rem; color: var(--gray-700, #3d4a5c); line-height: 1.35; }
        .tp-itin-time { font-weight: 600; color: var(--gray-600); font-variant-numeric: tabular-nums; }
        .tp-itin-what { grid-column: 2; }

        .tp-pick { margin-top: 11px; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--navy); background: var(--navy); color: var(--white); font-size: 0.83rem; font-weight: 600; cursor: pointer; }
        .tp-pick:hover:not(:disabled) { filter: brightness(1.15); }
        .tp-pick:disabled { cursor: default; }
        .tp-pick.is-mine { background: none; color: #1c7a4a; border-color: #1c7a4a; }
        .tp-pick:disabled:not(.is-mine) { background: var(--gray-200); border-color: var(--gray-200); color: var(--gray-600); }

        @media (max-width: 520px) {
          .tp-lists { grid-template-columns: 1fr; gap: 12px; }
        }
      `}</style>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'

/**
 * Choosing a tour, on a page of its own rather than in a dialog.
 *
 * <p>The posters are the product. Each flyer already carries the inclusions, the exclusions, the
 * itinerary and the batch times, and every delegate has seen it on Facebook — so the job here is to
 * show them at a size where they can be read, not to re-typeset them beside a thumbnail. A 520px
 * modal could not do that, which is the whole reason this is a route.</p>
 *
 * <p>Two steps: browse the six, then pick a batch. Selecting a batch is a genuine one-of-N choice,
 * so it is a genuine radio group — one confirm button for the page instead of a button per batch,
 * and screen readers get "radio, 2 of 4" for free.</p>
 */
export default function TourPickerPage() {
  const { id, delegateId } = useParams()
  const navigate = useNavigate()

  const { loading, error, data, reload } = useAsync(
    () => api.get(`/registrations/${id}/tours`, { auth: true }),
    [id],
  )

  // `undefined` means "the user hasn't touched this yet", which is different from "they backed out
  // to the grid" (null). Both selections fall back to whatever is already booked, so re-opening
  // lands where they left off — derived rather than synced into state by an effect, which would
  // fight the user the moment a reload arrived.
  const [chosenCode, setChosenCode] = useState(undefined)
  const [pickedBatch, setPickedBatch] = useState(undefined)
  const [zoomed, setZoomed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const delegate = data?.delegates.find((d) => d.delegateId === delegateId)
  const booked = data?.packages.find((p) => p.batches.some((b) => b.id === delegate?.tourBatchId))

  const packageCode = chosenCode !== undefined ? chosenCode : booked?.code ?? null
  const batchId = pickedBatch !== undefined ? pickedBatch : delegate?.tourBatchId ?? null
  const pkg = data?.packages.find((p) => p.code === packageCode)

  useEffect(() => {
    if (!zoomed) return
    const onKey = (e) => { if (e.key === 'Escape') setZoomed(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [zoomed])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data || !delegate) return <ErrorState error={{ message: 'That delegate is not on this booking.' }} />

  const backToBooking = () => navigate(`/convention/registrations/${id}`)

  async function confirm() {
    setSaveError(null)
    setSaving(true)
    try {
      await api.put(`/registrations/${id}/delegates/${delegateId}/tour`, { batchId }, { auth: true })
      backToBooking()
    } catch (err) {
      setSaveError(err)
      // The seat counts on screen are now provably stale, so pull fresh ones rather than leaving
      // "3 left" beside a batch we have just been told is full.
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    setSaveError(null)
    setSaving(true)
    try {
      await api.delete(`/registrations/${id}/delegates/${delegateId}/tour`, { auth: true })
      backToBooking()
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tpp">
      <button type="button" className="tpp-back" onClick={pkg ? () => { setChosenCode(null); setPickedBatch(null) } : backToBooking}>
        <i className="fas fa-arrow-left" aria-hidden="true" /> {pkg ? 'All tours' : 'Back to booking'}
      </button>

      <header className="tpp-head">
        <h1>{pkg ? pkg.name : 'Choose a tour'}</h1>
        <p>
          {pkg
            ? pkg.tagline || 'Pick the batch that suits the rest of your day.'
            : <>Six half-day tours of Ormoc for <strong>{delegate.fullName}</strong>. All free, all limited.</>}
        </p>
      </header>

      {saveError && (
        <div className="tpp-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{saveError.message}</span>
        </div>
      )}

      {!data.selectionOpen && (
        <div className="tpp-closed">
          Tour selection has closed. Contact the ATOP Secretariat for changes.
        </div>
      )}

      {!pkg ? (
        <ul className="tpp-grid">
          {data.packages.map((p) => {
            const out = p.seatsLeft <= 0
            const current = delegate.tourBatchId
              && p.batches.some((b) => b.id === delegate.tourBatchId)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`tpp-tile${out ? ' is-out' : ''}${current ? ' is-current' : ''}`}
                  disabled={out || !data.selectionOpen}
                  onClick={() => { setChosenCode(p.code); setPickedBatch(current ? delegate.tourBatchId : null) }}
                >
                  {/* Whole sheet, uncropped. Everything a delegate needs to decide is printed on it. */}
                  {p.posterKey
                    ? <img className="tpp-poster" src={`/tours/${p.posterKey}`} alt={p.name} loading="lazy" />
                    : <div className="tpp-poster tpp-poster-none" aria-hidden="true" />}

                  <span className="tpp-cap">
                    <span className="tpp-cap-name">{p.name}</span>
                    <span className="tpp-cap-meta">
                      <span className={`tpp-left${out ? ' is-out' : ''}`}>
                        {out ? 'Fully booked' : `${p.seatsLeft} of ${p.capacity} left`}
                      </span>
                      {current && <span className="tpp-current">Current choice</span>}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="tpp-detail">
          <div className="tpp-detail-poster">
            {pkg.posterKey && (
              <button type="button" className="tpp-zoombtn" onClick={() => setZoomed(pkg)}>
                <img src={`/tours/${pkg.posterKey}`} alt={pkg.name} />
                <span className="tpp-zoomhint"><i className="fas fa-magnifying-glass-plus" aria-hidden="true" /> Full size</span>
              </button>
            )}
          </div>

          <div className="tpp-detail-side">
            {pkg.advisory && (
              <p className="tpp-advisory">
                <i className="fas fa-triangle-exclamation" aria-hidden="true" /> {pkg.advisory}
              </p>
            )}

            {/* A real radio group: one choice, one confirm. The itinerary lives on the poster
                beside it, so these rows carry only what separates one batch from another. */}
            <fieldset className="tpp-batches" disabled={!data.selectionOpen}>
              <legend>Batch</legend>

              {pkg.batches.map((b) => {
                const mine = b.id === delegate.tourBatchId
                const blocked = b.isFull && !mine
                return (
                  <label key={b.id} className={`tpp-batch${blocked ? ' is-blocked' : ''}`}>
                    <input
                      type="radio"
                      name="batch"
                      value={b.id}
                      checked={batchId === b.id}
                      disabled={blocked}
                      onChange={() => setPickedBatch(b.id)}
                    />
                    <span className="tpp-batch-body">
                      <span className="tpp-batch-label">
                        {b.label}
                        {mine && <span className="tpp-batch-mine">current</span>}
                      </span>
                      <span className="tpp-batch-meta">
                        assembly {b.assemblyTime}
                        {b.tourDate ? ` · ${b.tourDate}` : ' · date to be announced'}
                        {b.assemblyPoint ? ` · ${b.assemblyPoint}` : ''}
                      </span>
                    </span>
                    <span className={`tpp-batch-left${b.isFull ? ' is-out' : ''}`}>
                      {b.isFull ? 'Full' : `${b.seatsLeft} left`}
                    </span>
                  </label>
                )
              })}
            </fieldset>

            <div className="tpp-actions">
              <button
                type="button"
                className="tpp-confirm"
                disabled={!batchId || batchId === delegate.tourBatchId || saving || !data.selectionOpen}
                onClick={confirm}
              >
                {saving ? 'Saving…' : delegate.tourBatchId ? 'Move to this batch' : 'Confirm this batch'}
              </button>

              {delegate.tourBatchId && (
                <button type="button" className="tpp-clear" disabled={saving} onClick={clear}>
                  Remove from tour
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {zoomed && (
        <div className="tpp-lightbox" onClick={() => setZoomed(null)} role="presentation">
          <img src={`/tours/${zoomed.posterKey}`} alt={zoomed.name} />
          <button type="button" className="tpp-lightbox-close" aria-label="Close">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
      )}

      <style>{`
        .tpp { max-width: 1180px; margin: 0 auto; padding: 22px 20px 60px; }

        .tpp-back { border: none; background: none; color: var(--gray-600); font-size: 0.85rem; cursor: pointer; padding: 0 0 12px; }
        .tpp-back:hover { color: var(--navy); }

        .tpp-head h1 { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800; color: var(--navy); }
        .tpp-head p { color: var(--gray-600); font-size: 0.9rem; margin-top: 5px; }

        .tpp-error { display: flex; gap: 8px; margin-top: 16px; padding: 11px 13px; background: #fdeaea; color: #8a1c1c; border-radius: 6px; font-size: 0.86rem; }
        .tpp-closed { margin-top: 16px; padding: 11px 13px; background: var(--gray-100); color: var(--gray-600); border-radius: 6px; font-size: 0.86rem; }

        /* Poster-first. The tile is the sheet plus a caption — no card chrome around it, because
           the flyer already has its own frame and stacking one on another just adds noise. */
        .tpp-grid { list-style: none; margin: 22px 0 0; padding: 0; display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
        .tpp-tile { display: block; width: 100%; padding: 0; border: none; background: none; text-align: left; cursor: pointer; }
        .tpp-poster { display: block; width: 100%; height: auto; border-radius: 4px; border: 1px solid var(--gray-200); transition: transform 0.14s ease, box-shadow 0.14s ease; }
        .tpp-poster-none { aspect-ratio: 2 / 3; background: var(--gray-100); }
        .tpp-tile:hover:not(:disabled) .tpp-poster { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,25,46,0.16); }
        .tpp-tile:focus-visible .tpp-poster { outline: 2px solid var(--navy); outline-offset: 3px; }
        .tpp-tile.is-current .tpp-poster { outline: 2px solid var(--navy); outline-offset: 2px; }
        .tpp-tile.is-out { cursor: not-allowed; }
        .tpp-tile.is-out .tpp-poster { filter: grayscale(0.85); opacity: 0.5; }

        .tpp-cap { display: block; padding-top: 9px; }
        .tpp-cap-name { display: block; font-weight: 700; color: var(--navy); font-size: 0.9rem; line-height: 1.3; }
        .tpp-cap-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding-top: 3px; }
        .tpp-left { font-size: 0.78rem; font-weight: 600; color: #1c7a4a; }
        .tpp-left.is-out { color: #8a1c1c; }
        .tpp-current { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--navy); background: var(--gray-100); padding: 2px 6px; border-radius: 3px; }

        /* Detail: the sheet at readable size, the choice beside it. */
        .tpp-detail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 30px; margin-top: 22px; align-items: start; }
        .tpp-zoombtn { position: relative; display: block; width: 100%; padding: 0; border: none; background: none; cursor: zoom-in; }
        .tpp-zoombtn img { display: block; width: 100%; height: auto; border-radius: 4px; border: 1px solid var(--gray-200); }
        .tpp-zoomhint { position: absolute; right: 10px; bottom: 10px; display: inline-flex; gap: 6px; align-items: center; background: rgba(15,25,46,0.82); color: #fff; font-size: 0.74rem; font-weight: 600; padding: 5px 9px; border-radius: 4px; }

        .tpp-advisory { display: flex; gap: 9px; padding: 11px 13px; background: #fff6e5; border-left: 3px solid #c8871a; border-radius: 4px; color: #7a5210; font-size: 0.84rem; line-height: 1.45; }

        .tpp-batches { border: none; padding: 0; margin: 16px 0 0; display: grid; gap: 8px; }
        .tpp-batches legend { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--gray-600); font-weight: 700; padding: 0 0 8px; }
        .tpp-batch { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 11px; align-items: center; padding: 12px 13px; border: 1px solid var(--gray-200); border-radius: 4px; cursor: pointer; }
        .tpp-batch:hover:not(.is-blocked) { border-color: var(--navy); }
        .tpp-batch:has(input:checked) { border-color: var(--navy); background: #f7f9fd; }
        .tpp-batch.is-blocked { opacity: 0.5; cursor: not-allowed; }
        .tpp-batch input { width: 16px; height: 16px; accent-color: var(--navy); cursor: inherit; }
        .tpp-batch-label { display: flex; gap: 7px; align-items: center; font-weight: 700; color: var(--navy); font-size: 0.87rem; }
        .tpp-batch-mine { font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-600); background: var(--gray-100); padding: 2px 5px; border-radius: 3px; }
        .tpp-batch-meta { display: block; color: var(--gray-600); font-size: 0.77rem; margin-top: 2px; }
        .tpp-batch-left { font-size: 0.77rem; font-weight: 700; color: #1c7a4a; white-space: nowrap; }
        .tpp-batch-left.is-out { color: #8a1c1c; }

        .tpp-actions { display: flex; gap: 10px; align-items: center; margin-top: 18px; }
        .tpp-confirm { padding: 11px 20px; border: none; border-radius: 4px; background: var(--navy); color: #fff; font-size: 0.88rem; font-weight: 700; cursor: pointer; }
        .tpp-confirm:hover:not(:disabled) { filter: brightness(1.15); }
        .tpp-confirm:disabled { background: var(--gray-200); color: var(--gray-600); cursor: default; }
        .tpp-clear { padding: 11px 14px; border: 1px solid var(--gray-200); border-radius: 4px; background: none; color: var(--gray-600); font-size: 0.84rem; cursor: pointer; }
        .tpp-clear:hover:not(:disabled) { border-color: #8a1c1c; color: #8a1c1c; }

        .tpp-lightbox { position: fixed; inset: 0; z-index: 200; background: rgba(10,16,30,0.92); display: grid; place-items: center; padding: 28px; cursor: zoom-out; }
        .tpp-lightbox img { max-width: min(100%, 900px); max-height: 100%; object-fit: contain; border-radius: 4px; }
        .tpp-lightbox-close { position: fixed; top: 18px; right: 22px; width: 38px; height: 38px; display: grid; place-items: center; border: none; border-radius: 4px; background: rgba(255,255,255,0.14); color: #fff; font-size: 1rem; cursor: pointer; }
        .tpp-lightbox-close:hover { background: rgba(255,255,255,0.26); }

        @media (max-width: 860px) {
          .tpp-detail { grid-template-columns: 1fr; gap: 20px; }
        }
      `}</style>
    </div>
  )
}

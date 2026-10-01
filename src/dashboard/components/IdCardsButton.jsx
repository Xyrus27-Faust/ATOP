import { useState } from 'react'
import { api } from '@/lib/apiClient'

/**
 * The print run: every confirmed in-person delegate's ID card in one PDF, front then back each,
 * sorted by region, LGU and name. Only delegates who have sent a photo — a card with the silhouette
 * on it is one a printer will print.
 *
 * <p>Follows the region filter on the page it sits on. A thousand cards is a large file and a long
 * wait; one region at a time keeps both small, and matches how the cards are handed out.</p>
 */
export default function IdCardsButton({ eventId, region }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function download() {
    setError(null)
    setBusy(true)
    try {
      const query = region ? `?region=${encodeURIComponent(region)}` : ''
      await api.download(
        `/admin/events/${eventId}/id-cards${query}`,
        `atop-id-cards-${(region || 'all').toLowerCase()}.pdf`,
        // Fetching and drawing a region's photos takes a while; the default 20 s would give up first.
        { timeoutMs: 120_000 },
      )
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="icb">
      <button type="button" className="dash-btn" onClick={download} disabled={busy || !eventId}>
        <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-id-card'}`} aria-hidden="true" />
        {busy ? ' Preparing ID cards…' : region ? ' ID cards (this region)' : ' ID cards'}
      </button>
      {error && <span className="dash-error">{error.message || 'The ID cards could not be made.'}</span>}
      <style>{`.icb { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 6px; }`}</style>
    </span>
  )
}

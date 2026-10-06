import { useState } from 'react'
import { api } from '@/lib/apiClient'
import { REGIONS } from '@/lib/pearlAwards'
import { PARTICIPANT_TYPE_LABELS } from '@/lib/events'
import { downloadCsv, datedFilename } from '@/lib/csv'

const REGION_LABELS = Object.fromEntries(REGIONS.map((r) => [r.value, r.label]))

// "2026-11-18 09:14" in Manila — sortable in a spreadsheet, and venue time whatever the laptop says.
const venueStamp = (instant) =>
  instant ? new Date(instant).toLocaleString('sv-SE', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short' }) : ''

/**
 * The convention's master list as one CSV: every delegate on a live booking, with LGU, contact,
 * seat, shirt, tour and meals on the same row. It replaced the three partial exports that used to
 * sit on the Tallies page — one file to hand around, not three to reconcile.
 *
 * <p>Fetched on click rather than with the page: it is the whole list, and nobody wants it loaded
 * on every visit to see a headcount. It holds contact details and allergies for everyone, which is
 * why only the secretariat's pages carry the button.</p>
 */
export default function MasterListButton({ eventId }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function download() {
    setError(null)
    setBusy(true)
    try {
      const rows = await api.get(`/admin/events/${eventId}/masterlist`, { auth: true })
      downloadCsv(datedFilename('atop-masterlist'), [
        [
          'Booking', 'Booking status', 'Region', 'LGU', 'Organization',
          'Last name', 'First name', 'Middle name', 'Suffix', 'Designation', 'Office',
          'Classification', 'Attendance', 'Email', 'Mobile',
          'Seat', 'Regional slot', 'Shirt size', 'Tour', 'Tour batch', 'Tour date',
          'Dietary restrictions', 'Dietary notes',
          'Checked in', 'Paid at desk', 'ID released', 'Kit released',
        ],
        ...rows.map((r) => [
          r.bookingReference,
          r.bookingStatus === 'PendingPayment' ? 'Awaiting payment' : r.bookingStatus,
          REGION_LABELS[r.region] ?? r.region ?? '',
          r.lgu ?? '',
          r.organization ?? '',
          r.lastName,
          r.firstName,
          r.middleName ?? '',
          r.suffix ?? '',
          r.designation,
          r.office ?? '',
          PARTICIPANT_TYPE_LABELS[r.participantType] ?? r.participantType,
          r.attendanceMode,
          r.email,
          r.mobile,
          r.seat,
          r.regionalSlot ? 'Yes' : '',
          r.shirtSize ?? '',
          r.tourPackage ?? '',
          r.tourBatch ?? '',
          r.tourDate ?? '',
          r.dietary ?? '',
          r.dietaryNotes ?? '',
          venueStamp(r.checkedInAt),
          venueStamp(r.paidAtDeskAt),
          venueStamp(r.idReleasedAt),
          venueStamp(r.kitReleasedAt),
        ]),
      ])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="mlb">
      <button type="button" className="dash-btn" onClick={download} disabled={busy || !eventId}>
        <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-file-arrow-down'}`} aria-hidden="true" />
        {' '}Export master list
      </button>
      {error && <span className="dash-error">{error.message || 'The export failed. Try again.'}</span>}
      <style>{`.mlb { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 6px; }`}</style>
    </span>
  )
}

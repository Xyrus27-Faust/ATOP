import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { REGIONS, labelFor } from '@/lib/pearlAwards'

/**
 * The admin's control of M7: how many free seats each region gets, and who may spend them.
 *
 * All eighteen regions are always listed, granted or not — the backend returns an allowance of zero
 * rather than omitting a region, so the table is complete on day one and an admin can see at a
 * glance which regions have been dealt with and which have not.
 *
 * Appointing is a two-step, exactly as appointing a 3PIC assessor is: grant the role in Identity,
 * then say which region in Events. Both calls are issued here so the admin does one thing.
 */
export default function RegionalAllocationsPage() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)

  const { loading, error, data, reload } = useAsync(async () => {
    const events = await api.get('/events/')
    const event = events[0]
    if (!event) return { event: null, regions: [], capacity: null }
    const [regions, admin] = await Promise.all([
      api.get(`/admin/events/${event.id}/regional-allocations`, { auth: true }),
      api.get('/admin/events/', { auth: true }),
    ])
    const full = admin.find((e) => e.id === event.id)
    return { event, regions, capacity: full?.venueCapacity ?? null }
  }, [])

  if (!isAdmin(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, regions, capacity } = data
  if (!event) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-calendar-days" aria-hidden="true" /></div>
        <h3>No published convention</h3>
        <p>Publish an event before allocating regional seats.</p>
      </div>
    )
  }

  const granted = regions.reduce((sum, r) => sum + r.seatAllowance, 0)
  const used = regions.reduce((sum, r) => sum + r.used, 0)

  async function setAllowance(region, seatAllowance) {
    setBusy(region)
    setActionError(null)
    try {
      await api.put(`/admin/events/${event.id}/regional-allocations/${region}`, { seatAllowance }, { auth: true })
      await reload()
    } catch (e) {
      setActionError(e?.message || 'Could not update that allocation.')
    } finally {
      setBusy(null)
    }
  }

  async function revoke(userId) {
    setBusy(userId)
    setActionError(null)
    try {
      await api.delete(`/admin/events/${event.id}/regional-representatives/${userId}`, { auth: true })
      await reload()
    } catch (e) {
      setActionError(e?.message || 'Could not remove that representative.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{event.name}</span>
          <h1 className="dash-h1">Regional Allocations</h1>
          <p className="dash-sub">
            Free seats granted to each region, and the representatives who may spend them.
          </p>
        </div>
      </div>

      <div className="dash-grid ar-stats">
        <Stat icon="fa-ticket" label="Seats granted" value={granted} />
        <Stat icon="fa-users" label="Seats claimed" value={used} />
        <Stat icon="fa-chair" label="Venue capacity" value={capacity ?? 'Uncapped'} />
      </div>

      {/* Eighteen promises made independently; nothing stops them summing past the room. The
          arithmetic is the admin's to resolve, so show it rather than silently refusing a claim
          later — a representative turned away at the last step has no recourse. */}
      {capacity != null && granted > capacity && (
        <div className="dash-card dash-card-pad" style={{ borderColor: '#FED7AA', background: '#FFF7ED' }}>
          <strong>Allocations exceed the venue.</strong> {granted} seats are granted across all regions
          against a capacity of {capacity}. Regional claims are not refused by venue capacity, so this
          will oversell the hall if the regions use what they have been given.
        </div>
      )}

      {actionError && (
        <div className="dash-card dash-card-pad" style={{ borderColor: '#FECACA', background: '#FEF2F2' }}>
          {actionError}
        </div>
      )}

      <AppointForm eventId={event.id} onDone={reload} onError={setActionError} />

      <div className="dash-card dash-card-pad ra-table-wrap">
        <table className="ra-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Granted</th>
              <th>Claimed</th>
              <th>Remaining</th>
              <th>Representatives</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.region}>
                <td>{labelFor(REGIONS, r.region)}</td>
                <td>
                  <AllowanceInput
                    // Remount when the saved figure changes, so the draft resets to it without an
                    // effect syncing prop into state.
                    key={`${r.region}:${r.seatAllowance}`}
                    value={r.seatAllowance}
                    min={r.used}
                    busy={busy === r.region}
                    onSave={(n) => setAllowance(r.region, n)}
                  />
                </td>
                <td>{r.used}</td>
                <td>{Math.max(0, r.remaining)}</td>
                <td>
                  {r.representatives.length === 0 ? (
                    <span className="ra-none">None</span>
                  ) : (
                    <ul className="ra-reps">
                      {r.representatives.map((rep) => (
                        <li key={rep.userId}>
                          {rep.fullName || rep.email}
                          <button
                            className="dash-btn is-sm"
                            disabled={busy === rep.userId}
                            onClick={() => revoke(rep.userId)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .ar-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .ar-search { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }
        .ar-search .dash-input { flex: 1 1 240px; }
        /* The table is wide by nature — eighteen rows of five columns — so it scrolls inside its
           own box rather than pushing the page sideways. */
        .ra-table-wrap { margin-top: 1.25rem; overflow-x: auto; }
        .ra-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .ra-table th { text-align: left; font-family: var(--font-body); font-size: 0.72rem;
                       letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-500);
                       padding: 0 12px 10px 0; border-bottom: 1px solid var(--gray-200); white-space: nowrap; }
        .ra-table td { padding: 12px 12px 12px 0; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
        .ra-table tr:last-child td { border-bottom: none; }
        .ra-allowance { width: 90px; }
        .ra-none { color: var(--gray-500); }
        .ra-email { color: var(--gray-500); margin-left: 6px; }
        .ra-reps, .ra-results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .ra-reps li, .ra-results li { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ra-results { margin-top: 12px; }
      `}</style>
    </>
  )
}

/**
 * Inline seat count. Saves on blur or Enter rather than behind a per-row button — an admin setting
 * eighteen numbers should not have to click eighteen times.
 *
 * `min` is what the region has already claimed: the backend refuses anything lower (un-granting
 * seats already promised to named people), and the input says so before the request rather than
 * after it.
 */
function AllowanceInput({ value, min, busy, onSave }) {
  const [draft, setDraft] = useState(String(value))

  const commit = () => {
    const n = Number(draft)
    if (!Number.isInteger(n) || n < 0 || n === value) { setDraft(String(value)); return }
    onSave(n)
  }

  return (
    <input
      className="dash-input ra-allowance"
      type="number"
      min={min}
      value={draft}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      aria-label="Seats granted"
    />
  )
}

/**
 * Appoint a representative. Searches accounts, then issues both halves: the role grant in Identity
 * and the region assignment in Events. Doing only the first leaves someone with a page that tells
 * them they have no region; doing only the second is refused by the backend.
 */
function AppointForm({ eventId, onDone, onError }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [region, setRegion] = useState(REGIONS[0].value)
  const [busy, setBusy] = useState(false)

  async function search(e) {
    e.preventDefault()
    if (!term.trim()) return
    try {
      setResults(await api.get(`/admin/users?q=${encodeURIComponent(term.trim())}`, { auth: true }))
    } catch (err) {
      onError(err?.message || 'Could not search accounts.')
    }
  }

  async function appoint(u) {
    setBusy(true)
    onError(null)
    try {
      // Role first — the appointment endpoint refuses an account that does not hold it, which is
      // the check that stops a typo appointing someone who could never sign in to use it.
      await api.post(`/admin/users/${u.userId}/roles`, { role: 'RegionalRepresentative' }, { auth: true })
      await api.post(`/admin/events/${eventId}/regional-representatives`, { userId: u.userId, region }, { auth: true })
      setResults([])
      setTerm('')
      await onDone()
    } catch (err) {
      onError(err?.message || 'Could not appoint that representative.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-card dash-card-pad" style={{ marginTop: '1.25rem' }}>
      <h3 className="dash-card-title">Appoint a representative</h3>
      <form className="ar-search" onSubmit={search}>
        <input
          className="dash-input"
          placeholder="Search by name or email…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <select className="dash-select" value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button className="dash-btn" type="submit">
          <i className="fas fa-magnifying-glass" aria-hidden="true" /> Search
        </button>
      </form>

      {results.length > 0 && (
        <ul className="ra-results">
          {results.map((u) => (
            <li key={u.userId}>
              <span>{u.fullName || u.email} <span className="ra-email">{u.email}</span></span>
              <button className="dash-btn is-sm" disabled={busy} onClick={() => appoint(u)}>
                Appoint to {labelFor(REGIONS, region)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="dash-card dash-stat">
      <div className="dash-stat-icon"><i className={`fas ${icon}`} aria-hidden="true" /></div>
      <div>
        <div className="dash-stat-value">{value}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </div>
  )
}

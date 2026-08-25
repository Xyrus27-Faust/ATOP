import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form'
import Modal from '../components/Modal'
import { formatDate } from '@/lib/pearlAwards'
import { REGIONS } from '@/lib/pearlAwards'
import {
  ALL_REGISTRATION_STATUSES,
  registrationStatusMeta,
  formatPeso,
} from '@/lib/events'

const PAGE_SIZE = 50

/** Says which set a figure covers, so "12 in person" is never read as the whole convention. */
const SCOPE = (filtered) => (filtered ? ' · matching filters' : ' · all bookings')

/**
 * The Secretariat's view of who's coming. Filters mirror the backend's query
 * parameters exactly, so what's on screen is what the server actually selected.
 *
 * Attendance-mode filtering asks "does this booking include anyone attending that
 * way" — a mixed delegation matches both filters, which is the useful behaviour
 * when you're chasing headcounts for catering or for stream licences.
 */
export default function AdminRegistrationsPage() {
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('')
  const [region, setRegion] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [comping, setComping] = useState(null)

  const { loading, error, data, reload } = useAsync(async () => {
    const events = await api.get('/events/')
    const event = events[0]
    if (!event) return { event: null, result: null }

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (status) params.set('status', status)
    if (mode) params.set('mode', mode)
    if (region) params.set('region', region)
    if (query) params.set('search', query)

    const result = await api.get(`/admin/events/${event.id}/registrations?${params}`, { auth: true })
    return { event, result }
  }, [status, mode, region, query, page])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, result } = data

  if (!event) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-calendar-days" aria-hidden="true" /></div>
        <h3>No published convention</h3>
        <p>Publish an event before registrations can be taken.</p>
      </div>
    )
  }

  const { items, totalCount } = result
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Totals come from the server, computed across every booking the filters match. They used to be
  // summed from the rows on screen, which answered a question nobody asks: page one is not a
  // catering number. Falling back to zeroes keeps the cards rendering against an older API.
  const totals = result.totals ?? {}
  const filtered = Boolean(status || mode || region || query)

  const applySearch = (e) => { e.preventDefault(); setPage(1); setQuery(search.trim()) }
  const changeFilter = (setter) => (value) => { setPage(1); setter(value) }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{event.name}</span>
          <h1 className="dash-h1">Registrations</h1>
          <p className="dash-sub">Every booking for the convention, and what each has paid.</p>
        </div>
      </div>

      {/* Seats are counted per delegate on CONFIRMED bookings — which includes anyone who has paid
          a downpayment, because that is what confirms a booking. Money is counted as money: what has
          actually arrived, and what is still owed. The suffix says which set these describe, so a
          filtered view is never mistaken for the whole convention. */}
      <div className="dash-grid ar-stats">
        <Stat icon="fa-location-dot" label={`In person · confirmed${SCOPE(filtered)}`} value={totals.inPersonConfirmed ?? 0} />
        <Stat icon="fa-video" label={`Online · confirmed${SCOPE(filtered)}`} value={totals.virtualConfirmed ?? 0} />
        <Stat icon="fa-peso-sign" label={`Received${SCOPE(filtered)}`} value={formatPeso(totals.collected ?? 0)} />
        <Stat icon="fa-hourglass-half" label={`Outstanding${SCOPE(filtered)}`} value={formatPeso(totals.outstanding ?? 0)} />
        <Stat icon="fa-list-check" label={filtered ? 'Bookings matching filters' : 'Bookings'} value={totalCount} />
      </div>

      <div className="dash-card dash-card-pad ar-filters">
        <form className="ar-search" onSubmit={applySearch}>
          <input
            className="dash-input"
            placeholder="Search reference, LGU, organization, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="dash-btn" type="submit"><i className="fas fa-magnifying-glass" aria-hidden="true" /> Search</button>
        </form>

        <div className="ar-selects">
          <select className="dash-select" value={status} onChange={(e) => changeFilter(setStatus)(e.target.value)}>
            <option value="">All statuses</option>
            {ALL_REGISTRATION_STATUSES.map((s) => (
              <option key={s} value={s}>{registrationStatusMeta(s).label}</option>
            ))}
          </select>
          <select className="dash-select" value={mode} onChange={(e) => changeFilter(setMode)(e.target.value)}>
            <option value="">Any attendance</option>
            <option value="InPerson">Includes in person</option>
            <option value="Virtual">Includes online</option>
          </select>
          <select className="dash-select" value={region} onChange={(e) => changeFilter(setRegion)(e.target.value)}>
            <option value="">All regions</option>
            {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-inbox" aria-hidden="true" /></div>
          <h3>No registrations match</h3>
          <p>Try clearing a filter.</p>
        </div>
      ) : (
        <div className="ar-list">
          {items.map((r) => {
            const meta = registrationStatusMeta(r.status)
            return (
              <div key={r.id} className="dash-card ar-row">
                <span className="ar-main">
                  <span className="ar-ref">
                    {r.referenceCode}
                    {r.isComplimentary && <span className="ar-comp" title="Issued complimentary">COMP</span>}
                    {!r.isComplimentary && Number(r.balance) > 0 && Number(r.amountPaid) > 0 && (
                      <span className="ar-owes" title="Downpayment received; balance outstanding">
                        {formatPeso(r.balance)} DUE
                      </span>
                    )}
                  </span>
                  <span className="ar-who">{r.lguName || r.organizationName || '—'}</span>
                  <span className="ar-contact">{r.contactName} · {r.contactEmail}</span>
                </span>

                <span className="ar-heads">
                  {r.inPersonCount > 0 && <span><i className="fas fa-location-dot" aria-hidden="true" /> {r.inPersonCount}</span>}
                  {r.virtualCount > 0 && <span><i className="fas fa-video" aria-hidden="true" /> {r.virtualCount}</span>}
                </span>

                <span className="ar-amount">{formatPeso(r.totalAmount)}</span>

                <span className="ar-side">
                  <span className={`dash-badge tone-${meta.tone}`}>
                    <i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.label}
                  </span>
                  <span className="ar-date">{formatDate(r.confirmedAt || r.createdAt)}</span>
                </span>

                <span className="ar-actions">
                  <Link to={`/dashboard/admin/registrations/${r.id}`} className="dash-btn">
                    <i className="fas fa-up-right-from-square" aria-hidden="true" /> Open
                  </Link>
                  {r.status !== 'Confirmed' && r.status !== 'Cancelled' && (
                    <button type="button" className="dash-btn ar-comp-btn" onClick={() => setComping(r)}>
                      <i className="fas fa-gift" aria-hidden="true" /> Comp
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="ar-pager">
          <button className="dash-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <i className="fas fa-chevron-left" aria-hidden="true" /> Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button className="dash-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <i className="fas fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}

      {comping && (
        <CompModal
          registration={comping}
          onClose={() => setComping(null)}
          onDone={() => { setComping(null); reload() }}
        />
      )}

      <style>{`
        /* dash-grid only sets display+gap; the columns are ours. auto-fit rather than the
           cols-4 modifier so four tiles don't crush on a narrow window. */
        .ar-stats { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); margin-bottom: 16px; }
        .ar-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ar-search { display: flex; gap: 8px; flex: 1 1 320px; }
        .ar-search .dash-input { flex: 1; }
        .ar-selects { display: flex; gap: 8px; flex-wrap: wrap; }

        .ar-list { display: flex; flex-direction: column; gap: 10px; }
        .ar-row { display: flex; align-items: center; gap: 16px; padding: 14px 18px; }
        .ar-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .ar-ref { font-family: var(--font-heading); font-weight: 800; color: var(--navy); letter-spacing: 0.02em; }
        .ar-owes {
          flex-shrink: 0; font-family: var(--font-heading); font-size: 0.62rem; font-weight: 800;
          letter-spacing: 0.06em; color: var(--gold-dark); border: 1px solid var(--gold);
          border-radius: 3px; padding: 1px 5px; white-space: nowrap;
        }
        .ar-comp {
          margin-left: 8px; font-size: 0.62rem; letter-spacing: 0.08em; padding: 2px 6px;
          border-radius: 4px; background: var(--gold); color: var(--navy); vertical-align: middle;
        }
        .ar-who { font-size: 0.86rem; color: var(--navy); }
        .ar-contact { font-size: 0.76rem; color: var(--gray-500, #6B7280); }
        .ar-heads { display: flex; gap: 12px; font-size: 0.82rem; color: var(--gray-600); flex-shrink: 0; }
        .ar-amount { font-family: var(--font-heading); font-weight: 800; color: var(--navy); flex-shrink: 0; }
        .ar-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .ar-date { font-size: 0.72rem; color: var(--gray-500, #6B7280); }
        .ar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .ar-comp-btn { flex-shrink: 0; }

        .ar-pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 18px; font-size: 0.84rem; color: var(--gray-600); }

        @media (max-width: 820px) {
          .ar-row { flex-wrap: wrap; }
          .ar-side { align-items: flex-start; }
        }
      `}</style>
    </>
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

/**
 * Issue a booking free of charge. The only route to Confirmed that doesn't go
 * through the gateway, so it records who did it and why — which is exactly why
 * the reason is mandatory rather than a nicety.
 */
function CompModal({ registration, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!reason.trim()) { setError('A reason is required.'); return }
    setSaving(true)
    setError(null)
    try {
      await api.post(`/admin/registrations/${registration.id}/comp`, { reason: reason.trim() }, { auth: true })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not issue this registration.')
      setSaving(false)
    }
  }

  return (
    <Modal title={`Issue ${registration.referenceCode} complimentary`} onClose={onClose}>
      <p className="dash-help" style={{ marginBottom: 14 }}>
        This confirms {formatPeso(registration.totalAmount)} worth of delegates without a payment.
        It’s recorded against your account.
      </p>
      <Field label="Reason" htmlFor="compReason" required error={error}>
        <textarea
          id="compReason"
          rows={3}
          className={ctl('dash-textarea', error)}
          placeholder="e.g. Pearl Awards finalist representatives — City of Iloilo"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(null) }}
        />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <button type="button" className="dash-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="dash-btn is-primary" onClick={save} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Issuing…</> : 'Issue complimentary'}
        </button>
      </div>
    </Modal>
  )
}

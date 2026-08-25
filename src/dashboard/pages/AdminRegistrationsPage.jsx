import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

/**
 * The Secretariat's view of who's coming. Filters mirror the backend's query
 * parameters exactly, so what's on screen is what the server actually selected.
 *
 * Attendance-mode filtering asks "does this booking include anyone attending that
 * way" — a mixed delegation matches both filters, which is the useful behaviour
 * when you're chasing headcounts for catering or for stream licences.
 */
export default function AdminRegistrationsPage() {
  const navigate = useNavigate()
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

  // The convention's own figures, from the server. They do not move when a filter is applied —
  // someone narrowing to one region still needs the number the caterer is cooking for. What the
  // filter changes is how many records matched, below. Zeroes keep the cards rendering if the
  // API predates them.
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
          a downpayment, because that is what confirms a booking. Money is counted as money: what
          has actually arrived, and what is still owed. */}
      <div className="dash-grid ar-stats">
        <Stat icon="fa-location-dot" label="In person · confirmed" value={totals.inPersonConfirmed ?? 0} />
        <Stat icon="fa-video" label="Online · confirmed" value={totals.virtualConfirmed ?? 0} />
        <Stat icon="fa-peso-sign" label="Received" value={formatPeso(totals.collected ?? 0)} />
        <Stat icon="fa-hourglass-half" label="Outstanding" value={formatPeso(totals.outstanding ?? 0)} />
        <Stat
          icon="fa-list-check"
          label={filtered ? 'Records · matching filters' : 'Records · all bookings'}
          value={totalCount}
        />
      </div>
      <p className="ar-scope">
        Figures cover the whole convention{filtered && <> — only the record count follows your filters</>}.
      </p>

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
              <div
                key={r.id}
                className="dash-card ar-row"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/admin/registrations/${r.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/dashboard/admin/registrations/${r.id}`)
                  }
                }}
              >
                <span className="ar-main">
                  {/* Status leads. It varies in width, and while it sat on the right it pushed the
                      money column around — so the one column worth reading down never lined up. */}
                  <span className="ar-status-line">
                    <span className={`dash-badge tone-${meta.tone}`}>
                      <i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.label}
                    </span>
                    {r.isComplimentary && <span className="ar-comp" title="Issued complimentary">COMP</span>}
                    <span className="ar-date" title={r.confirmedAt ? 'Confirmed' : 'Created'}>
                      {formatDate(r.confirmedAt || r.createdAt)}
                    </span>
                  </span>
                  <span className="ar-ref">{r.referenceCode}</span>
                  <span className="ar-who">{r.lguName || r.organizationName || '—'}</span>
                  <span className="ar-contact">{r.contactName} · {r.contactEmail}</span>
                </span>

                <span className="ar-heads">
                  {r.inPersonCount > 0 && <span><i className="fas fa-location-dot" aria-hidden="true" /> {r.inPersonCount}</span>}
                  {r.virtualCount > 0 && <span><i className="fas fa-video" aria-hidden="true" /> {r.virtualCount}</span>}
                </span>

                <Money registration={r} />

                <RowMenu registration={r} onComp={() => setComping(r)} />
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
        /* The row is the way into a booking, so it has to look and behave like one. */
        .ar-row {
          display: flex; align-items: center; gap: 16px; padding: 14px 18px;
          cursor: pointer; transition: var(--transition-fast);
        }
        .ar-row:hover { border-color: var(--navy); transform: translateY(-1px); }
        .ar-row:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }
        .ar-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
        .ar-status-line { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .ar-ref { font-family: var(--font-heading); font-weight: 800; color: var(--navy); letter-spacing: 0.02em; }
        .ar-comp {
          font-size: 0.62rem; letter-spacing: 0.08em; padding: 2px 6px;
          border-radius: 4px; background: var(--gold); color: var(--navy); vertical-align: middle;
        }
        .ar-who { font-size: 0.86rem; color: var(--navy); }
        .ar-contact { font-size: 0.76rem; color: var(--gray-500, #6B7280); }
        .ar-heads { display: flex; gap: 12px; font-size: 0.82rem; color: var(--gray-600); flex-shrink: 0; }
        .ar-money { flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; width: 132px; }
        .ar-total {
          font-family: var(--font-heading); font-weight: 800; color: var(--navy);
          font-variant-numeric: tabular-nums;
        }
        .ar-bar { display: block; height: 4px; border-radius: 999px; background: var(--gray-200, #E5E7EB); overflow: hidden; }
        .ar-bar-fill { display: block; height: 100%; background: var(--gold); border-radius: 999px; }
        .ar-bar-fill.is-settled { background: var(--green-600, #16a34a); }
        .ar-money-note { font-size: 0.72rem; font-variant-numeric: tabular-nums; }
        .ar-money-note.is-due { color: var(--gold-dark); font-weight: 700; }
        .ar-money-note.is-settled { color: var(--green-700, #15803d); font-weight: 700; }
        .ar-money-note.is-unpaid { color: var(--gray-500, #6B7280); }
        .ar-money-note.is-comp { color: var(--navy); font-weight: 700; }
        .ar-date { font-size: 0.72rem; color: var(--gray-500, #6B7280); }
        .ar-scope { margin: -6px 2px 14px; font-size: 0.78rem; color: var(--gray-500, #6B7280); }
        /* Actions live behind a kebab so the row reads as one thing to click. */
        .ar-menu { position: relative; flex-shrink: 0; }
        .ar-menu-spacer { flex-shrink: 0; width: 32px; }
        .ar-menu-btn {
          width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer;
          border: 1px solid transparent; border-radius: var(--radius-sm); background: none;
          color: var(--gray-600); transition: var(--transition-fast);
        }
        .ar-menu-btn:hover { border-color: var(--gray-200); background: #fff; color: var(--navy); }
        .ar-menu-pop {
          position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 200px;
          display: flex; flex-direction: column; padding: 4px;
          background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
          box-shadow: 0 10px 26px rgba(16, 32, 47, 0.16);
        }
        .ar-menu-item {
          display: flex; align-items: center; gap: 9px; padding: 8px 10px; cursor: pointer;
          border: 0; border-radius: 6px; background: none; text-align: left;
          font-size: 0.84rem; color: var(--navy); white-space: nowrap;
        }
        .ar-menu-item:hover { background: var(--gray-100, #F3F4F6); }

        .ar-pager { display: flex; align-items: center; gap: 16px; margin-top: 18px; font-size: 0.84rem; color: var(--gray-600); }

        @media (max-width: 820px) {
          .ar-row { flex-wrap: wrap; }
          .ar-money { width: auto; flex: 1 1 140px; }
        }
      `}</style>
    </>
  )
}

/**
 * What this booking costs and where it stands.
 *
 * The total alone could not distinguish a booking that has paid nothing from one that is settled,
 * which is the difference the secretariat is usually looking for. A bar carries that at a glance;
 * the line under it says the part that matters — what is still due, or that nothing is.
 */
function Money({ registration: r }) {
  const total = Number(r.totalAmount ?? 0)
  const paid = Number(r.amountPaid ?? 0)
  const due = Number(r.balance ?? 0)
  const settled = r.isComplimentary || due <= 0
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  return (
    <span className="ar-money">
      <span className="ar-total">{formatPeso(total)}</span>

      {r.isComplimentary ? (
        <span className="ar-money-note is-comp">Complimentary</span>
      ) : (
        <>
          <span className="ar-bar" aria-hidden="true">
            <span className={`ar-bar-fill${settled ? ' is-settled' : ''}`} style={{ width: `${pct}%` }} />
          </span>
          {settled ? (
            <span className="ar-money-note is-settled">
              <i className="fas fa-check" aria-hidden="true" /> Paid in full
            </span>
          ) : paid > 0 ? (
            <span className="ar-money-note is-due">{formatPeso(due)} still due</span>
          ) : (
            <span className="ar-money-note is-unpaid">Nothing paid yet</span>
          )}
        </>
      )}
    </span>
  )
}

/**
 * Row actions, out of the way.
 *
 * Opening a booking is the row itself, so the menu carries only what the row cannot say by being
 * clicked. Every control inside stops the click from reaching the row — otherwise choosing an
 * action would navigate away from the booking it applies to.
 */
function RowMenu({ registration: r, onComp }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const canComp = r.status !== 'Confirmed' && r.status !== 'Cancelled'
  if (!canComp) return <span className="ar-menu-spacer" aria-hidden="true" />

  return (
    <span className="ar-menu" ref={root} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="ar-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${r.referenceCode}`}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fas fa-ellipsis-vertical" aria-hidden="true" />
      </button>

      {open && (
        <span className="ar-menu-pop" role="menu">
          <button
            type="button"
            role="menuitem"
            className="ar-menu-item"
            onClick={() => { setOpen(false); onComp() }}
          >
            <i className="fas fa-gift" aria-hidden="true" /> Issue complimentary
          </button>
        </span>
      )}
    </span>
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

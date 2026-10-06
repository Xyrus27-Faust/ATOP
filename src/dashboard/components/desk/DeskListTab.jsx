import { useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { formatPeso } from '@/lib/events'
import { deskRoster, formatVenueTime } from '@/lib/checkin'
import { downloadCsv, datedFilename } from '@/lib/csv'
import { useAsync } from '../../useAsync'
import { Loading, ErrorState } from '../states'

// Case- and accent-blind, so "pena" finds "Peña" and "QUEZON" finds "Quezon City".
const fold = (text) => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// The questions the desk asks of its list, each a filter. Order follows the desk: arrive, pay, ID, kit.
const FILTERS = [
  { key: 'all', label: 'Everyone', test: () => true },
  { key: 'arriving', label: 'Not checked in', test: (r) => !r.checkIn },
  { key: 'owing', label: 'Desk B owing', test: (r) => r.balance > 0 },
  { key: 'id', label: 'No ID yet', test: (r) => r.checkIn && r.balance <= 0 && !r.idRelease },
  { key: 'kit', label: 'No kit yet', test: (r) => r.idRelease && !r.kit },
  { key: 'done', label: 'All done', test: (r) => r.kit },
]

/**
 * The Secretariat desk's master list: every pass holder and how far each has got — checked in, paid,
 * ID and receipt, kit. Who hasn't arrived, who is still owed a kit, which Desk B balances are still
 * out: one tap each, and the list as a CSV for the end of the day.
 *
 * <p>The same pool the desk scans from, so nobody is listed whom the desk would turn away. Cards on a
 * phone, a table once there's room. A tab on the Check-in page.</p>
 */
export default function DeskListTab() {
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return { event: null, rows: [] }
    return { event, rows: await deskRoster(event.id) }
  }, [])
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, rows } = data
  if (!event) {
    return (
      <div className="dash-card dash-empty">
        <h3>No published convention</h3>
        <p>There is nobody to check in yet.</p>
      </div>
    )
  }

  const active = FILTERS.find((f) => f.key === filter)
  const term = fold(q.trim())
  const shown = rows.filter((r) => active.test(r)
    && (!term || fold(r.fullName).includes(term) || fold(r.lgu).includes(term) || fold(r.referenceCode).includes(term)))

  const exportCsv = () => downloadCsv(datedFilename('atop-desk'), [
    ['Reference', 'Name', 'LGU / Organisation', 'Designation', 'Desk', 'Balance', 'Complimentary',
      'Checked in', 'Checked in by', 'Paid at desk', 'Collected', 'ID released', 'Kit released'],
    ...shown.map((r) => [
      r.referenceCode, r.fullName, r.lgu ?? '', r.designation, r.desk, r.balance, r.complimentary ? 'Yes' : '',
      stamp(r.checkIn), r.checkIn?.by ?? '', stamp(r.payment), r.payment?.amount ?? '', stamp(r.idRelease), stamp(r.kit),
    ]),
  ])

  return (
    <>
      <div className="dkl-filters" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={f.key === filter}
            className={`dkl-chip${f.key === filter ? ' is-on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span>{rows.filter(f.test).length}</span>
          </button>
        ))}
      </div>

      <div className="dkl-bar">
        <div className="dkl-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="dash-input"
            type="search"
            autoComplete="off"
            placeholder="Search name, LGU or reference"
            aria-label="Search the desk list"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className="dash-btn is-ghost is-sm" onClick={reload} disabled={loading}>
          <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
        <button type="button" className="dash-btn is-ghost is-sm" onClick={exportCsv} disabled={shown.length === 0}>
          <i className="fas fa-file-arrow-down" aria-hidden="true" /> CSV
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>{rows.length === 0 ? 'Nobody holds a pass yet.' : 'Nobody here matches.'}</p>
        </div>
      ) : (
        <>
          <ul className="dkl-cards">
            {shown.map((r) => (
              <li key={r.id} className="dash-card dkl-card">
                <div className="dkl-card-top">
                  <strong>{r.fullName}</strong>
                  <DeskBadge row={r} />
                </div>
                <span className="dkl-sub">{[r.designation, r.lgu].filter(Boolean).join(' · ')}</span>
                <div className="dkl-steps">
                  <Step label="In" at={r.checkIn} />
                  {(r.desk === 'B' || r.payment) && <Step label="Paid" at={r.payment} />}
                  <Step label="ID" at={r.idRelease} />
                  <Step label="Kit" at={r.kit} />
                </div>
              </li>
            ))}
          </ul>

          <div className="dash-card dkl-table-wrap">
            <table className="dkl-table">
              <thead>
                <tr><th>Name</th><th>LGU / Organisation</th><th>Desk</th><th>Checked in</th><th>Paid</th><th>ID</th><th>Kit</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.fullName}</strong><span className="dkl-ref">{r.referenceCode}</span></td>
                    <td>{r.lgu || '—'}</td>
                    <td><DeskBadge row={r} /></td>
                    <td>{r.checkIn ? <>{formatVenueTime(r.checkIn.at)}<span className="dkl-by">{r.checkIn.by}</span></> : '—'}</td>
                    <td>{r.payment ? formatVenueTime(r.payment.at) : r.desk === 'B' ? 'Owing' : '—'}</td>
                    <td>{r.idRelease ? formatVenueTime(r.idRelease.at) : '—'}</td>
                    <td>{r.kit ? formatVenueTime(r.kit.at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <style>{DKL_CSS}</style>
    </>
  )
}

/** "2026-11-18 09:14" in Manila for the CSV — sortable in a spreadsheet. */
const stamp = (step) =>
  step ? new Date(step.at).toLocaleString('sv-SE', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short' }) : ''

function DeskBadge({ row: r }) {
  if (r.desk === 'B' && r.balance > 0) return <span className="dash-badge tone-warn">B · {formatPeso(r.balance)}</span>
  return <span className={`dash-badge ${r.desk === 'B' ? 'tone-warn' : 'tone-success'}`}>{r.complimentary ? 'A · Comp' : `Desk ${r.desk}`}</span>
}

function Step({ label, at }) {
  return (
    <span className={`dkl-step${at ? ' is-done' : ''}`}>
      <i className={`fas ${at ? 'fa-circle-check' : 'fa-circle'}`} aria-hidden="true" /> {label}
      {at && <small>{formatVenueTime(at.at)}</small>}
    </span>
  )
}

const DKL_CSS = `
  /* Scrolls sideways on a phone rather than wrapping into a wall of chips. */
  .dkl-filters { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 6px; margin: 4px 0 10px; }
  .dkl-chip {
    flex: 0 0 auto; min-height: 40px; padding: 0 14px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--gray-200); background: var(--white); color: var(--navy);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.85rem; white-space: nowrap;
  }
  .dkl-chip span { margin-left: 4px; color: var(--gray-600); font-weight: 600; }
  .dkl-chip.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .dkl-chip.is-on span { color: var(--gold-light); }

  .dkl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
  .dkl-bar .dash-btn { min-height: 40px; }
  .dkl-search { position: relative; flex: 1 1 100%; }
  .dkl-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
  .dkl-search .dash-input { padding-left: 36px; min-height: 44px; font-size: 16px; }

  .dkl-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .dkl-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
  .dkl-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .dkl-card-top strong { font-family: var(--font-heading); font-weight: 800; color: var(--navy); overflow-wrap: anywhere; }
  .dkl-card-top .dash-badge { flex: 0 0 auto; }
  .dkl-sub { font-family: var(--font-body); font-size: 0.85rem; color: var(--gray-600); }
  .dkl-steps { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 4px; }
  .dkl-step { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-heading); font-weight: 700; font-size: 0.82rem; color: var(--gray-400); }
  .dkl-step.is-done { color: var(--ok); }
  .dkl-step small { font-family: var(--font-body); font-weight: 400; color: var(--gray-600); }

  .dkl-table-wrap { display: none; overflow-x: auto; padding: 0; }
  .dkl-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 0.9rem; }
  .dkl-table th { text-align: left; padding: 10px 14px; font-family: var(--font-heading); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); border-bottom: 1px solid var(--gray-200); }
  .dkl-table td { padding: 10px 14px; border-bottom: 1px solid var(--gray-100); vertical-align: top; color: var(--gray-800); }
  .dkl-table td strong { display: block; font-family: var(--font-heading); color: var(--navy); }
  .dkl-ref, .dkl-by { display: block; font-size: 0.78rem; color: var(--gray-600); }

  @media (min-width: 640px) {
    .dkl-search { flex: 1 1 auto; }
  }
  @media (min-width: 900px) {
    .dkl-cards { display: none; }
    .dkl-table-wrap { display: block; }
  }
`

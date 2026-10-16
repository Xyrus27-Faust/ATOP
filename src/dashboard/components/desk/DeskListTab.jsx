import { useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { formatPeso } from '@/lib/events'
import { deskRoster, formatDay, formatVenueTime } from '@/lib/checkin'
import { downloadCsv, datedFilename } from '@/lib/csv'
import { useAsync } from '../../useAsync'
import { Loading, ErrorState } from '../states'

// Case- and accent-blind, so "pena" finds "Peña" and "QUEZON" finds "Quezon City".
const fold = (text) => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// The day someone arrived, "YYYY-MM-DD" in Manila — the same day the desk's wall calendar says.
const venueDay = (instant) => new Date(instant).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

// Desk B is everyone who came to the desk owing, paid or not yet; the rest never pay at the desk.
const paysAtDesk = (r) => r.balance > 0 || !!r.payment

// The four steps everyone goes through once, in the order the desks take them. Each is a box at the
// top — how many have done it, tapped to list who hasn't — and a line on each person's card.
const STEPS = [
  { key: 'arrived', label: 'Arrived', done: (r) => r.checkIn, applies: () => true, pending: 'not arrived yet' },
  { key: 'paid', label: 'Paid at Desk B', done: (r) => r.payment, applies: paysAtDesk, pending: 'still owe' },
  { key: 'id', label: 'ID & OR', done: (r) => r.idRelease, applies: () => true, pending: 'no ID yet' },
  { key: 'kit', label: 'Kit', done: (r) => r.kit, applies: () => true, pending: 'no kit yet' },
]

/**
 * Registration: the desk's master list. Everyone goes through it once for the whole convention —
 * arrive, pay at Desk B if they owe, collect the ID &amp; OR, collect the kit — so this is not a
 * per-day list: who was at each session or meal is the Attendance tab.
 *
 * <p>Laid out for staff who want the answer at a glance: a box per step with how many have done it,
 * tapped to list exactly who hasn't; "Arrived on" to see who came on which day; and each step on a
 * card as a plain Done / Not yet with the time and who did it.</p>
 *
 * <p>The same pool the desk scans from, so nobody is listed whom the desk would turn away. Cards on a
 * phone, a table once there's room.</p>
 */
export default function DeskListTab() {
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return { event: null, rows: [] }
    return { event, rows: await deskRoster(event.id) }
  }, [])
  const [missing, setMissing] = useState(null)
  const [arrivedOn, setArrivedOn] = useState('all')
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

  const step = STEPS.find((s) => s.key === missing)
  const arrivalDays = [...new Set(rows.filter((r) => r.checkIn).map((r) => venueDay(r.checkIn.at)))].sort()
  const term = fold(q.trim())
  const shown = rows.filter((r) =>
    (!step || (step.applies(r) && !step.done(r)))
    && (arrivedOn === 'all' || (r.checkIn && venueDay(r.checkIn.at) === arrivedOn))
    && (!term || fold(r.fullName).includes(term) || fold(r.lgu).includes(term) || fold(r.referenceCode).includes(term)))

  const exportCsv = () => downloadCsv(datedFilename('atop-registration'), [
    ['Reference', 'Name', 'LGU / Organisation', 'Designation', 'Desk', 'Balance', 'Complimentary',
      'Arrived', 'Checked in by', 'Paid at desk', 'Amount paid', 'Paid to', 'ID released', 'ID released by',
      'Kit released', 'Kit released by'],
    ...shown.map((r) => [
      r.referenceCode, r.fullName, r.lgu ?? '', r.designation, r.desk, r.balance, r.complimentary ? 'Yes' : '',
      stamp(r.checkIn), r.checkIn?.by ?? '', stamp(r.payment), r.payment?.amount ?? '', r.payment?.by ?? '',
      stamp(r.idRelease), r.idRelease?.by ?? '', stamp(r.kit), r.kit?.by ?? '',
    ]),
  ])

  return (
    <>
      <style>{DKL_CSS}</style>
      <p className="dkl-intro">
        Everyone goes through the desk <b>once for the whole convention</b>: arrive, pay at Desk B if they
        owe, get their ID &amp; OR, get their kit. For who was at each session or meal, open <b>Attendance</b>.
      </p>

      <p className="dkl-step-head">Tap a box to see who hasn&rsquo;t done it</p>
      <div className="dkl-sums">
        {STEPS.map((s) => {
          const pool = rows.filter(s.applies)
          const done = pool.filter(s.done).length
          const on = missing === s.key
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              className={`dkl-sum${on ? ' is-on' : ''}`}
              onClick={() => setMissing(on ? null : s.key)}
            >
              <strong>{s.label}</strong>
              <span className="dkl-sum-count"><b>{done}</b> of {pool.length}</span>
              <span className="dkl-sum-cta">
                {on ? 'Showing who hasn’t · tap to show everyone' : `${pool.length - done} ${s.pending} →`}
              </span>
            </button>
          )
        })}
      </div>

      {arrivalDays.length > 0 && (
        <>
          <p className="dkl-step-head">Arrived on</p>
          <div className="dkl-filters" role="tablist" aria-label="Arrived on">
            {[{ key: 'all', label: 'Any day', count: rows.length },
              ...arrivalDays.map((d) => ({ key: d, label: formatDay(d), count: rows.filter((r) => r.checkIn && venueDay(r.checkIn.at) === d).length }))]
              .map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={f.key === arrivedOn}
                  className={`dkl-chip${f.key === arrivedOn ? ' is-on' : ''}`}
                  onClick={() => setArrivedOn(f.key)}
                >
                  {f.label} <span>{f.count}</span>
                </button>
              ))}
          </div>
        </>
      )}

      {(step || arrivedOn !== 'all') && (
        <div className="dkl-showing" role="status">
          <span>
            Showing <b>{shown.length}</b> {shown.length === 1 ? 'person' : 'people'}
            {step && <> &middot; {step.pending}</>}
            {arrivedOn !== 'all' && <> &middot; arrived {formatDay(arrivedOn)}</>}
          </span>
          <button type="button" className="dash-btn is-ghost is-sm" onClick={() => { setMissing(null); setArrivedOn('all') }}>
            Show everyone
          </button>
        </div>
      )}

      <div className="dkl-bar">
        <div className="dkl-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="dash-input"
            type="search"
            autoComplete="off"
            placeholder="Find a name, LGU or reference"
            aria-label="Search registration"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className="dash-btn is-ghost" onClick={reload} disabled={loading}>
          <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
        <button type="button" className="dash-btn is-ghost" onClick={exportCsv} disabled={shown.length === 0}>
          <i className="fas fa-file-arrow-down" aria-hidden="true" /> Download (Excel)
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>{rows.length === 0 ? 'Nobody holds a pass yet.' : step && !term ? 'Everyone has done this step.' : 'Nobody here matches.'}</p>
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
                <ul className="dkl-lines">
                  {STEPS.filter((s) => s.applies(r)).map((s) => (
                    <li key={s.key}><span>{s.label}</span><Done at={s.done(r)} /></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="dash-card dkl-table-wrap">
            <table className="dkl-table">
              <thead>
                <tr><th>Name</th><th>Desk</th>{STEPS.map((s) => <th key={s.key}>{s.label}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.fullName}</strong><span className="dkl-sub">{r.lgu || r.designation}</span><span className="dkl-ref">{r.referenceCode}</span></td>
                    <td><DeskBadge row={r} /></td>
                    {STEPS.map((s) => <td key={s.key}>{s.applies(r) ? <Done at={s.done(r)} /> : <span className="dkl-na">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

/** "2026-11-18 09:14" in Manila for the CSV — sortable in a spreadsheet. */
const stamp = (step) =>
  step ? new Date(step.at).toLocaleString('sv-SE', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short' }) : ''

function DeskBadge({ row: r }) {
  if (r.desk === 'B' && r.balance > 0) return <span className="dash-badge tone-warn">B · owes {formatPeso(r.balance)}</span>
  return <span className={`dash-badge ${r.desk === 'B' ? 'tone-warn' : 'tone-success'}`}>{r.complimentary ? 'A · Comp' : `Desk ${r.desk}`}</span>
}

/** ✓ Done, the day and time, and who did it — or a plain "Not yet". */
function Done({ at }) {
  if (!at) return <span className="dkl-box is-wait">Not yet</span>
  return (
    <span className="dkl-box is-yes">
      <i className="fas fa-circle-check" aria-hidden="true" /> Done
      {at.amount != null && <> · {formatPeso(at.amount)}</>}
      <small>{formatDay(venueDay(at.at))}, {formatVenueTime(at.at)}{at.by ? ` · ${at.by}` : ''}</small>
    </span>
  )
}

const DKL_CSS = `
  .dkl-intro {
    margin: 16px 0 4px; padding: 12px 14px; border-radius: 12px; background: var(--white);
    border: 1px solid var(--gray-200); font-family: var(--font-body); font-size: 0.95rem; color: var(--gray-800);
  }
  .dkl-step-head {
    margin: 18px 0 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-dark);
  }

  .dkl-sums { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .dkl-sum {
    text-align: left; cursor: pointer; padding: 12px 14px; border-radius: 14px;
    border: 2px solid var(--gray-200); background: var(--white); color: var(--navy);
    display: flex; flex-direction: column; gap: 4px; font-family: var(--font-body);
  }
  .dkl-sum.is-on { border-color: var(--navy); box-shadow: 0 0 0 3px var(--gold-light); }
  .dkl-sum strong { font-family: var(--font-heading); font-weight: 800; font-size: 1rem; }
  .dkl-sum-count { font-size: 0.95rem; color: var(--gray-800); }
  .dkl-sum-count b { font-size: 1.5rem; color: var(--ok); }
  .dkl-sum-cta { font-weight: 700; font-size: 0.85rem; color: var(--bad); }
  .dkl-sum.is-on .dkl-sum-cta { color: var(--navy); }

  /* Scrolls sideways on a phone rather than wrapping into a wall of chips. */
  .dkl-filters { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 6px; }
  .dkl-chip {
    flex: 0 0 auto; min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--gray-200); background: var(--white); color: var(--navy);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; white-space: nowrap;
  }
  .dkl-chip span { margin-left: 4px; color: var(--gray-600); font-weight: 600; }
  .dkl-chip.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .dkl-chip.is-on span { color: var(--gold-light); }

  .dkl-showing {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;
    margin: 12px 0 4px; padding: 12px 14px; border-radius: 12px;
    background: var(--bad-bg); color: var(--gray-800); font-family: var(--font-body); font-size: 1rem;
  }
  .dkl-showing .dash-btn { min-height: 44px; }

  .dkl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
  .dkl-bar .dash-btn { min-height: 48px; flex: 1 1 auto; justify-content: center; }
  .dkl-search { position: relative; flex: 1 1 100%; }
  .dkl-search i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
  .dkl-search .dash-input { padding-left: 40px; min-height: 48px; font-size: 16px; }

  .dkl-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .dkl-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
  .dkl-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .dkl-card-top strong { font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem; color: var(--navy); overflow-wrap: anywhere; }
  .dkl-card-top .dash-badge { flex: 0 0 auto; }
  .dkl-sub { display: block; font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }
  .dkl-lines { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .dkl-lines li {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding-top: 6px; border-top: 1px solid var(--gray-100);
    font-family: var(--font-body); font-size: 0.95rem; color: var(--gray-800);
  }

  .dkl-box {
    flex: 0 1 auto; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; text-align: right;
    padding: 5px 10px; border-radius: 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.9rem;
  }
  .dkl-box small { flex-basis: 100%; font-family: var(--font-body); font-weight: 400; font-size: 0.78rem; color: var(--gray-600); }
  .dkl-box.is-yes { background: var(--ok-bg); color: var(--ok); }
  .dkl-box.is-wait { color: var(--gray-400); font-weight: 700; }
  .dkl-na { color: var(--gray-400); }

  .dkl-table-wrap { display: none; overflow-x: auto; padding: 0; }
  .dkl-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 0.95rem; }
  .dkl-table th {
    text-align: left; padding: 12px 14px; font-family: var(--font-heading); font-size: 0.8rem; font-weight: 800;
    color: var(--navy); border-bottom: 2px solid var(--gray-200);
  }
  .dkl-table td { padding: 10px 14px; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
  .dkl-table td strong { display: block; font-family: var(--font-heading); font-size: 1rem; color: var(--navy); }
  .dkl-table td:first-child { min-width: 200px; }
  .dkl-table .dkl-box { text-align: left; }
  .dkl-ref { display: block; font-size: 0.78rem; color: var(--gray-600); }

  @media (min-width: 640px) {
    .dkl-sums { grid-template-columns: repeat(4, 1fr); }
    .dkl-search { flex: 1 1 auto; }
    .dkl-bar .dash-btn { flex: 0 0 auto; }
  }
  @media (min-width: 900px) {
    .dkl-cards { display: none; }
    .dkl-table-wrap { display: block; }
  }
`

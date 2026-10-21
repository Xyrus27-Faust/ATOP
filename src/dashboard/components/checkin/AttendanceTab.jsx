import { useRef, useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import {
  listCheckpoints, getCheckpointScans, deskRoster, groupByDay, formatDay, formatVenueTime, scanningToday, kindMeta, csvStamp, fold,
} from '@/lib/checkin'
import { downloadCsv } from '@/lib/csv'
import { useAsync } from '../../useAsync'
import { pageOf } from '../../paging'
import { SORTS, newest, latestFirst } from '../../listOrder'
import { Loading, ErrorState } from '../states'
import Pager from '../Pager'

// What each kind says on the list, in words as well as colour: Present / Absent for a session,
// Ate / No meal for a meal. A checkpoint still Open or Upcoming says "Not yet" instead — calling
// someone absent from a dinner that hasn't finished would send the secretariat chasing them.
const WORDS = {
  Entry: { yes: 'Present', no: 'Absent', column: 'Session' },
  Meal: { yes: 'Ate', no: 'No meal', column: 'Meal' },
}
const isOver = (c) => c.state === 'Closed' || c.state === 'Ended'

/**
 * Who was where, one day at a time: every pass holder down the side, that day's sessions and meals
 * across the top, and a plain Present / Absent in each box. Built for the secretariat at a glance
 * rather than for the marshal at the door — big words, big buttons, and a box per session at the
 * top that, tapped, lists who missed it.
 *
 * <p>Put together in the browser from lists the API already serves: the desk's roster (everyone
 * expected) and each checkpoint's own scan log. So a ✓ here is exactly the row on that checkpoint's
 * page — voided scans are already gone from it, and "marked by staff" rows say so. The day's buses
 * fold into one Bus column (only those booked on a bus are expected on one).</p>
 */
export default function AttendanceTab() {
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return { event: null, days: [] }
    return { event, days: groupByDay(await listCheckpoints(event.id)) }
  }, [])
  const [picked, setPicked] = useState(null)

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, days } = data
  if (!event || days.length === 0) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-user-check" aria-hidden="true" /></div>
        <h3>No sessions yet</h3>
        <p>Attendance shows here once an admin adds the day&rsquo;s sessions and meals.</p>
      </div>
    )
  }

  const today = scanningToday()
  // Today if anything is on; otherwise the last day that has been, so after the event it opens on
  // the closing day rather than the first.
  const fallback = days.find((g) => g.day === today)?.day
    ?? [...days].reverse().find((g) => g.day < today)?.day
    ?? days[0].day
  const day = days.some((g) => g.day === picked) ? picked : fallback
  const group = days.find((g) => g.day === day)

  return (
    <>
      <style>{ATT_CSS}</style>
      <p className="att-step">1. Pick a day</p>
      <div className="att-days" role="tablist" aria-label="Day">
        {days.map((g) => (
          <button
            key={g.day}
            type="button"
            role="tab"
            aria-selected={g.day === day}
            className={`att-day${g.day === day ? ' is-on' : ''}`}
            onClick={() => setPicked(g.day)}
          >
            {formatDay(g.day)}
            {g.day === today && <small>Today</small>}
          </button>
        ))}
      </div>
      <DayAttendance key={day} event={event} day={day} checkpoints={group.items} />
    </>
  )
}

function DayAttendance({ event, day, checkpoints }) {
  const columns = checkpoints.filter((c) => c.kind !== 'Tour')
  const buses = checkpoints.filter((c) => c.kind === 'Tour')
  const { loading, error, data, reload } = useAsync(async () => {
    const [roster, ...logs] = await Promise.all([
      deskRoster(event.id),
      ...checkpoints.map((c) => getCheckpointScans(c.id)),
    ])
    // delegateId → checkpointId → the scan, for one lookup per box.
    const seen = new Map()
    logs.forEach((log) => log.scans.forEach((s) => {
      if (!seen.has(s.delegateId)) seen.set(s.delegateId, new Map())
      seen.get(s.delegateId).set(log.checkpoint.id, s)
    }))
    // delegateId → their last scan this day, for Latest first: worked out once per load, not per keystroke.
    const lastAt = new Map([...seen].map(([id, scans]) => [id, newest(...[...scans.values()].map((s) => s.scannedAt))]))
    return { roster, seen, lastAt }
  }, [])
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('latest')
  const [at, setAt] = useState({ key: '', page: 1 })
  const top = useRef(null)

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { roster, seen, lastAt } = data
  const scanOf = (r, c) => seen.get(r.id)?.get(c.id)
  const busOf = (r) => buses.find((b) => scanOf(r, b))
  const missedAny = (r) => columns.some((c) => isOver(c) && !scanOf(r, c))
  const presentAll = (r) => columns.length > 0 && columns.every((c) => scanOf(r, c))

  const missing = columns.find((c) => filter === `absent:${c.id}`)
  const test = missing ? (r) => !scanOf(r, missing)
    : filter === 'missed' ? missedAny
    : filter === 'complete' ? presentAll
    : () => true
  const term = fold(q.trim())
  const matched = roster.filter((r) => test(r)
    && (!term || fold(r.fullName).includes(term) || fold(r.lgu).includes(term) || fold(r.referenceCode).includes(term)))
  // Latest first: by their last scan this day at any session, meal or bus, so whoever just came
  // through is on top. Those not scanned yet today keep A–Z below them. The download follows suit.
  const shown = sort === 'latest'
    ? latestFirst(matched, (r) => lastAt.get(r.id) ?? null)
    : matched
  // 50 at a time: a box per session for 1,000 people is too much to draw at once. The counts and the
  // download stay on the whole list.
  const pageKey = `${filter}|${term}|${sort}`
  const paged = pageOf(shown, at, pageKey)
  const turn = (page) => {
    setAt({ key: pageKey, page })
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const exportCsv = () => downloadCsv(`atop-attendance-${day}.csv`, [
    ['Reference', 'Name', 'LGU / Organisation', 'Designation', 'Arrived at the convention',
      ...columns.map((c) => c.label), ...(buses.length > 0 ? ['Bus'] : [])],
    ...shown.map((r) => [
      r.referenceCode, r.fullName, r.lgu ?? '', r.designation, r.checkIn ? csvStamp(r.checkIn.at) : 'Not yet',
      ...columns.map((c) => csvBox(c, scanOf(r, c))),
      ...(buses.length > 0 ? [busOf(r) ? `${busOf(r).label} ${csvStamp(scanOf(r, busOf(r)).scannedAt)}` : ''] : []),
    ]),
  ])

  const chips = [
    { key: 'all', label: 'Everyone', count: roster.length },
    { key: 'missed', label: 'Missed something', count: roster.filter(missedAny).length },
    { key: 'complete', label: 'Present at everything', count: roster.filter(presentAll).length },
  ]

  return (
    <>
      {columns.length > 0 && (
        <>
          <p className="att-step">2. Tap a box to see who missed it</p>
          <div className="att-sums">
            {columns.map((c) => {
              const words = WORDS[c.kind] || WORDS.Entry
              const yes = roster.filter((r) => scanOf(r, c)).length
              const on = missing?.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  className={`att-sum${on ? ' is-on' : ''}`}
                  onClick={() => setFilter(on ? 'all' : `absent:${c.id}`)}
                >
                  <span className="att-sum-kind"><i className={`fas ${kindMeta(c.kind).icon}`} aria-hidden="true" /> {words.column}</span>
                  <strong>{c.label}</strong>
                  <span className="att-sum-count"><b>{yes}</b> {words.yes.toLowerCase()} of {roster.length}</span>
                  <span className="att-sum-cta">
                    {on ? 'Showing who missed it · tap to show everyone' : `${roster.length - yes} ${isOver(c) ? words.no.toLowerCase() : 'not yet'} →`}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {missing ? (
        <div className="att-showing" role="status">
          <span>
            Showing the <b>{shown.length}</b> {shown.length === 1 ? 'person' : 'people'} with no record at <b>{missing.label}</b>
          </span>
          <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setFilter('all')}>Show everyone</button>
        </div>
      ) : (
        <div className="att-chips" role="tablist" aria-label="Filter">
          {chips.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={f.key === filter}
              className={`att-chip${f.key === filter ? ' is-on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span>{f.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="att-bar">
        <div className="att-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="dash-input"
            type="search"
            autoComplete="off"
            placeholder="Find a name, LGU or reference"
            aria-label="Search attendance"
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

      <div className="att-chips att-sort" role="radiogroup" aria-label="Sort">
        {SORTS.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.key === sort}
            className={`att-chip${o.key === sort ? ' is-on' : ''}`}
            onClick={() => setSort(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>{roster.length === 0 ? 'Nobody holds a pass yet.' : missing ? `Everyone was at ${missing.label}.` : 'Nobody here matches.'}</p>
        </div>
      ) : (
        <div ref={top} className="att-list">
          <ul className="att-cards">
            {paged.rows.map((r) => (
              <li key={r.id} className="dash-card att-card">
                <strong className="att-name">{r.fullName}</strong>
                <span className="att-sub">{[r.designation, r.lgu].filter(Boolean).join(' · ')}</span>
                {!r.checkIn && <span className="att-away">Hasn&rsquo;t arrived at the convention</span>}
                <ul className="att-lines">
                  {columns.map((c) => (
                    <li key={c.id}>
                      <span>{c.label}</span>
                      <Box checkpoint={c} scan={scanOf(r, c)} />
                    </li>
                  ))}
                  {buses.length > 0 && (
                    <li>
                      <span>Bus</span>
                      <BusBox bus={busOf(r)} scan={busOf(r) && scanOf(r, busOf(r))} />
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>

          <div className="dash-card att-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Name</th>
                  {columns.map((c) => <th key={c.id}>{c.label}</th>)}
                  {buses.length > 0 && <th>Bus</th>}
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.fullName}</strong>
                      <span className="att-sub">{r.lgu || r.designation}</span>
                      {!r.checkIn && <span className="att-away">Hasn&rsquo;t arrived</span>}
                    </td>
                    {columns.map((c) => <td key={c.id}><Box checkpoint={c} scan={scanOf(r, c)} /></td>)}
                    {buses.length > 0 && <td><BusBox bus={busOf(r)} scan={busOf(r) && scanOf(r, busOf(r))} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager paged={paged} onPage={turn} />
        </div>
      )}
    </>
  )
}

/** One box: ✓ Present 5:02 PM, ✗ Absent, or "Not yet" while the session is still running. */
function Box({ checkpoint: c, scan }) {
  const words = WORDS[c.kind] || WORDS.Entry
  if (scan) {
    return (
      <span className="att-box is-yes">
        <i className="fas fa-circle-check" aria-hidden="true" /> {words.yes}
        <small>{formatVenueTime(scan.scannedAt)}{scan.method === 'Marked' ? ' · added by staff' : ''}</small>
      </span>
    )
  }
  if (!isOver(c)) return <span className="att-box is-wait">Not yet</span>
  return <span className="att-box is-no"><i className="fas fa-circle-xmark" aria-hidden="true" /> {words.no}</span>
}

function BusBox({ bus, scan }) {
  if (!bus) return <span className="att-box is-wait">—</span>
  return (
    <span className="att-box is-yes">
      <i className="fas fa-bus" aria-hidden="true" /> {bus.label}
      <small>{formatVenueTime(scan.scannedAt)}</small>
    </span>
  )
}

function csvBox(c, scan) {
  const words = WORDS[c.kind] || WORDS.Entry
  if (scan) return `${words.yes} ${csvStamp(scan.scannedAt)}${scan.method === 'Marked' ? ' (added by staff)' : ''}`
  return isOver(c) ? words.no : 'Not yet'
}

const ATT_CSS = `
  .att-step {
    margin: 18px 0 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-dark);
  }

  /* Scrolls sideways on a phone rather than wrapping. */
  .att-days, .att-chips { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 6px; }
  .att-day {
    flex: 0 0 auto; min-height: 52px; padding: 0 18px; border-radius: 12px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 2px solid var(--gray-200); background: var(--white); color: var(--navy);
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem; white-space: nowrap;
  }
  .att-day small { font-size: 0.7rem; font-weight: 700; color: var(--gold-dark); }
  .att-day.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .att-day.is-on small { color: var(--gold-light); }

  .att-sums { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .att-sum {
    text-align: left; cursor: pointer; padding: 14px 16px; border-radius: 14px;
    border: 2px solid var(--gray-200); background: var(--white); color: var(--navy);
    display: flex; flex-direction: column; gap: 4px; font-family: var(--font-body);
  }
  .att-sum.is-on { border-color: var(--navy); box-shadow: 0 0 0 3px var(--gold-light); }
  .att-sum-kind { font-family: var(--font-heading); font-weight: 700; font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
  .att-sum strong { font-family: var(--font-heading); font-weight: 800; font-size: 1.1rem; }
  .att-sum-count { font-size: 1rem; color: var(--gray-800); }
  .att-sum-count b { font-size: 1.5rem; color: var(--ok); }
  .att-sum-cta { font-weight: 700; font-size: 0.9rem; color: var(--bad); }
  .att-sum.is-on .att-sum-cta { color: var(--navy); }

  .att-chips { margin: 16px 0 4px; }
  .att-chips.att-sort { margin: 0 0 12px; }
  .att-chip {
    flex: 0 0 auto; min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--gray-200); background: var(--white); color: var(--navy);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; white-space: nowrap;
  }
  .att-chip span { margin-left: 4px; color: var(--gray-600); font-weight: 600; }
  .att-chip.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .att-chip.is-on span { color: var(--gold-light); }

  .att-showing {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;
    margin: 16px 0 4px; padding: 12px 14px; border-radius: 12px;
    background: var(--bad-bg); color: var(--gray-800); font-family: var(--font-body); font-size: 1rem;
  }
  .att-showing .dash-btn { min-height: 44px; }

  .att-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0 12px; }
  .att-bar .dash-btn { min-height: 48px; flex: 1 1 auto; justify-content: center; }
  .att-search { position: relative; flex: 1 1 100%; }
  .att-search i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
  .att-search .dash-input { padding-left: 40px; min-height: 48px; font-size: 16px; }

  .att-list { scroll-margin-top: 16px; }
  .att-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .att-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
  .att-name { font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem; color: var(--navy); overflow-wrap: anywhere; }
  .att-sub { display: block; font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }
  .att-away { display: block; font-family: var(--font-body); font-size: 0.85rem; font-style: italic; color: var(--warn); }
  .att-lines { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .att-lines li {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding-top: 6px; border-top: 1px solid var(--gray-100);
    font-family: var(--font-body); font-size: 0.95rem; color: var(--gray-800);
  }
  .att-lines li > span:first-child { overflow-wrap: anywhere; }

  .att-box {
    flex: 0 0 auto; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 6px;
    padding: 5px 10px; border-radius: 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.9rem;
  }
  .att-box small { flex-basis: 100%; font-family: var(--font-body); font-weight: 400; font-size: 0.78rem; color: var(--gray-600); }
  .att-box.is-yes { background: var(--ok-bg); color: var(--ok); }
  .att-box.is-no { background: var(--bad-bg); color: var(--bad); }
  .att-box.is-wait { color: var(--gray-400); font-weight: 700; }

  .att-table-wrap { display: none; overflow-x: auto; padding: 0; }
  .att-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 0.95rem; }
  .att-table th {
    text-align: left; padding: 12px 14px; font-family: var(--font-heading); font-size: 0.8rem; font-weight: 800;
    color: var(--navy); border-bottom: 2px solid var(--gray-200); vertical-align: bottom;
  }
  .att-table td { padding: 10px 14px; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
  .att-table td strong { display: block; font-family: var(--font-heading); font-size: 1rem; color: var(--navy); }

  @media (min-width: 640px) {
    .att-sums { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
    .att-search { flex: 1 1 auto; }
    .att-bar .dash-btn { flex: 0 0 auto; }
  }
  @media (min-width: 900px) {
    .att-cards { display: none; }
    .att-table-wrap { display: block; }
  }
`

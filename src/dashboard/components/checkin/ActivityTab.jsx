import { useMemo, useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { checkInActivity, listCheckpoints, formatDay, formatVenueTime, venueDate, csvStamp, fold } from '@/lib/checkin'
import { formatPeso } from '@/lib/events'
import { downloadCsv } from '@/lib/csv'
import { useAsync } from '../../useAsync'
import { Loading, ErrorState } from '../states'

// What each action is called on the page, in words a non-technical admin reads at a glance. `tone`
// colours the corrections: red for something taken back, amber for someone added by hand.
const ACTIONS = {
  CheckedIn: { label: 'Checked in', icon: 'fa-door-open', group: 'desk' },
  PaidAtDesk: { label: 'Paid cash at Desk B', icon: 'fa-money-bill-wave', group: 'desk' },
  IdReleased: { label: 'ID & OR given', icon: 'fa-id-card', group: 'desk' },
  KitReleased: { label: 'Kit given', icon: 'fa-box-open', group: 'desk' },
  Scanned: { label: 'Scanned', icon: 'fa-qrcode', group: 'scans' },
  ManualLog: { label: 'Logged by name', icon: 'fa-keyboard', group: 'scans' },
  MarkedAttended: { label: 'Marked present by staff', icon: 'fa-user-pen', group: 'fixes', tone: 'warn' },
  ScanVoided: { label: 'Scan voided', icon: 'fa-ban', group: 'fixes', tone: 'bad' },
  StepUndone: { label: 'Desk step undone', icon: 'fa-rotate-left', group: 'fixes', tone: 'bad' },
}
const actionOf = (key) => ACTIONS[key] || { label: key, icon: 'fa-circle', group: 'scans' }
// A scan at a bus is a boarding (ATOP, 2026-10-22): named so, so a bus row doesn't read like a lunch scan.
const BOARDED = {
  Scanned: { label: 'Boarded', icon: 'fa-bus', group: 'scans' },
  ManualLog: { label: 'Boarded by name', icon: 'fa-bus', group: 'scans' },
}
const actionAt = (key, atBus) => (atBus && BOARDED[key]) || actionOf(key)
const BOARDING = new Set(['Scanned', 'ManualLog', 'MarkedAttended'])

const FILTERS = [
  { key: 'all', label: 'Everything', test: () => true },
  { key: 'fixes', label: 'Corrections', test: (r) => actionOf(r.action).group === 'fixes' },
  { key: 'cash', label: 'Cash', test: (r) => r.action === 'PaidAtDesk' || (r.action === 'StepUndone' && r.amount != null) },
  { key: 'desk', label: 'Desk', test: (r) => actionOf(r.action).group === 'desk' },
  { key: 'scans', label: 'Scans', test: (r) => r.action === 'Scanned' || r.action === 'ManualLog' || r.action === 'MarkedAttended' },
]
// Only on a day with a bus on it: the other days keep the five chips they had.
const FILTERS_WITH_BUSES = [...FILTERS, { key: 'buses', label: 'Buses', test: (r) => r.atBus }]

/**
 * The admin's audit of check-in: one day's timeline, newest first, of everything staff did — who
 * checked whom in, who took cash and how much, who scanned at which checkpoint, and every correction
 * with its reason. Read-only; nothing here changes a record.
 *
 * <p>A step or scan taken back stays on the list, marked "taken back", next to the row that took it
 * back — so a voided scan reads as "Mara scanned, Sue voided it: wrong badge", not as nothing.</p>
 */
export default function ActivityTab() {
  const [picked, setPicked] = useState(null)
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return { event: null }
    // The buses are picked out by name, from the checkpoint list. Without it the log still reads,
    // only without the bus chips and the "Boarded" wording.
    const [log, checkpoints] = await Promise.all([
      checkInActivity(event.id, picked),
      listCheckpoints(event.id).catch(() => []),
    ])
    return { event, log, buses: new Set(checkpoints.filter((c) => c.kind === 'Tour').map((c) => c.label)) }
  }, [picked])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, log, buses } = data
  if (!event) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-clock-rotate-left" aria-hidden="true" /></div>
        <h3>No convention yet</h3>
        <p>The activity log fills in once check-in starts.</p>
      </div>
    )
  }

  return (
    <>
      <style>{ACT_CSS}</style>
      <p className="act-intro">
        Everything staff did at check-in, newest first: who checked people in, who took cash, who scanned
        where, and every correction with the reason given. Nothing on this page changes a record.
      </p>
      <p className="act-step">1. Pick a day</p>
      <div className="act-days" role="tablist" aria-label="Day">
        {log.days.map((day) => (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={day === log.day}
            className={`act-day${day === log.day ? ' is-on' : ''}`}
            onClick={() => setPicked(day)}
            disabled={loading}
          >
            {formatDay(day)}
            {day === log.today && <small>Today</small>}
          </button>
        ))}
      </div>
      <DayLog key={log.day} log={log} buses={buses} loading={loading} reload={reload} />
    </>
  )
}

// Steps one delegate had done within this long of each other read as one visit: "Checked in → ID & OR →
// Kit" on one line, not four. Wider than a desk queue, narrower than "came back after lunch".
const VISIT_GAP_MS = 10 * 60 * 1000
// Rows drawn per hour before "Show more": a busy hour at 1,000 delegates is several hundred.
const PAGE = 50
// The order of steps taken in the same tap (a gate check-in and its session scan share a timestamp).
const STEP_ORDER = ['CheckedIn', 'Scanned', 'ManualLog', 'PaidAtDesk', 'IdReleased', 'KitReleased']
const stepRank = (action) => { const i = STEP_ORDER.indexOf(action); return i < 0 ? STEP_ORDER.length : i }

const MANILA_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' })
const hourOf = (instant) => Number(MANILA_HOUR.format(new Date(instant))) % 24
const clock = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`
function hourLabel(h) {
  const [from, to] = [clock(h), clock((h + 1) % 24)]
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)}–${to}` : `${from}–${to}`
}

/**
 * The day's rows as visits, newest first: each delegate's back-to-back steps folded into one entry
 * (corrections always stand alone, so a void or undo is never buried inside a visit). Rows come in
 * newest first; an entry keeps growing backwards while that delegate's next older row is within
 * {@link VISIT_GAP_MS} of the entry's oldest step.
 */
function visitsOf(rows) {
  const entries = []
  const open = new Map()
  for (const r of rows) {
    const mergeable = actionOf(r.action).group !== 'fixes'
    const last = open.get(r.delegateId)
    if (mergeable && last?.mergeable && Date.parse(last.oldest) - Date.parse(r.at) <= VISIT_GAP_MS) {
      last.steps.push(r)
      last.oldest = r.at
      continue
    }
    const entry = { key: `${r.delegateId}-${r.at}-${r.action}-${entries.length}`, at: r.at, oldest: r.at, mergeable, steps: [r] }
    entries.push(entry)
    open.set(r.delegateId, entry)
  }
  for (const e of entries) {
    e.steps.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || stepRank(a.action) - stepRank(b.action))
    const by = new Set(e.steps.map((s) => s.by))
    e.by = by.size === 1 ? e.steps[0].by : null
  }
  return entries
}

/** Entries bucketed by the venue hour of their latest step, newest hour first. */
function hoursOf(entries) {
  const hours = []
  for (const e of entries) {
    const h = hourOf(e.at)
    const day = venueDate(e.at)
    const last = hours[hours.length - 1]
    if (last && last.h === h && last.day === day) last.entries.push(e)
    else hours.push({ key: `${day}-${h}`, h, day, entries: [e] })
  }
  for (const g of hours) g.count = g.entries.reduce((n, e) => n + e.steps.length, 0)
  return hours
}

/** What each staff member did that day: the "who did what" answer without reading the feed. */
function staffOf(rows) {
  const by = new Map()
  for (const r of rows) {
    const s = by.get(r.by) || { name: r.by, in: 0, id: 0, kit: 0, cash: 0, scans: 0, fixes: 0, total: 0 }
    s.total++
    if (actionOf(r.action).group === 'fixes') s.fixes++
    else if (!r.reversed) {
      if (r.action === 'CheckedIn') s.in++
      else if (r.action === 'IdReleased') s.id++
      else if (r.action === 'KitReleased') s.kit++
      else if (r.action === 'PaidAtDesk') s.cash += r.amount
      else s.scans++
    }
    by.set(r.by, s)
  }
  return [...by.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

function DayLog({ log, buses, loading, reload }) {
  const [filter, setFilter] = useState('all')
  const [bus, setBus] = useState(null)
  const [q, setQ] = useState('')
  const [staff, setStaff] = useState(null)
  // Hours the admin opened or closed by hand; the rest follow the default (newest open).
  const [toggled, setToggled] = useState({})
  const [limits, setLimits] = useState({})
  const [allStaff, setAllStaff] = useState(false)

  const rows = useMemo(() => log.rows.map((r) => ({ ...r, atBus: !!r.where && buses.has(r.where) })), [log.rows, buses])
  const busRows = rows.filter((r) => r.atBus)
  const filters = busRows.length > 0 ? FILTERS_WITH_BUSES : FILTERS
  const test = (filters.find((f) => f.key === filter) || filters[0]).test
  // Each bus that day, with how many boarded it (taken-back boardings don't count).
  const perBus = [...new Set(busRows.map((r) => r.where))].sort().map((label) => ({
    label,
    boarded: busRows.filter((r) => r.where === label && BOARDING.has(r.action) && !r.reversed).length,
  }))
  const pick = (key) => { setFilter(key); setBus(null) }
  const term = fold(q.trim())
  const shown = useMemo(() => rows.filter((r) => test(r) && (!bus || r.where === bus) && (!staff || r.by === staff)
    && (!term || fold(r.fullName).includes(term) || fold(r.lgu).includes(term)
      || fold(r.by).includes(term) || fold(r.originalBy).includes(term) || fold(r.where).includes(term))),
  [rows, test, bus, staff, term])
  const hours = useMemo(() => hoursOf(visitsOf(shown)), [shown])
  const people = useMemo(() => staffOf(rows), [rows])
  // A narrowed list is short enough to read whole; the full day opens on its latest hour only.
  const narrowed = filter !== 'all' || !!staff || !!term

  // Cash the day's cashiers still hold: payments not handed back. A payment undone the same day
  // shows as taken back and is left out; one undone on a later day is counted here and on that day's undo.
  const cashBy = new Map()
  rows.filter((r) => r.action === 'PaidAtDesk' && !r.reversed)
    .forEach((r) => cashBy.set(r.by, (cashBy.get(r.by) || 0) + r.amount))
  const cashTotal = [...cashBy.values()].reduce((a, b) => a + b, 0)
  const fixes = rows.filter((r) => actionOf(r.action).group === 'fixes').length

  // The download is the audit record: every row on its own, never folded into visits.
  const exportCsv = () => downloadCsv(`atop-activity-${log.day}.csv`, [
    ['Time', 'What happened', 'Name', 'LGU / Organisation', 'Where', 'Done by', 'Amount', 'Reason / note',
      'Taken back later', 'Originally done by', 'Originally done at'],
    ...shown.map((r) => [
      csvStamp(r.at), actionAt(r.action, r.atBus).label + (r.undid ? `: ${actionAt(r.undid, r.atBus).label}` : ''), r.fullName, r.lgu ?? '',
      r.where ?? '', r.by, r.amount ?? '', r.note ?? '', r.reversed ? 'Yes' : '', r.originalBy ?? '',
      csvStamp(r.originalAt),
    ]),
  ])

  const listedStaff = allStaff ? people : people.slice(0, 8)

  return (
    <>
      <div className="act-sums">
        <div className="act-sum">
          <span className="act-sum-kind">Things done</span>
          <b>{rows.length}</b>
        </div>
        <button
          type="button"
          className={`act-sum is-button${filter === 'fixes' ? ' is-on' : ''}`}
          onClick={() => pick(filter === 'fixes' ? 'all' : 'fixes')}
          aria-pressed={filter === 'fixes'}
        >
          <span className="act-sum-kind">Corrections</span>
          <b className={fixes > 0 ? 'is-bad' : ''}>{fixes}</b>
          <span className="act-sum-cta">{filter === 'fixes' ? 'Showing them · tap to show everything' : 'Voids, undos, added by hand →'}</span>
        </button>
        <button
          type="button"
          className={`act-sum is-button${filter === 'cash' ? ' is-on' : ''}`}
          onClick={() => pick(filter === 'cash' ? 'all' : 'cash')}
          aria-pressed={filter === 'cash'}
        >
          <span className="act-sum-kind">Cash taken at Desk B</span>
          <b>{formatPeso(cashTotal)}</b>
          {cashBy.size > 0 && (
            <span className="act-sum-split">
              {cashBy.size <= 3
                ? [...cashBy].map(([by, amount]) => `${by} ${formatPeso(amount)}`).join(' · ')
                : `${cashBy.size} cashiers · each one’s total is under By staff`}
            </span>
          )}
        </button>
      </div>

      {people.length > 0 && (
        <section className="dash-card act-staff" aria-label="By staff">
          <p className="act-staff-title">By staff <span>· tap a name to see only theirs</span></p>
          <ul>
            {listedStaff.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  className={`act-staff-row${staff === s.name ? ' is-on' : ''}`}
                  aria-pressed={staff === s.name}
                  onClick={() => setStaff(staff === s.name ? null : s.name)}
                >
                  <strong>{s.name}</strong>
                  <span className="act-staff-stats">
                    {s.in > 0 && <span><b>{s.in}</b> checked in</span>}
                    {s.id > 0 && <span><b>{s.id}</b> IDs</span>}
                    {s.kit > 0 && <span><b>{s.kit}</b> kits</span>}
                    {s.cash > 0 && <span><b>{formatPeso(s.cash)}</b> cash</span>}
                    {s.scans > 0 && <span><b>{s.scans}</b> scans</span>}
                    {s.fixes > 0 && <span className="is-bad"><b>{s.fixes}</b> {s.fixes === 1 ? 'correction' : 'corrections'}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {people.length > 8 && (
            <button type="button" className="dash-btn is-ghost is-sm act-more" onClick={() => setAllStaff(!allStaff)}>
              {allStaff ? 'Show fewer' : `Show all ${people.length} staff`}
            </button>
          )}
        </section>
      )}

      <div className="act-chips" role="tablist" aria-label="Filter">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={f.key === filter}
            className={`act-chip${f.key === filter ? ' is-on' : ''}`}
            onClick={() => pick(f.key)}
          >
            {f.key === 'buses' && <i className="fas fa-bus" aria-hidden="true" />} {f.label} <span>{rows.filter(f.test).length}</span>
          </button>
        ))}
      </div>

      {filter === 'buses' && perBus.length > 1 && (
        <div className="act-chips act-buses" role="group" aria-label="One bus">
          {perBus.map((b) => (
            <button
              key={b.label}
              type="button"
              aria-pressed={bus === b.label}
              className={`act-chip${bus === b.label ? ' is-on' : ''}`}
              onClick={() => setBus(bus === b.label ? null : b.label)}
            >
              {b.label} <span>{b.boarded} boarded</span>
            </button>
          ))}
        </div>
      )}

      <div className="act-bar">
        <div className="act-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="dash-input"
            type="search"
            autoComplete="off"
            placeholder="Find a delegate, LGU, staff member or checkpoint"
            aria-label="Search activity"
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

      {staff && (
        <button type="button" className="act-only" onClick={() => setStaff(null)} aria-label={`Only ${staff}. Show everyone`}>
          Only {staff} <i className="fas fa-xmark" aria-hidden="true" />
        </button>
      )}

      {hours.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>{rows.length === 0 ? `Nothing was done at check-in on ${formatDay(log.day)}.` : 'Nothing here matches.'}</p>
        </div>
      ) : (
        <div className="act-hours">
          {hours.map((g, i) => {
            const isOpen = toggled[g.key] ?? (narrowed || i === 0)
            const limit = limits[g.key] ?? PAGE
            return (
              <section key={g.key} className="act-hour">
                <button
                  type="button"
                  className="act-hour-head"
                  aria-expanded={isOpen}
                  onClick={() => setToggled({ ...toggled, [g.key]: !isOpen })}
                >
                  <span>{hourLabel(g.h)}{g.day !== log.day && <small> · {formatDay(g.day)}</small>}</span>
                  <span className="act-hour-count">{g.count} {g.count === 1 ? 'thing' : 'things'}</span>
                  <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} aria-hidden="true" />
                </button>
                {isOpen && (
                  <>
                    <ul className="act-visits">
                      {g.entries.slice(0, limit).map((e) => <Visit key={e.key} entry={e} />)}
                    </ul>
                    {g.entries.length > limit && (
                      <button type="button" className="dash-btn is-ghost act-more" onClick={() => setLimits({ ...limits, [g.key]: limit + PAGE })}>
                        Show {Math.min(PAGE, g.entries.length - limit)} more of {g.entries.length - limit}
                      </button>
                    )}
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * One delegate's visit: who, then what each staff member did, in order — a run of steps by the same
 * person on one line ("Checked in · Scanned — 10:58 AM · by Marshall 5"), so a gate-then-desk visit
 * is two lines, not five. Staff named once at the foot when it was one person; times only when the
 * minute moved on.
 */
function Visit({ entry: e }) {
  const who = e.steps[0]
  const runs = []
  for (const r of e.steps) {
    const last = runs[runs.length - 1]
    if (last && last.by === r.by) last.steps.push(r)
    else runs.push({ by: r.by, steps: [r] })
  }
  return (
    <li className={`act-visit${e.mergeable ? '' : ' is-fix'}`}>
      <span className="act-time">{formatVenueTime(e.at)}</span>
      <div className="act-who">
        <strong className="act-name">{who.fullName}</strong>
        {who.lgu && <span className="act-sub">{who.lgu}</span>}
      </div>
      <ol className="act-steps">
        {runs.map((run, i) => {
          const [from, to] = [formatVenueTime(run.steps[0].at), formatVenueTime(run.steps[run.steps.length - 1].at)]
          const prev = i ? formatVenueTime(runs[i - 1].steps[runs[i - 1].steps.length - 1].at) : formatVenueTime(e.at)
          const time = from === to ? (from === prev ? null : from) : `${from.replace(/ [AP]M$/, '')}–${to}`
          return (
            <li key={`${run.by}-${run.steps[0].at}`}>
              <span className="act-run">
                {run.steps.map((r, j) => <What key={`${r.action}-${j}`} row={r} />)}
              </span>
              <Detail steps={run.steps} time={time} by={e.by ? null : run.by} />
            </li>
          )
        })}
      </ol>
      {e.by && <span className="act-by">By <b>{e.by}</b></span>}
    </li>
  )
}

/** The action as a coloured pill with its icon, plus "taken back" on one later voided or undone. */
function What({ row: r }) {
  const a = actionAt(r.action, r.atBus)
  return (
    <span className={`act-what${r.reversed ? ' is-reversed' : ''}`}>
      <span className={`act-pill${a.tone ? ` is-${a.tone}` : ''}`}>
        <i className={`fas ${a.icon}`} aria-hidden="true" /> {a.label}
      </span>
      {r.reversed && <span className="act-pill is-gone">Taken back later</span>}
    </span>
  )
}

/** A run's time, who did it (when the visit had more than one), where, how much, what it reversed, and the reason. */
function Detail({ steps, time, by }) {
  const places = [...new Set(steps.map((r) => r.where).filter(Boolean))]
  const meta = [
    time,
    by && `by ${by}`,
    places.length > 0 && `at ${places.join(', ')}`,
    ...steps.filter((r) => r.amount != null).map((r) => formatPeso(r.amount)),
  ].filter(Boolean)
  const fixes = steps.filter((r) => r.undid || r.note)
  if (meta.length === 0 && fixes.length === 0) return null
  return (
    <span className="act-detail">
      {meta.length > 0 && <span>{meta.join(' · ')}</span>}
      {fixes.map((r, i) => (
        <span key={i} className="act-fix">
          {r.undid && (
            <span>
              Took back <b>{actionAt(r.undid, r.atBus).label.toLowerCase()}</b>
              {r.originalBy && <> by {r.originalBy}</>}
              {r.originalAt && <>, {formatDay(venueDate(r.originalAt))} {formatVenueTime(r.originalAt)}</>}
            </span>
          )}
          {r.note && <span className="act-note">&ldquo;{r.note}&rdquo;</span>}
        </span>
      ))}
    </span>
  )
}

const ACT_CSS = `
  .act-intro {
    margin: 16px 0 4px; padding: 12px 14px; border-radius: 12px; background: var(--white);
    border: 1px solid var(--gray-200); font-family: var(--font-body); font-size: 0.95rem; color: var(--gray-800);
  }
  .act-step {
    margin: 18px 0 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-dark);
  }

  /* Scrolls sideways on a phone rather than wrapping. */
  .act-days, .act-chips { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 6px; }
  .act-day {
    flex: 0 0 auto; min-height: 52px; padding: 0 18px; border-radius: 12px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 2px solid var(--gray-200); background: var(--white); color: var(--navy);
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem; white-space: nowrap;
  }
  .act-day small { font-size: 0.7rem; font-weight: 700; color: var(--gold-dark); }
  .act-day.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .act-day.is-on small { color: var(--gold-light); }

  .act-sums { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 12px; }
  .act-sum {
    text-align: left; padding: 14px 16px; border-radius: 14px;
    border: 2px solid var(--gray-200); background: var(--white); color: var(--navy);
    display: flex; flex-direction: column; gap: 4px; font-family: var(--font-body);
  }
  .act-sum.is-button { cursor: pointer; }
  .act-sum.is-on { border-color: var(--navy); box-shadow: 0 0 0 3px var(--gold-light); }
  .act-sum-kind { font-family: var(--font-heading); font-weight: 700; font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
  .act-sum b { font-family: var(--font-heading); font-size: 1.5rem; color: var(--navy); }
  .act-sum b.is-bad { color: var(--bad); }
  .act-sum-cta { font-weight: 700; font-size: 0.9rem; color: var(--gray-600); }
  .act-sum-split { font-size: 0.9rem; color: var(--gray-800); overflow-wrap: anywhere; }

  .act-chips { margin: 16px 0 4px; }
  .act-chips.act-buses { margin-top: 4px; }
  .act-chip {
    flex: 0 0 auto; min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--gray-200); background: var(--white); color: var(--navy);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; white-space: nowrap;
  }
  .act-chip span { margin-left: 4px; color: var(--gray-600); font-weight: 600; }
  .act-chip.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .act-chip.is-on span { color: var(--gold-light); }

  .act-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0 12px; }
  .act-bar .dash-btn { min-height: 48px; flex: 1 1 auto; justify-content: center; }
  .act-search { position: relative; flex: 1 1 100%; }
  .act-search i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--gray-400); pointer-events: none; }
  .act-search .dash-input { padding-left: 40px; min-height: 48px; font-size: 16px; }

  .act-staff { margin-top: 12px; padding: 12px; }
  .act-staff ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .act-staff-title {
    margin: 0 4px 8px; font-family: var(--font-heading); font-weight: 800; font-size: 0.75rem;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600);
  }
  .act-staff-title span { text-transform: none; letter-spacing: 0; font-weight: 600; }
  .act-staff-row {
    width: 100%; min-height: 48px; padding: 8px; border: 0; border-radius: 10px; background: none; cursor: pointer;
    display: flex; flex-direction: column; gap: 2px; text-align: left; color: var(--navy); font-family: var(--font-body);
  }
  .act-staff li + li .act-staff-row { border-top: 1px solid var(--gray-100); border-radius: 0; }
  .act-staff-row:hover { background: var(--gray-100); }
  .act-staff-row.is-on { background: var(--navy); color: var(--white); border-radius: 10px; }
  .act-staff-row strong { font-family: var(--font-heading); font-weight: 800; overflow-wrap: anywhere; }
  .act-staff-stats { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 0.9rem; color: var(--gray-600); }
  .act-staff-row.is-on .act-staff-stats { color: var(--gold-light); }
  .act-staff-stats b { color: var(--navy); }
  .act-staff-row.is-on .act-staff-stats b { color: var(--white); }
  .act-staff-stats .is-bad, .act-staff-stats .is-bad b { color: var(--bad); }
  .act-more { width: 100%; justify-content: center; margin-top: 8px; }

  .act-only {
    display: inline-flex; align-items: center; gap: 8px; min-height: 40px; margin-bottom: 10px; padding: 0 14px;
    border-radius: 999px; border: 0; background: var(--navy); color: var(--white); cursor: pointer;
    font-family: var(--font-heading); font-weight: 700;
  }

  .act-hours { display: flex; flex-direction: column; gap: 10px; }
  .act-hour { display: flex; flex-direction: column; gap: 8px; }
  .act-hour-head {
    display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 0 14px; cursor: pointer;
    border: 1px solid var(--gray-200); border-radius: 12px; background: var(--white); color: var(--navy);
    font-family: var(--font-heading); font-weight: 800; font-size: 1rem; text-align: left;
  }
  .act-hour-head > span:first-child { flex: 1; }
  .act-hour-head small { font-weight: 700; color: var(--gray-600); }
  .act-hour-count { font-size: 0.9rem; font-weight: 700; color: var(--gray-600); }

  .act-visits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .act-visit {
    display: grid; grid-template-columns: 1fr auto; grid-template-areas: "who time" "steps steps" "by by";
    gap: 6px 10px; padding: 12px 14px; border-radius: 12px; background: var(--white); border: 1px solid var(--gray-200);
  }
  .act-visit.is-fix { border-left: 4px solid var(--bad); }
  .act-visit > .act-time { grid-area: time; }
  .act-who { grid-area: who; min-width: 0; }
  .act-steps { grid-area: steps; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .act-steps > li { display: flex; flex-direction: column; gap: 3px; }
  .act-run { display: flex; flex-wrap: wrap; gap: 4px; }
  .act-fix { display: flex; flex-direction: column; gap: 2px; }
  .act-by { grid-area: by; font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }
  .act-by b { color: var(--navy); }
  .act-name { font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem; color: var(--navy); overflow-wrap: anywhere; }
  .act-sub { display: block; font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }
  .act-time { font-family: var(--font-heading); font-weight: 800; color: var(--navy); white-space: nowrap; }

  .act-what { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .act-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px;
    background: var(--gray-100); color: var(--navy);
    font-family: var(--font-heading); font-weight: 800; font-size: 0.9rem;
  }
  .act-pill.is-bad { background: var(--bad-bg); color: var(--bad); }
  .act-pill.is-warn { background: var(--gold-light); color: var(--gold-dark); }
  .act-pill.is-gone { background: var(--white); border: 1px dashed var(--gray-400); color: var(--gray-600); font-weight: 700; }
  .is-reversed .act-pill:not(.is-gone) { text-decoration: line-through; opacity: 0.7; }

  .act-detail {
    display: flex; flex-direction: column; gap: 2px; padding-left: 2px;
    font-family: var(--font-body); font-size: 0.85rem; color: var(--gray-600);
  }
  .act-detail b { color: var(--navy); }
  .act-note { font-style: italic; color: var(--gray-600); overflow-wrap: anywhere; }

  @media (min-width: 640px) {
    .act-sums { grid-template-columns: repeat(3, 1fr); }
    .act-search { flex: 1 1 auto; }
    .act-bar .dash-btn { flex: 0 0 auto; }
  }
  @media (min-width: 900px) {
    .act-staff ul { display: grid; grid-template-columns: repeat(2, 1fr); column-gap: 16px; }
    .act-staff li + li .act-staff-row { border-top: 0; border-radius: 10px; }
    .act-visit { grid-template-columns: 80px minmax(180px, 240px) 1fr minmax(140px, 200px); grid-template-areas: "time who steps by"; align-items: start; }
    .act-by { text-align: right; }
  }
`

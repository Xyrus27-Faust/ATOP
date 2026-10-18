import { useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { checkInActivity, formatDay, formatVenueTime, venueDate, csvStamp, fold } from '@/lib/checkin'
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

const FILTERS = [
  { key: 'all', label: 'Everything', test: () => true },
  { key: 'fixes', label: 'Corrections', test: (r) => actionOf(r.action).group === 'fixes' },
  { key: 'cash', label: 'Cash', test: (r) => r.action === 'PaidAtDesk' || (r.action === 'StepUndone' && r.amount != null) },
  { key: 'desk', label: 'Desk', test: (r) => actionOf(r.action).group === 'desk' },
  { key: 'scans', label: 'Scans', test: (r) => r.action === 'Scanned' || r.action === 'ManualLog' || r.action === 'MarkedAttended' },
]

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
    return { event, log: await checkInActivity(event.id, picked) }
  }, [picked])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, log } = data
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
      <DayLog key={log.day} log={log} loading={loading} reload={reload} />
    </>
  )
}

function DayLog({ log, loading, reload }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  const rows = log.rows
  const test = (FILTERS.find((f) => f.key === filter) || FILTERS[0]).test
  const term = fold(q.trim())
  const shown = rows.filter((r) => test(r)
    && (!term || fold(r.fullName).includes(term) || fold(r.lgu).includes(term)
      || fold(r.by).includes(term) || fold(r.originalBy).includes(term) || fold(r.where).includes(term)))

  // Cash the day's cashiers still hold: payments not handed back. A payment undone the same day
  // shows as taken back and is left out; one undone on a later day is counted here and on that day's undo.
  const cashBy = new Map()
  rows.filter((r) => r.action === 'PaidAtDesk' && !r.reversed)
    .forEach((r) => cashBy.set(r.by, (cashBy.get(r.by) || 0) + r.amount))
  const cashTotal = [...cashBy.values()].reduce((a, b) => a + b, 0)
  const fixes = rows.filter((r) => actionOf(r.action).group === 'fixes').length

  const exportCsv = () => downloadCsv(`atop-activity-${log.day}.csv`, [
    ['Time', 'What happened', 'Name', 'LGU / Organisation', 'Where', 'Done by', 'Amount', 'Reason / note',
      'Taken back later', 'Originally done by', 'Originally done at'],
    ...shown.map((r) => [
      csvStamp(r.at), actionOf(r.action).label + (r.undid ? `: ${actionOf(r.undid).label}` : ''), r.fullName, r.lgu ?? '',
      r.where ?? '', r.by, r.amount ?? '', r.note ?? '', r.reversed ? 'Yes' : '', r.originalBy ?? '',
      csvStamp(r.originalAt),
    ]),
  ])

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
          onClick={() => setFilter(filter === 'fixes' ? 'all' : 'fixes')}
          aria-pressed={filter === 'fixes'}
        >
          <span className="act-sum-kind">Corrections</span>
          <b className={fixes > 0 ? 'is-bad' : ''}>{fixes}</b>
          <span className="act-sum-cta">{filter === 'fixes' ? 'Showing them · tap to show everything' : 'Voids, undos, added by hand →'}</span>
        </button>
        <button
          type="button"
          className={`act-sum is-button${filter === 'cash' ? ' is-on' : ''}`}
          onClick={() => setFilter(filter === 'cash' ? 'all' : 'cash')}
          aria-pressed={filter === 'cash'}
        >
          <span className="act-sum-kind">Cash taken at Desk B</span>
          <b>{formatPeso(cashTotal)}</b>
          {cashBy.size > 0 && (
            <span className="act-sum-split">
              {[...cashBy].map(([by, amount]) => `${by} ${formatPeso(amount)}`).join(' · ')}
            </span>
          )}
        </button>
      </div>

      <div className="act-chips" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={f.key === filter}
            className={`act-chip${f.key === filter ? ' is-on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span>{rows.filter(f.test).length}</span>
          </button>
        ))}
      </div>

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

      {shown.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>{rows.length === 0 ? `Nothing was done at check-in on ${formatDay(log.day)}.` : 'Nothing here matches.'}</p>
        </div>
      ) : (
        <>
          <ul className="act-cards">
            {shown.map((r, i) => (
              <li key={`${r.action}-${r.delegateId}-${r.at}-${i}`} className={`dash-card act-card${r.reversed ? ' is-reversed' : ''}`}>
                <div className="act-card-top">
                  <What row={r} />
                  <span className="act-time">{formatVenueTime(r.at)}</span>
                </div>
                <strong className="act-name">{r.fullName}</strong>
                {r.lgu && <span className="act-sub">{r.lgu}</span>}
                <Detail row={r} />
              </li>
            ))}
          </ul>

          <div className="dash-card act-table-wrap">
            <table className="act-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>What happened</th>
                  <th>Delegate</th>
                  <th>Done by</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={`${r.action}-${r.delegateId}-${r.at}-${i}`} className={r.reversed ? 'is-reversed' : ''}>
                    <td className="act-time">{formatVenueTime(r.at)}</td>
                    <td><What row={r} /></td>
                    <td>
                      <strong>{r.fullName}</strong>
                      {r.lgu && <span className="act-sub">{r.lgu}</span>}
                    </td>
                    <td>{r.by}</td>
                    <td><Detail row={r} table /></td>
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

/** The action as a coloured pill with its icon, plus "taken back" on one later voided or undone. */
function What({ row: r }) {
  const a = actionOf(r.action)
  return (
    <span className="act-what">
      <span className={`act-pill${a.tone ? ` is-${a.tone}` : ''}`}>
        <i className={`fas ${a.icon}`} aria-hidden="true" /> {a.label}
      </span>
      {r.reversed && <span className="act-pill is-gone">Taken back later</span>}
    </span>
  )
}

/** Where, how much, who did it (on the phone card), what a correction reversed, and the reason. */
function Detail({ row: r, table = false }) {
  const lines = []
  if (!table) lines.push(<span key="by">By <b>{r.by}</b></span>)
  if (r.where) lines.push(<span key="where">At <b>{r.where}</b></span>)
  if (r.amount != null) lines.push(<span key="amount">Amount <b>{formatPeso(r.amount)}</b></span>)
  if (r.undid) {
    lines.push(
      <span key="undid">
        Took back <b>{actionOf(r.undid).label.toLowerCase()}</b>
        {r.originalBy && <> by {r.originalBy}</>}
        {r.originalAt && <>, {formatDay(venueDate(r.originalAt))} {formatVenueTime(r.originalAt)}</>}
      </span>,
    )
  }
  if (r.note) lines.push(<span key="note" className="act-note">&ldquo;{r.note}&rdquo;</span>)
  if (lines.length === 0) return table ? <span className="act-none">—</span> : null
  return <span className="act-detail">{lines}</span>
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

  .act-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .act-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
  .act-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
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
    display: flex; flex-direction: column; gap: 2px; margin-top: 4px;
    font-family: var(--font-body); font-size: 0.92rem; color: var(--gray-800);
  }
  .act-detail b { color: var(--navy); }
  .act-note { font-style: italic; color: var(--gray-600); overflow-wrap: anywhere; }
  .act-none { color: var(--gray-400); }

  .act-table-wrap { display: none; overflow-x: auto; padding: 0; }
  .act-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 0.95rem; }
  .act-table th {
    text-align: left; padding: 12px 14px; font-family: var(--font-heading); font-size: 0.8rem; font-weight: 800;
    color: var(--navy); border-bottom: 2px solid var(--gray-200); vertical-align: bottom;
  }
  .act-table td { padding: 10px 14px; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
  .act-table td strong { display: block; font-family: var(--font-heading); font-size: 1rem; color: var(--navy); min-width: 180px; }
  .act-table .act-detail { margin-top: 0; }

  @media (min-width: 640px) {
    .act-sums { grid-template-columns: repeat(3, 1fr); }
    .act-search { flex: 1 1 auto; }
    .act-bar .dash-btn { flex: 0 0 auto; }
  }
  @media (min-width: 900px) {
    .act-cards { display: none; }
    .act-table-wrap { display: block; }
  }
`

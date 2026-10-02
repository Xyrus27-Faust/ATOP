import { useState } from 'react'
import { getRegistrationAttendance, formatDay, formatVenueTime, kindMeta } from '@/lib/checkin'
import { useAsync } from '../../useAsync'

/**
 * Where each of this booking's delegates has been scanned — the door and every meal, one day at a
 * time. For the booker, often an LGU office that needs to show its people actually attended.
 *
 * <p>Renders nothing until the convention's first day: before then every row would read "not yet",
 * which says nothing. Only days up to today are offered, and "today" is the venue's, from the
 * server, so a phone on the wrong clock can't show tomorrow as missed.</p>
 */
export default function AttendanceCard({ registrationId }) {
  const { data, loading, error, reload } = useAsync(
    () => getRegistrationAttendance(registrationId),
    [registrationId],
  )
  const [picked, setPicked] = useState(null)

  if (error && !data) {
    return (
      <div className="dash-card dash-card-pad rd-card">
        <h2 className="dash-card-title"><i className="fas fa-clipboard-check" aria-hidden="true" /> Attendance</h2>
        <p className="dash-help">{error.message || 'We couldn’t load attendance just now.'}</p>
        <button type="button" className="dash-btn" onClick={reload}>
          <i className="fas fa-rotate-right" aria-hidden="true" /> Try again
        </button>
      </div>
    )
  }

  if (!data || data.delegates.length === 0) return null

  const days = [...new Set(data.checkpoints.map((c) => c.day))].filter((d) => d <= data.today)
  if (days.length === 0) return null

  const day = days.includes(picked) ? picked : days[days.length - 1]
  const checkpoints = data.checkpoints.filter((c) => c.day === day)
  const entryIds = new Set(checkpoints.filter((c) => c.kind === 'Entry').map((c) => c.id))
  const entered = data.delegates.filter((d) => d.marks.some((m) => entryIds.has(m.checkpointId))).length

  return (
    <div className="dash-card dash-card-pad rd-card ac-card">
      <div className="ac-head">
        <h2 className="dash-card-title">
          <i className="fas fa-clipboard-check" aria-hidden="true" /> Attendance
        </h2>
        <button type="button" className="dash-btn is-ghost is-sm" onClick={reload} disabled={loading}>
          <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      {days.length > 1 && (
        <div className="ac-days" role="tablist" aria-label="Convention day">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              className={`ac-day${d === day ? ' is-on' : ''}`}
              onClick={() => setPicked(d)}
            >
              {d === data.today ? 'Today' : formatDay(d)}
            </button>
          ))}
        </div>
      )}

      <p className="dash-help ac-summary">
        {days.length === 1 && <>{formatDay(day)} · </>}
        {entryIds.size > 0
          ? <><strong>{entered}</strong> of {data.delegates.length} entered</>
          : 'No door check-in this day'}
        {' '}· updates as badges are scanned.
      </p>

      <ul className="ac-rows">
        {data.delegates.map((d) => {
          const at = Object.fromEntries(d.marks.map((m) => [m.checkpointId, m.scannedAt]))
          return (
            <li key={d.id} className="ac-row">
              <span className="ac-name">{d.fullName}</span>
              <span className="ac-marks">
                {checkpoints.map((c) => {
                  const when = at[c.id]
                  return (
                    <span key={c.id} className={`ac-mark${when ? ' is-done' : ''}`}>
                      <i className={`fas ${when ? 'fa-check' : kindMeta(c.kind).icon}`} aria-hidden="true" />
                      {c.label}
                      {when
                        ? <span className="ac-time">{formatVenueTime(when)}</span>
                        : <span className="sr-only"> — not scanned</span>}
                    </span>
                  )
                })}
              </span>
            </li>
          )
        })}
      </ul>

      <style>{AC_CSS}</style>
    </div>
  )
}

const AC_CSS = `
  .ac-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .ac-head .dash-card-title { margin-bottom: 0; }
  .ac-head .dash-btn { min-height: 40px; }
  .ac-days { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
  .ac-day {
    min-height: 40px; padding: 0 16px; cursor: pointer; border-radius: 999px;
    background: var(--white); border: 1.5px solid var(--gray-200); color: var(--navy);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem; transition: var(--transition-fast);
  }
  .ac-day:hover { border-color: var(--gold); }
  .ac-day.is-on { border-color: var(--navy); background: var(--navy); color: var(--white); }
  .ac-summary { margin: 12px 0 10px; }
  .ac-summary strong { color: var(--navy); }
  .ac-rows { list-style: none; margin: 0; padding: 0; }
  .ac-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; }
  .ac-row + .ac-row { border-top: 1px solid var(--gray-200); }
  .ac-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; }
  .ac-marks { display: flex; flex-wrap: wrap; gap: 6px; }
  .ac-mark {
    display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
    font-family: var(--font-body); font-size: 0.78rem; color: var(--gray-400);
    border: 1px dashed var(--gray-200); background: var(--white);
  }
  .ac-mark i { font-size: 0.7rem; }
  .ac-mark.is-done { color: var(--ok); background: var(--ok-bg); border: 1px solid transparent; font-weight: 600; }
  .ac-time { font-weight: 400; color: var(--gray-600); }

  @media (min-width: 640px) {
    .ac-row { flex-direction: row; align-items: center; gap: 14px; }
    .ac-name { flex: 0 0 34%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
`

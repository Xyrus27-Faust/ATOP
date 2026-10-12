import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { listCheckpoints, getLiveSession, updateCheckpoint, groupByDay, formatDayHeader, kindMeta, stateMeta, progressPct } from '@/lib/checkin'
import { useAsync } from '../../useAsync'
import { Loading, ErrorState } from '../states'

/**
 * The doors, meal lines and buses, and how far each has got.
 *
 * <p>The count reads against "expected": in-person delegates on a confirmed booking whose seat has a
 * pass. That is the number who <em>could</em> walk up — a delegate still in a draft booking can't,
 * so counting them would make every meal look half-empty.</p>
 *
 * <p>Sessions open and close from here. One is live at a time — opening one closes the day's other
 * session on the API — and every gate and desk check-in while it is live counts for it. "Live now"
 * is the API's answer, not a guess from the list, so it matches what the gate's bar says.</p>
 */
export default function CheckpointsTab() {
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return { event: null, checkpoints: [], live: null }
    const [checkpoints, live] = await Promise.all([listCheckpoints(event.id), getLiveSession(event.id)])
    return { event, checkpoints, live }
  }, [])
  const [switching, setSwitching] = useState(null)
  const [switchError, setSwitchError] = useState(null)

  async function setSession(checkpoint, open) {
    setSwitching(checkpoint.id)
    setSwitchError(null)
    try {
      await updateCheckpoint(checkpoint.id, { isActive: open })
      reload()
    } catch (err) {
      setSwitchError(err.message)
    }
    setSwitching(null)
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, checkpoints, live } = data
  if (!event) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-clipboard-list" aria-hidden="true" /></div>
        <h3>No published convention</h3>
        <p>Publish an event before setting up its checkpoints.</p>
      </div>
    )
  }

  return (
    <>
      <style>{CKP_CSS}</style>
      <div className="ckp-bar">
        <span className="ckp-event">{event.name}</span>
        <button className="dash-btn is-ghost is-sm" onClick={reload}>
          <i className="fas fa-rotate-right" aria-hidden="true" /> Refresh
        </button>
        <Link className="dash-btn is-primary is-sm" to="/dashboard/admin/checkin/checkpoints/new">
          <i className="fas fa-plus" aria-hidden="true" /> New checkpoint
        </Link>
      </div>

      <p className={`ckp-live${live ? ' is-live' : ''}`} role="status">
        <i className={`fas ${live ? 'fa-door-open' : 'fa-door-closed'}`} aria-hidden="true" />
        {live
          ? <span>Live now: <b>{live.label}</b>. Check-ins at the gate and desk count for it.</span>
          : <span>No session open. The gate and desk check people in without counting them anywhere.</span>}
      </p>
      {switchError && (
        <div className="dash-banner tone-error ckp-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{switchError}</span>
        </div>
      )}

      {checkpoints.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-door-open" aria-hidden="true" /></div>
          <h3>No checkpoints yet</h3>
          <p>Add each day&rsquo;s sessions, meals and tour buses. Marshals see only the open ones.</p>
          <Link className="dash-btn is-primary" to="/dashboard/admin/checkin/checkpoints/new">
            <i className="fas fa-plus" aria-hidden="true" /> New checkpoint
          </Link>
        </div>
      ) : (
        groupByDay(checkpoints).map((g) => (
          <section key={g.day} className="ckp-day">
            <h2 className="ckp-day-head">{formatDayHeader(g.day)}</h2>
            <div className="ckp-grid">
              {g.items.map((c) => (
                <CheckpointCard key={c.id} checkpoint={c} live={live?.id === c.id}
                  switching={switching} onSession={setSession} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}

/**
 * One checkpoint, linking to its lists. A session also carries its Open / Close button under the
 * link: opening one today is how the admin moves the gate on to the next part of the programme.
 */
function CheckpointCard({ checkpoint: c, live, switching, onSession }) {
  const kind = kindMeta(c.kind)
  const state = stateMeta(c.state)
  const pct = progressPct(c.scanCount, c.expected)
  // Dimmed when no marshal can scan it today and never will again without a hand on it.
  const dimmed = c.state === 'Closed' || c.state === 'Ended'
  const session = c.kind === 'Entry' && state.canToggle
  const busy = switching === c.id

  return (
    <div className={`dash-card ckp-card${dimmed ? ' is-closed' : ''}${live ? ' is-live' : ''}`}>
      <Link to={`/dashboard/admin/checkin/checkpoints/${c.id}`} className="ckp-card-link">
        <div className="ckp-card-top">
          <span className="ckp-kind"><i className={`fas ${kind.icon}`} aria-hidden="true" /> {kind.label}</span>
          {live
            ? <span className="dash-badge tone-success">Live now</span>
            : c.state !== 'Open' && <span className={`dash-badge ${state.tone}`}>{state.label}</span>}
        </div>
        <strong className="ckp-label">{c.label}</strong>
        <div className="ckp-count">
          <span><b>{c.scanCount}</b> / {c.expected}</span>
          <span className="ckp-pct">{pct}%</span>
        </div>
        <div className="dash-meter" aria-hidden="true">
          <div className={`dash-meter-fill${pct >= 100 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </Link>
      {session && (
        <button type="button" className={`dash-btn is-sm ckp-session ${c.isActive ? 'is-ghost' : 'is-primary'}`}
          disabled={switching !== null} onClick={() => onSession(c, !c.isActive)}>
          {busy
            ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
            : <i className={`fas ${c.isActive ? 'fa-door-closed' : 'fa-door-open'}`} aria-hidden="true" />}
          {' '}{c.isActive ? 'Close session' : 'Open session'}
        </button>
      )}
    </div>
  )
}

const CKP_CSS = `
  .ckp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 16px 0 18px; }
  .ckp-bar .dash-btn { min-height: 40px; }
  .ckp-event { flex: 1 1 100%; font-family: var(--font-heading); font-weight: 700; color: var(--navy); }
  .ckp-day { margin-bottom: 26px; }
  .ckp-day-head {
    font-family: var(--font-heading); font-weight: 800; font-size: 0.74rem; letter-spacing: 0.12em;
    color: var(--gold-dark); margin-bottom: 10px;
  }
  .ckp-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .ckp-live {
    display: flex; align-items: flex-start; gap: 10px; margin: 0 0 18px; padding: 12px 16px; border-radius: var(--radius-sm);
    background: var(--gray-100); color: var(--gray-600); font-family: var(--font-body); line-height: 1.5;
  }
  .ckp-live i { margin-top: 3px; }
  .ckp-live.is-live { background: var(--ok-bg); color: var(--ok); }
  .ckp-live b { font-family: var(--font-heading); }
  .ckp-error { margin-bottom: 18px; }
  .ckp-card {
    display: flex; flex-direction: column; gap: 12px; padding: 16px 18px;
    border-left: 4px solid var(--navy); transition: var(--transition-fast);
  }
  .ckp-card:hover { border-color: var(--gold); box-shadow: var(--shadow-md); }
  .ckp-card.is-closed { opacity: 0.7; border-left-color: var(--gray-400); }
  .ckp-card.is-live { border-left-color: var(--ok); }
  .ckp-card-link { display: flex; flex-direction: column; gap: 10px; text-decoration: none; }
  .ckp-session { align-self: flex-start; min-height: 40px; }
  .ckp-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ckp-kind {
    font-family: var(--font-heading); font-weight: 700; font-size: 0.7rem; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--gray-600);
  }
  .ckp-kind i { color: var(--gold-dark); margin-right: 4px; }
  .ckp-label { font-family: var(--font-heading); font-weight: 800; font-size: 1.05rem; color: var(--navy); }
  .ckp-count { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--font-body); color: var(--gray-600); font-size: 0.9rem; }
  .ckp-count b { font-family: var(--font-heading); font-size: 1.3rem; color: var(--navy); }
  .ckp-pct { font-family: var(--font-heading); font-weight: 700; color: var(--gold-dark); }

  @media (min-width: 640px) {
    .ckp-event { flex: 1 1 auto; }
    .ckp-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .ckp-grid { grid-template-columns: repeat(3, 1fr); }
  }
`

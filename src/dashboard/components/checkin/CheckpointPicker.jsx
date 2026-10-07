import { groupByDay, formatDayHeader, kindMeta, progressPct, GATE_POST, DESK_POST } from '@/lib/checkin'

/**
 * "Where are you posted?" — the guard's first tap of a shift. The API sends today's only, so the
 * tiles are a handful. Big tiles grouped by day, because the
 * one mistake that matters here is scanning lunch at the dinner line: every badge would come back
 * "already claimed". The chosen checkpoint's name then sits in the bar above the camera all shift.
 *
 * <p>The main gate sits on top for everyone, and the Secretariat desk under it for those who may work
 * it ({@code canDesk}); {@code onPickPost} is called with the one picked. They're there whatever the
 * day holds: the gate checks people in before any session or meal opens.</p>
 */
export default function CheckpointPicker({ checkpoints, onPick, onPickPost, canDesk, onRefresh, refreshing }) {
  // A button rather than "pull to refresh": a scanner saved to the home screen has no browser reload.
  const refresh = (
    <button type="button" className="dash-btn is-ghost ckpk-refresh" onClick={onRefresh} disabled={refreshing}>
      <i className={`fas fa-rotate-right${refreshing ? ' fa-spin' : ''}`} aria-hidden="true" />
      {refreshing ? ' Checking…' : ' Refresh'}
    </button>
  )

  const posts = (
    <ul className="ckpk-list">
      <li>
        <button type="button" className="ckpk-tile kind-desk" onClick={() => onPickPost(GATE_POST)}>
          <i className="fas fa-door-open" aria-hidden="true" />
          <span className="ckpk-tile-body">
            <span className="ckpk-tile-label">Main gate</span>
            <span className="ckpk-tile-sub">Check-in, then Desk A or Desk B</span>
          </span>
        </button>
      </li>
      {canDesk && (
        <li>
          <button type="button" className="ckpk-tile kind-desk" onClick={() => onPickPost(DESK_POST)}>
            <i className="fas fa-id-card" aria-hidden="true" />
            <span className="ckpk-tile-body">
              <span className="ckpk-tile-label">Secretariat desk</span>
              <span className="ckpk-tile-sub">Desk A / B: balance, ID &amp; receipt, kit</span>
            </span>
          </button>
        </li>
      )}
    </ul>
  )

  return (
    <div className="ckpk">
      <h1 className="ckpk-title">Where are you posted?</h1>
      {posts}
      {checkpoints.length === 0 && (
        <p className="ckpk-none">No sessions, meals or buses open today. Refresh once the Secretariat opens one.</p>
      )}
      {groupByDay(checkpoints).map((g) => (
        <section key={g.day} className="ckpk-day" aria-label={formatDayHeader(g.day)}>
          <h2 className="ckpk-day-head">{formatDayHeader(g.day)}</h2>
          <ul className="ckpk-list">
            {g.items.map((c) => {
              const kind = kindMeta(c.kind)
              const pct = progressPct(c.scanCount, c.expected)
              return (
                <li key={c.id}>
                  <button type="button" className={`ckpk-tile kind-${c.kind.toLowerCase()}`} onClick={() => onPick(c)}>
                    <i className={`fas ${kind.icon}`} aria-hidden="true" />
                    <span className="ckpk-tile-body">
                      <span className="ckpk-tile-label">{c.label}</span>
                      <span className="dash-meter ckpk-meter" aria-hidden="true">
                        <span className={`dash-meter-fill${pct >= 100 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    <span className="ckpk-tile-count" aria-label={`${c.scanCount} of ${c.expected} expected so far`}>
                      <b>{c.scanCount}</b> / {c.expected}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {refresh}
      <style>{CKPK_CSS}</style>
    </div>
  )
}

const CKPK_CSS = `
  .ckpk { padding: 20px 16px 32px; display: flex; flex-direction: column; gap: 18px; }
  .ckpk-title { font-family: var(--font-heading); font-weight: 800; font-size: 1.35rem; color: var(--navy); }
  .ckpk-day { display: flex; flex-direction: column; gap: 10px; }
  .ckpk-day-head {
    font-family: var(--font-heading); font-weight: 800; font-size: 0.74rem; letter-spacing: 0.12em;
    color: var(--gold-dark);
  }
  .ckpk-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .ckpk-tile {
    width: 100%; min-height: 64px; display: flex; align-items: center; gap: 14px; padding: 12px 16px;
    background: var(--white); border: 1.5px solid var(--gray-200); border-left: 5px solid var(--navy);
    border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); cursor: pointer; text-align: left;
    transition: var(--transition-fast);
  }
  .ckpk-tile.kind-meal { border-left-color: var(--gold); }
  .ckpk-tile.kind-desk { border-left-color: var(--gold-dark); }
  .ckpk-tile-sub { font-size: 0.84rem; color: var(--gray-600); }
  .ckpk-none { color: var(--gray-600); font-size: 0.9rem; line-height: 1.5; }
  .ckpk-tile:hover, .ckpk-tile:focus-visible { border-color: var(--gold); box-shadow: var(--shadow-md); }
  .ckpk-tile i { width: 22px; text-align: center; font-size: 1.15rem; color: var(--navy-mid); }
  .ckpk-tile-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .ckpk-tile-label { font-family: var(--font-heading); font-weight: 700; font-size: 1.02rem; color: var(--navy); }
  .dash-meter.ckpk-meter { display: block; height: 6px; }
  .ckpk-meter .dash-meter-fill { display: block; }
  .ckpk-tile-count {
    flex-shrink: 0; font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem; color: var(--gray-600);
    background: var(--gray-100); border-radius: 999px; padding: 4px 10px; font-variant-numeric: tabular-nums;
  }
  .ckpk-tile-count b { color: var(--navy); }
  .ckpk-refresh { align-self: center; min-height: 44px; margin-top: 12px; }

  @media (min-width: 640px) {
    .ckpk { max-width: 640px; margin: 0 auto; padding-top: 32px; }
    .ckpk-list { grid-template-columns: 1fr 1fr; }
  }
`

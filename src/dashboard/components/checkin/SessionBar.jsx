/**
 * The strip across the top of the gate and the desk saying which session a check-in counts for, so
 * whoever holds the phone knows they're scanning into the right one. Grey when none is open: the
 * scan still checks people in, it just counts them nowhere. {@code useLiveSession} feeds it.
 */
export default function SessionBar({ session, known }) {
  if (!known) return null
  return (
    <div className={`ssb${session ? ' is-live' : ''}`} role="status" aria-live="polite">
      <i className={`fas ${session ? 'fa-door-open' : 'fa-door-closed'}`} aria-hidden="true" />
      {session
        ? <span><b>Session:</b> {session.label}</span>
        : <span>No session open · check-in only</span>}
      <style>{SSB_CSS}</style>
    </div>
  )
}

const SSB_CSS = `
  .ssb {
    display: flex; align-items: center; gap: 10px; padding: 10px 16px;
    background: var(--gray-200); color: var(--gray-600);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; line-height: 1.3;
  }
  .ssb.is-live { background: var(--ok-bg); color: var(--ok); }
  .ssb span { min-width: 0; overflow-wrap: anywhere; }
  .ssb b { font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.8rem; margin-right: 4px; }
`

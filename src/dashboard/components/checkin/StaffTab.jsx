import { useSearchParams } from 'react-router-dom'
import StaffRoster from './StaffRoster'

const ROSTERS = [
  { key: 'marshals', label: 'Marshals', icon: 'fa-qrcode', role: 'Marshal' },
  { key: 'secretariat', label: 'Secretariat', icon: 'fa-id-card', role: 'Secretariat' },
]

/**
 * Who works the convention floor: the marshals at the doors, meals and buses, and the secretariat at
 * the desk and the kit table. An admin's tab — the secretariat runs check-in but doesn't hand out roles.
 *
 * <p>Which list is open lives in the URL (?who=secretariat) beside the page's own tab.</p>
 */
export default function StaffTab() {
  const [params, setParams] = useSearchParams()
  const roster = ROSTERS.find((r) => r.key === params.get('who')) || ROSTERS[0]
  const pick = (key) => setParams((p) => {
    const next = new URLSearchParams(p)
    if (key === ROSTERS[0].key) next.delete('who')
    else next.set('who', key)
    return next
  }, { replace: true })

  return (
    <>
      <div className="cks-switch" role="tablist" aria-label="Staff">
        {ROSTERS.map((r) => (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={r.key === roster.key}
            className={`cks-chip${r.key === roster.key ? ' is-on' : ''}`}
            onClick={() => pick(r.key)}
          >
            <i className={`fas ${r.icon}`} aria-hidden="true" /> {r.label}
          </button>
        ))}
      </div>
      <p className="dash-help cks-help">
        Marshals scan at sessions, meals and buses. The secretariat runs the desk and the kit table. Both
        use the same scanner and pick their post on it.
      </p>

      {/* Keyed by roster so switching between the two lists starts each one fresh. */}
      <StaffRoster key={roster.key} role={roster.role} />
      <style>{`
        .cks-switch { display: flex; gap: 8px; margin: 4px 0 8px; }
        .cks-chip {
          flex: 1 1 0; min-height: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer;
          border: 1px solid var(--gray-200); background: var(--white); color: var(--navy);
          font-family: var(--font-heading); font-weight: 700; font-size: 0.88rem;
        }
        .cks-chip.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
        .cks-help { margin-bottom: 4px; }
        @media (min-width: 640px) { .cks-chip { flex: 0 0 auto; } }
      `}</style>
    </>
  )
}

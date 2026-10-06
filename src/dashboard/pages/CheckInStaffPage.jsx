import { useSearchParams } from 'react-router-dom'
import StaffRoster from '../components/checkin/StaffRoster'

const TABS = [
  { key: 'marshals', label: 'Marshals', icon: 'fa-qrcode', role: 'Marshal' },
  { key: 'secretariat', label: 'Secretariat', icon: 'fa-id-card', role: 'Secretariat' },
]

/**
 * Who works the convention floor: the marshals at the doors, meals and buses, and the secretariat at
 * the desk. An admin's page — the secretariat runs check-in but doesn't hand out roles.
 *
 * <p>The tab lives in the URL (?tab=secretariat), so a refresh or a shared link opens the same one.</p>
 */
export default function CheckInStaffPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('tab')) || TABS[0]
  const pick = (key) => setParams(key === TABS[0].key ? {} : { tab: key }, { replace: true })

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Check-in</span>
          <h1 className="dash-h1">Staff</h1>
          <p className="dash-sub">
            Marshals scan at sessions, meals and buses. The secretariat runs the desk every delegate passes
            first. Both use the same scanner and pick their post on it.
          </p>
        </div>
      </div>

      <nav className="dash-tabs cks-tabs" role="tablist" aria-label="Staff">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab.key}
            className={`dash-tab${t.key === tab.key ? ' active' : ''}`}
            onClick={() => pick(t.key)}
          >
            <i className={`fas ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </nav>

      {/* Keyed by tab so switching between the two lists starts each one fresh. */}
      <StaffRoster key={tab.key} role={tab.role} />
      <style>{`
        .cks-tabs { margin-bottom: 4px; }
        .cks-tabs .dash-tab { min-height: 44px; }
      `}</style>
    </>
  )
}

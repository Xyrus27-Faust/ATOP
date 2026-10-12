import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import CheckpointsTab from '../components/checkin/CheckpointsTab'
import DeskListTab from '../components/desk/DeskListTab'
import StaffTab from '../components/checkin/StaffTab'

const TABS = [
  { key: 'checkpoints', label: 'Checkpoints', icon: 'fa-door-open', Body: CheckpointsTab },
  { key: 'desk', label: 'Desk list', icon: 'fa-clipboard-list', Body: DeskListTab },
  { key: 'staff', label: 'Staff', icon: 'fa-user-shield', Body: StaffTab, adminOnly: true },
]

/**
 * The secretariat's one check-in page: the checkpoints and how far each has got, the desk's list of
 * who has arrived, paid, and collected their ID and kit, and (for admins) who works the floor.
 *
 * <p>The scanner stays its own full-screen page — it's a phone held all day, used by marshals who may
 * not see these lists — and this page opens it in one tap. The tab lives in the URL (?tab=desk), so a
 * refresh or a shared link opens the same one; a tab someone may not see falls back to the first.</p>
 */
export default function CheckInPage() {
  const { user } = useAuth()
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin(user?.roles))
  const [params, setParams] = useSearchParams()
  const tab = tabs.find((t) => t.key === params.get('tab')) || tabs[0]
  // A new tab drops the old one's own params (the staff list's ?who=).
  const pick = (key) => setParams(key === tabs[0].key ? {} : { tab: key }, { replace: true })

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Convention</span>
          <h1 className="dash-h1">Check-in</h1>
          <p className="dash-sub">
            Every delegate is checked in at the Secretariat desk first, then scanned at each session, meal
            and tour bus. Here is who has been where, and who hasn&rsquo;t yet.
          </p>
        </div>
        <div className="cki-actions">
          <Link className="dash-btn is-primary" to="/scan">
            <i className="fas fa-qrcode" aria-hidden="true" /> Open scanner
          </Link>
        </div>
      </div>

      <nav className="dash-tabs cki-tabs" role="tablist" aria-label="Check-in">
        {tabs.map((t) => (
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

      <tab.Body key={tab.key} />

      <style>{`
        .cki-actions { display: flex; width: 100%; }
        .cki-actions .dash-btn { flex: 1; justify-content: center; min-height: 48px; }
        .cki-tabs { margin-bottom: 4px; overflow-x: auto; }
        .cki-tabs .dash-tab { min-height: 44px; white-space: nowrap; }
        @media (min-width: 640px) {
          .cki-actions { width: auto; }
          .cki-actions .dash-btn { flex: 0 0 auto; }
        }
      `}</style>
    </>
  )
}

import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '../useAsync'
import { isReviewer } from '../dashboardNav'
import { Loading, ErrorState } from '../components/states'
import StatusBadge from '../components/StatusBadge'
import Readiness from '../components/Readiness'
import { isEditable, computeReadiness, submissionWindow, formatDate } from '@/lib/pearlAwards'

export default function OverviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { loading, error, data, reload } = useAsync(async () => {
    const [entries, catalog] = await Promise.all([
      api.get('/entries/', { auth: true }),
      api.get('/award-categories/'),
    ])
    // Surface the most-recently-touched editable entry with a readiness meter.
    const editable = entries
      .filter((e) => isEditable(e.status))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    let focus = null
    if (editable[0]) {
      const detail = await api.get(`/entries/${editable[0].id}`, { auth: true })
      const category = catalog.categories.find((c) => c.number === detail.categoryNumber)
      focus = { detail, readiness: computeReadiness(detail, category) }
    }
    return { entries, catalog, focus }
  }, [])

  // Reviewer-only users (no applicant role) belong in the review queue, not the
  // applicant overview.
  const roles = user?.roles || []
  if (isReviewer(roles) && !roles.includes('Applicant')) return <Navigate to="/dashboard/review" replace />

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { entries, catalog, focus } = data
  const win = submissionWindow(catalog)
  const count = (statuses) => entries.filter((e) => statuses.includes(e.status)).length
  const stats = [
    { label: 'In progress', value: count(['Draft', 'ReturnedForRevision']), icon: 'fa-pen-ruler' },
    { label: 'In review', value: count(['Submitted', 'UnderValidation']), icon: 'fa-hourglass-half' },
    { label: 'Validated', value: count(['Validated']), icon: 'fa-trophy' },
    { label: 'Total entries', value: entries.length, icon: 'fa-layer-group' },
  ]
  const firstName = user?.firstName || (user?.fullName || '').split(' ')[0] || 'there'
  const returned = entries.filter((e) => e.status === 'ReturnedForRevision')

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Pearl Awards {catalog?.year}</span>
          <h1 className="dash-h1">Welcome back, {firstName}.</h1>
          <p className="dash-sub">
            Track your award entries, see what’s left before you submit, and explore this year’s categories.
          </p>
        </div>
        <button className="dash-btn is-primary" onClick={() => navigate('/dashboard/entries/new')}>
          <i className="fas fa-plus" aria-hidden="true" /> New entry
        </button>
      </div>

      {win && <WindowBanner win={win} catalog={catalog} />}

      {returned.length > 0 && (
        <div className="dash-banner tone-warn" style={{ marginTop: 16 }}>
          <i className="fas fa-rotate-left" aria-hidden="true" />
          <span>
            {returned.length === 1 ? 'One entry was' : `${returned.length} entries were`} returned for revision.{' '}
            <Link to="/dashboard/entries" className="dash-inline-link">Review and resubmit</Link>.
          </span>
        </div>
      )}

      <div className="dash-grid cols-4" style={{ marginTop: 20 }}>
        {stats.map((s) => (
          <div key={s.label} className="dash-card dash-stat">
            <i className={`fas ${s.icon} dash-stat-icon`} aria-hidden="true" />
            <span className="dash-stat-value">{s.value}</span>
            <span className="dash-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="dash-grid cols-2" style={{ marginTop: 20, alignItems: 'start' }}>
        {focus ? (
          <div className="dash-card dash-card-pad">
            <div className="dash-card-title"><i className="fas fa-pen-to-square" aria-hidden="true" /> Continue where you left off</div>
            <div className="ov-focus">
              <div>
                <div className="ov-focus-title">{focus.detail.title}</div>
                <div className="ov-focus-meta">Category #{focus.detail.categoryNumber} · {focus.detail.lguName}</div>
              </div>
              <StatusBadge status={focus.detail.status} />
            </div>
            <Readiness readiness={focus.readiness} showList={false} />
            <button
              className="dash-btn is-primary ov-resume"
              onClick={() => navigate(`/dashboard/entries/${focus.detail.id}`)}
            >
              Resume editing <i className="fas fa-arrow-right" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="dash-card dash-card-pad">
            <div className="dash-card-title"><i className="fas fa-seedling" aria-hidden="true" /> Start your first entry</div>
            <p className="ov-empty-copy">
              You don’t have any drafts yet. Pick a category, tell us about your LGU and program, and we’ll guide you
              through the bidbook step by step.
            </p>
            <button className="dash-btn is-primary" onClick={() => navigate('/dashboard/entries/new')}>
              <i className="fas fa-plus" aria-hidden="true" /> Create an entry
            </button>
          </div>
        )}

        <div className="dash-card dash-card-pad">
          <div className="dash-card-title"><i className="fas fa-compass" aria-hidden="true" /> Quick links</div>
          <div className="ov-links">
            <QuickLink to="/dashboard/entries" icon="fa-folder-open" title="My entries" desc="View and manage every entry" />
            <QuickLink to="/dashboard/awards" icon="fa-award" title="Award categories" desc={`Explore ${catalog?.categories?.length || ''} categories and their criteria`} />
            <QuickLink to="/dashboard/profile" icon="fa-id-badge" title="Profile" desc="Update your name and office" />
          </div>
        </div>
      </div>

      <style>{`
        .dash-inline-link { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
        .ov-focus { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin: 16px 0 18px; }
        .ov-focus-title { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 1.05rem; line-height: 1.3; }
        .ov-focus-meta { color: var(--gray-600); font-size: 0.85rem; margin-top: 3px; }
        .ov-resume { margin-top: 18px; width: 100%; }
        .ov-empty-copy { color: var(--gray-600); line-height: 1.65; margin: 14px 0 18px; }
        .ov-links { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
        .ov-link { display: flex; align-items: center; gap: 13px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--gray-200); transition: var(--transition-fast); }
        .ov-link:hover { border-color: var(--gold); background: var(--off-white); transform: translateX(2px); }
        .ov-link-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: rgba(200,168,75,0.12); color: var(--gold-dark); flex-shrink: 0; }
        .ov-link-title { display: block; font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; }
        .ov-link-desc { display: block; color: var(--gray-600); font-size: 0.8rem; }
      `}</style>
    </>
  )
}

function WindowBanner({ win, catalog }) {
  let icon
  let tone = 'info'
  let text
  if (win.state === 'open') {
    icon = 'fa-door-open'
    text =
      win.daysToClose <= 0
        ? 'Submissions close today.'
        : `Submissions are open — ${win.daysToClose} day${win.daysToClose === 1 ? '' : 's'} left (closes ${formatDate(win.closes)}).`
  } else if (win.state === 'upcoming') {
    icon = 'fa-hourglass-start'
    text = `Submissions open ${formatDate(win.opens)}.`
  } else {
    icon = 'fa-door-closed'
    tone = 'warn'
    text = `Submissions closed on ${formatDate(win.closes)}.`
  }
  return (
    <div className={`dash-banner tone-${tone}`} style={{ marginTop: 4 }}>
      <i className={`fas ${icon}`} aria-hidden="true" />
      <span>
        <strong>Pearl Awards {catalog.year}</strong> · coverage year {catalog.coverageYear}. {text}
      </span>
    </div>
  )
}

function QuickLink({ to, icon, title, desc }) {
  return (
    <Link to={to} className="ov-link">
      <span className="ov-link-icon"><i className={`fas ${icon}`} aria-hidden="true" /></span>
      <span style={{ flex: 1 }}>
        <span className="ov-link-title">{title}</span>
        <span className="ov-link-desc">{desc}</span>
      </span>
      <i className="fas fa-chevron-right" aria-hidden="true" style={{ color: 'var(--gray-400)' }} />
    </Link>
  )
}

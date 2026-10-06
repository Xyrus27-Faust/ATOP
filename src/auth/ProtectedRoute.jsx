import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canAccessPath, isRegistrationDeskOnly, roleHome } from '@/dashboard/dashboardNav'

/**
 * Route guard for authenticated-only pages. No pages use it yet, but it's
 * ready for a future /account, /dashboard, etc.
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/account" element={<AccountPage />} />
 *   </Route>
 */
export default function ProtectedRoute() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--navy)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        <i className="fas fa-spinner fa-spin" aria-hidden="true" />
      </div>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // A Registration Admin works the registration desk and nothing else. Checked once here, for
  // every signed-in page, rather than on each of the pages they must not see.
  const roles = user?.roles
  if (isRegistrationDeskOnly(roles) && !canAccessPath(location.pathname, roles)) {
    return <Navigate to={roleHome(roles)} replace />
  }

  return <Outlet />
}

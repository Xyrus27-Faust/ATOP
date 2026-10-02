import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Route guard for authenticated-only pages. No pages use it yet, but it's
 * ready for a future /account, /dashboard, etc.
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/account" element={<AccountPage />} />
 *   </Route>
 */
export default function ProtectedRoute() {
  const { status, reconnecting } = useAuth()
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
        <div style={{ textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          {reconnecting && (
            <p role="status" style={{ marginTop: 12, fontFamily: 'var(--font-body)', color: 'var(--gray-600)' }}>
              Can&rsquo;t reach the server. Still signed in &mdash; retrying&hellip;
            </p>
          )}
        </div>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

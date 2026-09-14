import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { isRegionalRep, isAdmin, roleHome } from '@/dashboard/dashboardNav'

/**
 * Guards the regional representative's pages. Mirrors the backend, which lets a
 * **RegionalRepresentative or Admin** through — admins can see any region's page
 * to help someone who is stuck.
 *
 * The role is only half the story: the backend also needs an appointment saying
 * which region. That second half is deliberately NOT checked here, because it
 * needs a request — the page asks, and renders the "no region yet" explanation
 * when the answer is no. Bouncing them from the route instead would leave a
 * freshly appointed representative staring at a dashboard with no clue why.
 *
 * Assumes it sits inside <ProtectedRoute>, so the user is already authenticated.
 */
export default function RegionalRepRoute() {
  const { user } = useAuth()
  const allowed = isRegionalRep(user?.roles) || isAdmin(user?.roles)
  if (!allowed) return <Navigate to={roleHome(user?.roles)} replace />
  return <Outlet />
}

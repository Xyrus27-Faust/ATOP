import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canManageCheckIn, roleHome } from '@/dashboard/dashboardNav'

/**
 * Guards the check-in back office — checkpoints, the desk list and staff. Mirrors the backend's
 * /admin/checkpoints and /desk policies, which let **Secretariat or Admin** in. A Registration
 * Admin works the bookings, not the venue, so they don't get here even though they pass
 * {@link RegistrationsAdminRoute}.
 *
 * The API enforces the same roles on every call; hiding the page only spares them a screen of
 * errors. Assumes it sits inside <ProtectedRoute>.
 */
export default function CheckInAdminRoute() {
  const { user } = useAuth()
  if (!canManageCheckIn(user?.roles)) return <Navigate to={roleHome(user?.roles)} replace />
  return <Outlet />
}

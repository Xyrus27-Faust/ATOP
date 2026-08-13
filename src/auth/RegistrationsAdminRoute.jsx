import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canManageRegistrations, roleHome } from '@/dashboard/dashboardNav'

/**
 * Guards the convention registration back office. Mirrors the backend, which lets
 * **Secretariat or Admin** work the registration list — working the list is
 * day-to-day secretariat work, unlike configuring the event itself. Assumes it
 * sits inside <ProtectedRoute>, so the user is already authenticated.
 */
export default function RegistrationsAdminRoute() {
  const { user } = useAuth()
  if (!canManageRegistrations(user?.roles)) return <Navigate to={roleHome(user?.roles)} replace />
  return <Outlet />
}

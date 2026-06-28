import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { isAdmin, roleHome } from '@/dashboard/dashboardNav'

/**
 * Guards Admin-only routes (e.g. reviewer ↔ category assignment). Non-admins are
 * sent to their own home. Assumes it sits inside <ProtectedRoute>, so the user is
 * already authenticated.
 */
export default function AdminRoute() {
  const { user } = useAuth()
  if (!isAdmin(user?.roles)) return <Navigate to={roleHome(user?.roles)} replace />
  return <Outlet />
}

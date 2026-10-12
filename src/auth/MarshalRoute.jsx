import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canScan, roleHome } from '@/dashboard/dashboardNav'

/**
 * Guards the badge scanner. Mirrors the backend's /marshal policy, which lets a **Marshal,
 * Secretariat or Admin** scan — the secretariat can cover a door without a second role.
 *
 * The guard is for the route only; the API enforces the same roles on every scan, so hiding the
 * page is a courtesy, not the protection. Assumes it sits inside <ProtectedRoute>.
 */
export default function MarshalRoute() {
  const { user } = useAuth()
  if (!canScan(user?.roles)) return <Navigate to={roleHome(user?.roles)} replace />
  return <Outlet />
}

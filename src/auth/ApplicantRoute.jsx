import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { isPureReviewer, roleHome } from '@/dashboard/dashboardNav'

/**
 * Guards applicant-only routes (the entry list and the submission editor). A
 * reviewer with no applicant role has no entries of their own, so we send them
 * to their home (the review queue) rather than letting them land on an empty
 * "My Entries" or a submission form they can't use. Catches both deep links and
 * a stale post-login `from`. Assumes it sits inside <ProtectedRoute>, so the
 * user is already authenticated.
 */
export default function ApplicantRoute() {
  const { user } = useAuth()
  if (isPureReviewer(user?.roles)) return <Navigate to={roleHome(user?.roles)} replace />
  return <Outlet />
}

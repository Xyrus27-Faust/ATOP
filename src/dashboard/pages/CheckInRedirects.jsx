import { Navigate, useParams, useSearchParams } from 'react-router-dom'

// Check-in's pages were merged into one (2026-10-06). Old bookmarks and shared links land on the
// same thing in its new place rather than on a 404.
const HOME = '/dashboard/admin/checkin'

/** /admin/checkpoints, which once also held the staff lists as ?tab=marshals|secretariat. */
export function OldCheckpoints() {
  const [params] = useSearchParams()
  const tab = params.get('tab')
  if (tab === 'marshals') return <Navigate to={`${HOME}?tab=staff`} replace />
  if (tab === 'secretariat') return <Navigate to={`${HOME}?tab=staff&who=secretariat`} replace />
  return <Navigate to={HOME} replace />
}

/** /admin/checkpoints/:id */
export function OldCheckpoint() {
  const { id } = useParams()
  return <Navigate to={`${HOME}/checkpoints/${id}`} replace />
}

/** /admin/checkin/staff, whose own ?tab=secretariat is now ?who=. */
export function OldStaff() {
  const [params] = useSearchParams()
  return <Navigate to={`${HOME}?tab=staff${params.get('tab') === 'secretariat' ? '&who=secretariat' : ''}`} replace />
}

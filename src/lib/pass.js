import { api } from './apiClient'

// The delegate's live pass (ATOP, 2026-10-11). Mirrors the backend's PassEndpoints: one anonymous read
// keyed by a signed link, and the booker's list of those links to share.

// No auth: the delegate has no account. The token in the link is the credential.
export const getPass = (token) => api.get(`/passes/${encodeURIComponent(token)}`)

// Owner-only: the booker's own delegates, in-person seats with a pass.
export const getPassLinks = (registrationId) =>
  api.get(`/registrations/${registrationId}/passes`, { auth: true })

// Built from this site's own origin, so a link copied on staging opens staging.
export const passUrl = (token) => `${window.location.origin}/pass/${token}`

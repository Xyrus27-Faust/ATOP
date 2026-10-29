import { api } from './apiClient'

// The public convention roster (ATOP, 2026-10-29): everyone who checked in with nothing owed. The
// QR on the Certificate of Appearance opens it. Names, LGU or organization, and region — nothing else.
export const getRoster = (slug) => api.get(`/events/${encodeURIComponent(slug)}/roster`)

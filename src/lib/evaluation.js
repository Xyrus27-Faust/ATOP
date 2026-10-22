import { api } from './apiClient'

// The post-convention evaluation form (ATOP, 2026-10-22). Mirrors the backend's EvaluationEndpoints:
// a delegate types the ID NO off their convention ID and an email on their record, then answers.
// No code is mailed: the pair is checked when the form opens and again at submit. Answers once.

// No auth on the public three: delegates have no accounts.
export const getEvaluationForm = (slug) => api.get(`/events/${encodeURIComponent(slug)}/evaluation`)

// Opens the form: checks the pair (and that they attended) without mailing anything.
export const checkEvaluationIdentity = (slug, { email, idNo }) =>
  api.post(`/events/${encodeURIComponent(slug)}/evaluation/check`, { email, idNo })

export const submitEvaluation = (slug, { email, idNo, answers }) =>
  api.post(`/events/${encodeURIComponent(slug)}/evaluation/responses`, { email, idNo, answers })

// Admin only: free-text answers name people and offices.
export const getEvaluationSummary = (eventId) => api.get(`/admin/events/${eventId}/evaluation/summary`, { auth: true })

export const getEvaluationResponses = (eventId) => api.get(`/admin/events/${eventId}/evaluation/responses`, { auth: true })

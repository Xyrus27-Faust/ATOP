import { api } from './apiClient'

// The post-convention evaluation form (ATOP, 2026-10-22). Mirrors the backend's EvaluationEndpoints:
// a delegate types the ID NO off their convention ID and an email on their record, answers, and
// proves the inbox with a mailed code only when they submit. Answers once.

// No auth on the public five: delegates have no accounts. The access token from verify is the key.
export const getEvaluationForm = (slug) => api.get(`/events/${encodeURIComponent(slug)}/evaluation`)

// Opens the form: checks the pair (and that they attended) without mailing anything.
export const checkEvaluationIdentity = (slug, { email, idNo }) =>
  api.post(`/events/${encodeURIComponent(slug)}/evaluation/check`, { email, idNo })

export const sendEvaluationCode = (slug, { email, idNo }) =>
  api.post(`/events/${encodeURIComponent(slug)}/evaluation/code`, { email, idNo })

export const verifyEvaluationCode = (slug, { email, idNo, code }) =>
  api.post(`/events/${encodeURIComponent(slug)}/evaluation/verify`, { email, idNo, code })

export const submitEvaluation = (slug, { accessToken, answers }) =>
  api.post(`/events/${encodeURIComponent(slug)}/evaluation/responses`, { accessToken, answers })

// Admin only: free-text answers name people and offices.
export const getEvaluationSummary = (eventId) => api.get(`/admin/events/${eventId}/evaluation/summary`, { auth: true })

export const getEvaluationResponses = (eventId) => api.get(`/admin/events/${eventId}/evaluation/responses`, { auth: true })

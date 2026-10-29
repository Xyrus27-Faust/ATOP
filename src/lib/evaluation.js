import { api, apiUrl } from './apiClient'

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

// The respondent's Certificate of Appearance (ATOP, 2026-10-29): the response id is the key, so a
// plain link — the API answers with the PDF as a download.
export const evaluationCertificateUrl = (slug, responseId) =>
  apiUrl(`/events/${encodeURIComponent(slug)}/evaluation/responses/${responseId}/certificate`)

// Admin only: free-text answers name people and offices.
export const getEvaluationSummary = (eventId) => api.get(`/admin/events/${eventId}/evaluation/summary`, { auth: true })

export const getEvaluationResponses = (eventId) => api.get(`/admin/events/${eventId}/evaluation/responses`, { auth: true })

// Certificates for responses that haven't had one, at most `take` a call (the ingress cuts at 60 s):
// call again until `remaining` is 0. A dry run unless `send`.
export const sendEvaluationCertificates = (eventId, { send = false, take = 40 } = {}) =>
  api.post(`/admin/events/${eventId}/evaluation/send-certificates?send=${send}&take=${take}`, undefined, {
    auth: true,
    timeoutMs: 90_000,
  })

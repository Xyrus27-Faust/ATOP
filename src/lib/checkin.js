import { api } from './apiClient'

// Convention check-in: the marshal's scanner and the secretariat's checkpoint set-up. Mirrors the
// backend's CheckInEndpoints. A checkpoint is one door or one meal on one day — every scan is made
// against one, which is how the same QR can let someone in, then feed them lunch, then dinner.

// ---- Marshal ---------------------------------------------------------------

export const listMarshalCheckpoints = () => api.get('/marshal/checkpoints', { auth: true })

// A refusal is an answer, not an error: the API returns 200 with result 'denied' and a reason, so
// only a genuine failure (network, 404 on a deleted checkpoint) reaches a catch.
export const scanCode = (checkpointId, code) =>
  api.post(`/marshal/checkpoints/${checkpointId}/scan`, { code }, { auth: true })

export const searchDelegates = (checkpointId, q) =>
  api.get(`/marshal/checkpoints/${checkpointId}/delegates?q=${encodeURIComponent(q)}`, { auth: true })

export const getDelegate = (checkpointId, delegateId) =>
  api.get(`/marshal/checkpoints/${checkpointId}/delegates/${delegateId}`, { auth: true })

export const logManually = (checkpointId, delegateId, note) =>
  api.post(`/marshal/checkpoints/${checkpointId}/manual`, { delegateId, note: note || null }, { auth: true })

// Matches the API: fewer characters than this is refused as too broad to show a guard.
export const SEARCH_MIN_CHARS = 3

// The refusals that mean the phone's checkpoint itself is no good now — the secretariat closed it,
// or the day turned over. The scan, the name search and the photo all answer with these, and each
// one sends the guard back to the picker rather than refusing badge after badge.
const POST_GONE = new Set(['checkpoint_inactive', 'not_today'])
export const isPostGone = (reasonCode) => POST_GONE.has(reasonCode)

// The guard's phone remembers where they are posted, so a locked screen or a closed tab resumes the
// shift instead of asking again. Per device, which is right: it's the phone at the lunch line — and
// forgotten on sign-out, so the next guard handed the phone doesn't start on someone else's post.
const POST_KEY = 'atop.scan.checkpoint'

export function readPost() {
  try { return localStorage.getItem(POST_KEY) } catch { return null }
}
export function writePost(id) {
  try {
    if (id) localStorage.setItem(POST_KEY, id)
    else localStorage.removeItem(POST_KEY)
  } catch { /* private mode: the guard just picks again next time */ }
}
export const forgetPost = () => writePost(null)

// What a delegate's QR holds: their reference code, e.g. "DLG26-07DB6" (DelegateFactory on the API).
// Anything else the camera reads — a restaurant menu, a Wi-Fi sticker — is not sent to the server.
const BADGE_CODE = /^DLG\d{2}-[0-9A-Z]{5}$/
export const isBadgeCode = (text) => BADGE_CODE.test(text.trim().toUpperCase())

// ---- Booker ----------------------------------------------------------------

// Their own delegates' scans: times only — no marshal names, no voided scans.
export const getRegistrationAttendance = (registrationId) =>
  api.get(`/registrations/${registrationId}/attendance`, { auth: true })

// ---- Secretariat -----------------------------------------------------------

export const listCheckpoints = (eventId) => api.get(`/admin/events/${eventId}/checkpoints`, { auth: true })

export const createCheckpoint = (eventId, body) =>
  api.post(`/admin/events/${eventId}/checkpoints`, body, { auth: true })

export const updateCheckpoint = (id, body) => api.put(`/admin/checkpoints/${id}`, body, { auth: true })

export const getCheckpointScans = (id) => api.get(`/admin/checkpoints/${id}/scans`, { auth: true })

export const voidScan = (scanId, reason) => api.post(`/admin/scans/${scanId}/void`, { reason }, { auth: true })

// One tap for the usual names. Anything else — merienda, a sponsor's cocktails — is typed as usual.
export const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner']

// Matches the API's column widths, so a long value stops at the input rather than bouncing as a 400.
export const LABEL_MAX = 80
export const NOTE_MAX = 200
export const REASON_MAX = 200

// ---- Marshals (admin) ------------------------------------------------------

// Admin-only on the API. Guards don't request the role; an admin credits an existing account with it.
export const listMarshals = () => api.get('/admin/users?role=Marshal', { auth: true })
export const searchUsers = (q) => api.get(`/admin/users?q=${encodeURIComponent(q)}`, { auth: true })
export const grantMarshal = (userId) => api.post(`/admin/users/${userId}/roles`, { role: 'Marshal' }, { auth: true })
export const revokeMarshal = (userId) => api.delete(`/admin/users/${userId}/roles/Marshal`, { auth: true })

// ---- Vocabulary ------------------------------------------------------------

export const CHECKPOINT_KIND = {
  Entry: { label: 'Entry', icon: 'fa-door-open', blurb: 'The door. Someone coming back in the same day is welcomed back, not refused.' },
  Meal: { label: 'Meal', icon: 'fa-utensils', blurb: 'One plate per delegate. A second scan of the same badge is refused.' },
}

export const kindMeta = (kind) => CHECKPOINT_KIND[kind] || { label: kind, icon: 'fa-location-dot', blurb: '' }

// The API works the state out against the venue's day (which turns over at 4am), so a laptop on the
// wrong clock can't call yesterday's lunch open. Only Closed and Open have a button behind them:
// reopening an ended day wouldn't make it scannable.
export const CHECKPOINT_STATE = {
  Open: { label: 'Open', detail: 'Open — marshals can scan', tone: 'tone-success', canToggle: true },
  Closed: { label: 'Closed', detail: 'Closed — hidden from marshals', tone: 'tone-neutral', canToggle: true },
  Upcoming: { label: 'Upcoming', detail: 'Upcoming — marshals see it on the day', tone: 'tone-info', canToggle: true },
  Ended: { label: 'Ended', detail: 'Ended — its day is over', tone: 'tone-neutral', canToggle: false },
}

export const stateMeta = (state) => CHECKPOINT_STATE[state] || CHECKPOINT_STATE.Closed

/**
 * How far a checkpoint has got, as a whole percent for the progress bar. Capped at 100: a walk-in who
 * paid after the list loaded can push the count past the headcount, and a bar can't run off the card.
 */
export function progressPct(scanCount, expected) {
  return expected > 0 ? Math.min(100, Math.round((scanCount / expected) * 100)) : 0
}

// What the guard sees at the top of the result sheet. Colour carries the verdict; the words say it
// again for anyone who can't tell green from amber in the sun.
export const RESULT = {
  ok: { tone: 'ok', icon: 'fa-circle-check', entry: 'Checked in', meal: 'Meal claimed' },
  warn: { tone: 'warn', icon: 'fa-triangle-exclamation', entry: 'Let in — balance due', meal: 'Meal claimed — balance due' },
  denied: { tone: 'bad', icon: 'fa-circle-xmark', entry: 'Not let in', meal: 'Not served' },
}

// A shorter headline for the refusals a guard meets most, so the big line says what happened.
const DENIED_HEADLINE = {
  already_scanned: { entry: 'Already entered', meal: 'Already claimed' },
  unknown_code: { entry: 'Code not recognised', meal: 'Code not recognised' },
  cancelled: { entry: 'Cancelled', meal: 'Cancelled' },
  online: { entry: 'Online attendee', meal: 'Online attendee' },
  no_pass: { entry: 'No pass yet', meal: 'No pass yet' },
  checkpoint_inactive: { entry: 'Checkpoint closed', meal: 'Checkpoint closed' },
  not_today: { entry: 'Not today’s checkpoint', meal: 'Not today’s checkpoint' },
  no_show: { entry: 'Marked no-show', meal: 'Marked no-show' },
  confirm_required: { entry: 'Check the face first', meal: 'Check the face first' },
}

export function resultHeadline(response, kind) {
  const which = kind === 'Meal' ? 'meal' : 'entry'
  if (response.reasonCode === 'reentry') return 'Welcome back'
  if (response.result === 'denied') return DENIED_HEADLINE[response.reasonCode]?.[which] || RESULT.denied[which]
  return (RESULT[response.result] || RESULT.denied)[which]
}

// ---- Dates -----------------------------------------------------------------

// A checkpoint's day is a calendar date ("2026-11-18"), not an instant: parse it as UTC and format
// it as UTC, or a browser west of Greenwich would show the day before.
function dayDate(day) {
  return new Date(`${day}T00:00:00Z`)
}

/** "WED · NOV 18" — the day header in the marshal's picker. */
export function formatDayHeader(day) {
  const d = dayDate(day)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${weekday} · ${date}`.toUpperCase()
}

/** "Wed, 18 Nov" — a day inline in a sentence or a card. */
export function formatDay(day) {
  return dayDate(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/**
 * "12:14" in Manila, whatever zone the phone is set to — the guard and the secretariat are both
 * reading venue time, and a phone left on another zone after travel shouldn't disagree with the wall clock.
 */
export function formatVenueTime(instant) {
  if (!instant) return ''
  return new Date(instant).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
}

/**
 * The convention's days as "YYYY-MM-DD", read at the venue (Manila) — the same reading the API uses
 * to accept a checkpoint's day, so the picker can't offer a day the server would refuse.
 */
export function eventDays(startsAt, endsAt) {
  const venueDate = (instant) => new Date(instant).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const first = venueDate(startsAt)
  const last = venueDate(endsAt || startsAt)
  const days = []
  for (let d = dayDate(first); days.length < 31; d = new Date(d.getTime() + 86_400_000)) {
    const iso = d.toISOString().slice(0, 10)
    days.push(iso)
    if (iso >= last) break
  }
  return days
}

/** Checkpoints grouped by day, in day then sort order: [{ day, items }]. */
export function groupByDay(checkpoints = []) {
  const sorted = [...checkpoints].sort((a, b) =>
    a.day === b.day ? a.sortOrder - b.sortOrder || a.label.localeCompare(b.label) : a.day.localeCompare(b.day))
  const groups = []
  for (const c of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.day === c.day) last.items.push(c)
    else groups.push({ day: c.day, items: [c] })
  }
  return groups
}

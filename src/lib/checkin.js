import { api } from './apiClient'

// Convention check-in: the main gate, the Secretariat desk, the marshal's scanner and the
// secretariat's checkpoint set-up. Mirrors the backend's GateEndpoints, DeskEndpoints and
// CheckInEndpoints. Everyone passes the main gate first, which checks them in and sends them to Desk A
// or Desk B; after that a checkpoint is one session, one meal or one tour bus on one day — every scan
// is made against one, which is how the same QR can let someone in, then feed them lunch, then board a bus.

// ---- Marshal ---------------------------------------------------------------

export const listMarshalCheckpoints = () => api.get('/marshal/checkpoints', { auth: true })

// A refusal is an answer, not an error: the API returns 200 with result 'denied' and a reason, so
// only a genuine failure (network, 404 on a deleted checkpoint) reaches a catch.
export const scanCode = (checkpointId, code) =>
  api.post(`/marshal/checkpoints/${checkpointId}/scan`, { code: badgeCode(code) }, { auth: true })

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

// Why the camera won't open, in words for whoever is holding the phone. Every case falls back to
// a search by name, which needs no camera.
export const CAMERA_TROUBLE = {
  denied: {
    title: 'Camera blocked',
    body: 'Allow the camera for this site in your browser settings, then try again. You can keep working by name meanwhile.',
  },
  'no-camera': {
    title: 'No camera found',
    body: 'This device has no camera the browser can use. Search by name instead.',
  },
  insecure: {
    title: 'Camera unavailable here',
    body: 'Browsers only open the camera on a secure (https) page. Search by name instead.',
  },
}

// The guard's phone remembers where they are posted, so a locked screen or a closed tab resumes the
// shift instead of asking again. Per device, which is right: it's the phone at the lunch line — and
// forgotten on sign-out, so the next guard handed the phone doesn't start on someone else's post.
const POST_KEY = 'atop.scan.checkpoint'

// The main gate and the Secretariat desk are posts on the scanner like any checkpoint, but have no
// checkpoint id: these stand in for one in the remembered post. Never a Guid, so they can't collide.
export const GATE_POST = 'gate'
export const DESK_POST = 'desk'

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
// Every scan call sends it through badgeCode(), so no screen can forget: a camera read can carry
// stray spaces, and a code typed off a printed badge can come in lowercase.
const BADGE_CODE = /^DLG\d{2}-[0-9A-Z]{5}$/
const badgeCode = (text) => text.trim().toUpperCase()
export const isBadgeCode = (text) => BADGE_CODE.test(badgeCode(text))

// ---- Booker ----------------------------------------------------------------

// Their own delegates' scans: times only — no marshal names, no voided scans.
export const getRegistrationAttendance = (registrationId) =>
  api.get(`/registrations/${registrationId}/attendance`, { auth: true })

// ---- Secretariat -----------------------------------------------------------

export const listCheckpoints = (eventId) => api.get(`/admin/events/${eventId}/checkpoints`, { auth: true })

export const createCheckpoint = (eventId, body) =>
  api.post(`/admin/events/${eventId}/checkpoints`, body, { auth: true })

export const updateCheckpoint = (id, body) => api.put(`/admin/checkpoints/${id}`, body, { auth: true })
// Only while nobody has been scanned there; after that the API answers 409 and Close is the way out.
export const deleteCheckpoint = (id) => api.delete(`/admin/checkpoints/${id}`, { auth: true })

export const getCheckpointScans = (id) => api.get(`/admin/checkpoints/${id}/scans`, { auth: true })
// Who this checkpoint is still waiting for: everyone it expects, less those scanned here.
export const getCheckpointNotYet = (id) => api.get(`/admin/checkpoints/${id}/not-yet`, { auth: true })

export const voidScan = (scanId, reason) => api.post(`/admin/scans/${scanId}/void`, { reason }, { auth: true })

// The tour batches a bus checkpoint can board. Public on the API (the posters are), so no auth.
export const listTourPackages = (slug) => api.get(`/events/${slug}/tours`)

// One tap for the usual names. Anything else — merienda, a sponsor's cocktails — is typed as usual.
export const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner']

// Matches the API's column widths, so a long value stops at the input rather than bouncing as a 400.
export const LABEL_MAX = 80
export const NOTE_MAX = 200
export const REASON_MAX = 200

// ---- Main gate -------------------------------------------------------------

// Checks the delegate in (once — the same badge comes through every morning) and says which desk to
// go to: lane 'A', 'B', or 'Done' (go straight in). Never an amount: marshals work the gate. Someone
// with no seat is a 200 with result 'denied', named, and sent to Desk B.
export const gateScan = (eventId, code) =>
  api.post(`/gate/events/${eventId}/scan`, { code: badgeCode(code) }, { auth: true })

// Seat or no seat, so someone who never paid is found and told where to go. No photos in the list.
export const gateSearch = (eventId, q) =>
  api.get(`/gate/events/${eventId}/delegates?q=${encodeURIComponent(q)}`, { auth: true })

// The confirm tap on a name from the search: the same check-in a scan does.
export const gateCheckIn = (eventId, delegateId) =>
  api.post(`/gate/events/${eventId}/delegates/${delegateId}/check-in`, null, { auth: true })

// What each lane tells whoever is at the gate. Tone is the sheet's colour.
export const GATE_LANE = {
  A: { tone: 'ok', icon: 'fa-circle-check', headline: 'Desk A', line: 'Paid in full. Send them to Desk A for their ID & receipt and kit.' },
  B: { tone: 'warn', icon: 'fa-circle-exclamation', headline: 'Desk B', line: 'Send them to Desk B.' },
  Done: { tone: 'ok', icon: 'fa-circle-check', headline: 'Go in', line: 'ID and kit already collected. Let them in.' },
}

// ---- Secretariat desk ------------------------------------------------------

// A scan returns the delegate's card, checking them in if the gate didn't (once — four desk phones may
// read the same badge). Like a marshal's scan, a refusal is a 200 with result 'denied', not an error,
// and carries the booking behind the seat. Scans are per event: last year's pass reads as unknown.
export const deskScan = (eventId, code) =>
  api.post(`/desk/events/${eventId}/scan`, { code: badgeCode(code) }, { auth: true })

export const deskSearch = (eventId, q) =>
  api.get(`/desk/events/${eventId}/delegates?q=${encodeURIComponent(q)}`, { auth: true })

// Read-only: the card behind a name-search row, before the Confirm tap checks them in. Someone the
// desk would turn away answers 409 with a reasonCode and the booking. Like every call on one delegate,
// it names the event: an id from another event's card answers 404.
export const deskCard = (eventId, delegateId) =>
  api.get(`/desk/events/${eventId}/delegates/${delegateId}`, { auth: true })
// Every pass holder and how far each has got at the desk.
export const deskRoster = (eventId) => api.get(`/desk/events/${eventId}/roster`, { auth: true })

// A checkpoint on a delegate's trail (the desk card), as the API names its standing there.
export const TRAIL_STATUS = {
  Scanned: { label: 'Scanned', icon: 'fa-circle-check', tone: 'is-scanned' },
  Missed: { label: 'Missed', icon: 'fa-circle-xmark', tone: 'is-missed' },
  NotYet: { label: 'Not yet', icon: 'fa-circle-dot', tone: 'is-notyet' },
  Upcoming: { label: 'Upcoming', icon: 'fa-circle', tone: 'is-upcoming' },
}

const DESK_ACTION = { CheckIn: 'check-in', Payment: 'mark-paid', Id: 'release-id', Kit: 'release-kit' }

/**
 * Do the card's next step. Every step answers with the updated card, or 409 with a reasonCode.
 * Cash carries the balance the cashier was shown: if the seat owes anything else by now (an online
 * payment landed meanwhile) the API records nothing and answers 'balance_changed'.
 */
export const deskStep = (card, step) =>
  api.post(`/desk/events/${card.eventId}/delegates/${card.id}/${DESK_ACTION[step]}`,
    step === 'Payment' ? { amount: card.balance } : {}, { auth: true })

/**
 * Take back one step, with a reason. The API refuses one that something later still stands on: the
 * cash while the ID or kit is out, the check-in while anything is.
 */
export const deskUndo = (card, step, reason) =>
  api.post(`/desk/events/${card.eventId}/delegates/${card.id}/undo`, { step, reason }, { auth: true })

// Check-in, then cash for anyone who owes; then the ID & receipt and the kit, in either order, once
// nothing is owed. The card's field for each, and what the button and the log call it.
export const DESK_STEPS = [
  { step: 'CheckIn', field: 'checkIn', label: 'Checked in', action: 'Check in', undo: 'check-in' },
  { step: 'Payment', field: 'payment', label: 'Balance paid at the desk', action: 'Mark paid', undo: 'payment' },
  { step: 'Id', field: 'idRelease', label: 'ID & receipt', action: 'Release', undo: 'ID & receipt release' },
  { step: 'Kit', field: 'kit', label: 'Kit', action: 'Release', undo: 'kit release' },
]

/**
 * Whether a done step can be taken back now — the API's rule, so the card only offers what it would
 * accept: the ID and kit any time, the cash once neither is out, the check-in once nothing else is.
 * (A check-in someone was already scanned in on is still refused by the API.)
 */
export function canUndoDeskStep(card, step) {
  if (step === 'Id' || step === 'Kit') return true
  if (step === 'Payment') return !card.idRelease && !card.kit
  return !card.payment && !card.idRelease && !card.kit
}

// What the desk says when it turns someone away. The API's sentence follows underneath.
export const DESK_REFUSAL = {
  unknown_code: 'Code not recognised',
  cancelled: 'Cancelled',
  no_show: 'Marked no-show',
  online: 'Online attendee',
  no_pass: 'No seat',
}

// ---- Convention staff (admin) ----------------------------------------------

// Admin-only on the API. Nobody requests these roles; an admin credits an existing account with
// Marshal (the scanner) or Secretariat (the desk and the registration list) from the Check-in page.
export const listStaff = (role) => api.get(`/admin/users?role=${encodeURIComponent(role)}`, { auth: true })
export const searchUsers = (q) => api.get(`/admin/users?q=${encodeURIComponent(q)}`, { auth: true })
export const grantStaffRole = (userId, role) => api.post(`/admin/users/${userId}/roles`, { role }, { auth: true })
export const revokeStaffRole = (userId, role) =>
  api.delete(`/admin/users/${userId}/roles/${encodeURIComponent(role)}`, { auth: true })

// ---- Vocabulary ------------------------------------------------------------

export const CHECKPOINT_KIND = {
  Entry: { label: 'Session', icon: 'fa-door-open', blurb: 'A door or a session — e.g. “Oct 21 AM” or “Pearl Awards”. Someone coming back in is welcomed back, not refused.' },
  Meal: { label: 'Meal', icon: 'fa-utensils', blurb: 'One plate per delegate. A second scan of the same badge is refused.' },
  Tour: { label: 'Tour', icon: 'fa-bus', blurb: 'One bus — a tour batch. Only the delegates booked on it board; anyone else is told which bus is theirs.' },
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

/** What a scan at this kind of checkpoint counts as: "12 of 300 entered / claimed / boarded". */
export const tallyVerb = (kind) => ({ Meal: 'claimed', Tour: 'boarded' }[kind] || 'entered')

// What the guard sees at the top of the result sheet. Colour carries the verdict; the words say it
// again for anyone who can't tell green from red in the sun. Only a seat paid in full gets through a
// checkpoint, so there is no in-between: a balance is a refusal that sends them to Desk B.
export const RESULT = {
  ok: { tone: 'ok', icon: 'fa-circle-check', entry: 'Let in', meal: 'Meal claimed', tour: 'Boarded' },
  denied: { tone: 'bad', icon: 'fa-circle-xmark', entry: 'Not let in', meal: 'Not served', tour: 'Not boarded' },
}

// A shorter headline for the refusals a guard meets most, so the big line says what happened. A
// plain string reads the same at every kind of checkpoint.
const DENIED_HEADLINE = {
  already_scanned: { entry: 'Already entered', meal: 'Already claimed', tour: 'Already boarded' },
  unknown_code: 'Code not recognised',
  cancelled: 'Cancelled',
  online: 'Online attendee',
  no_pass: 'No seat',
  balance_due: 'Balance not paid',
  not_checked_in: 'Main gate first',
  no_tour: 'Not on a tour',
  wrong_tour: 'Wrong bus',
  checkpoint_inactive: 'Checkpoint closed',
  not_today: 'Not today’s checkpoint',
  no_show: 'Marked no-show',
  confirm_required: 'Check the face first',
}

export function resultHeadline(response, kind) {
  const which = kind === 'Meal' ? 'meal' : kind === 'Tour' ? 'tour' : 'entry'
  if (response.reasonCode === 'reentry') return 'Welcome back'
  if (response.result === 'denied') {
    const line = DENIED_HEADLINE[response.reasonCode]
    return (typeof line === 'string' ? line : line?.[which]) || RESULT.denied[which]
  }
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

// The scanning day turns over at 4 AM Manila, not midnight — the API's CheckInDesk.DayTurnsOverAt.
const DAY_TURNS_OVER_MS = 4 * 3_600_000

/**
 * Today as the scanner reads it, "YYYY-MM-DD" in Manila: the earliest day a checkpoint can be set
 * on, since the API refuses a past one.
 */
export function scanningToday(now = Date.now()) {
  return new Date(now - DAY_TURNS_OVER_MS).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

/**
 * The convention's days as "YYYY-MM-DD", read at the venue (Manila). Offered as quick picks for a
 * checkpoint's day; any later day is allowed too.
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

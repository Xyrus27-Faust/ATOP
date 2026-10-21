import { api } from './apiClient'
import { formatPeso } from './events'

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

// At a bus a scan only shows where their booking stands ({@code boarding}); this tap boards them.
// {@code from} is the bus they were booked on when the marshal saw the sheet (null for none): if the
// booking changed since, the API boards nobody and says scan again. Boarding someone booked elsewhere
// moves their booking here and frees their old seat; a full bus still boards, and the log says so.
// One of {@code code} (scanned) or {@code delegateId} (found by name, face already checked).
export const boardDelegate = (checkpointId, { code, delegateId, from, note }) =>
  api.post(`/marshal/checkpoints/${checkpointId}/board`,
    { code: code ? badgeCode(code) : null, delegateId: delegateId || null, from: from || null, note: note || null },
    { auth: true })

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

// The tour scanner: who a badge is and their tour, then book or move them onto a batch.
export const lookupTour = (code) =>
  api.post('/marshal/tours/lookup', { code: badgeCode(code) }, { auth: true })

export const bookTour = (code, batchId) =>
  api.post('/marshal/tours/book', { code: badgeCode(code), batchId }, { auth: true })

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

// For someone who was there but never scanned (the gate was swamped, the phone died): adds them to
// this checkpoint's list as "Marked by staff", with the reason on record. Only someone checked in at
// the desk, and never on a day still to come; the API refuses anything else with a reasonCode.
export const markAttended = (checkpointId, delegateId, reason) =>
  api.post(`/admin/checkpoints/${checkpointId}/attend`, { delegateId, reason }, { auth: true })

// How each way of landing on a list is labelled in the scan log; a scan by camera needs no chip.
export const SCAN_METHOD = {
  Manual: { label: 'Manual', tone: 'tone-warn', print: ' (manual)' },
  Marked: { label: 'Marked by staff', tone: 'tone-info', print: ' (marked by staff)' },
}

// The tour batches a bus checkpoint can board. Public on the API (the posters are), so no auth.
export const listTourPackages = (slug) => api.get(`/events/${slug}/tours`)

// One tap for the usual names. Anything else — merienda, a sponsor's cocktails — is typed as usual.
export const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner']

// Matches the API's column widths, so a long value stops at the input rather than bouncing as a 400.
export const LABEL_MAX = 80
export const NOTE_MAX = 200
export const REASON_MAX = 200

// ---- Main gate -------------------------------------------------------------

// Shows who it is and which desk they go to: lane 'A', 'B', or 'Done' (go straight in), with what they
// still owe. Someone not yet checked in comes back 'pending' — nothing written until the marshal checks
// the face and taps Check in (gateCheckIn). Someone already in, with a session open they're not counted
// at yet, comes back 'pending' too, reason 'count_in': the same tap counts them there (ATOP, 2026-10-17),
// and the sheet reads "Check in for today", never "already checked in" — that read as done (2026-10-19).
// Anyone else already in answers 'ok' at once and writes nothing. Someone with no seat is a 200 with
// result 'denied', named, and sent to Desk B — and counted nowhere.
export const gateScan = (eventId, code) =>
  api.post(`/gate/events/${eventId}/scan`, { code: badgeCode(code) }, { auth: true })

// Seat or no seat, so someone who never paid is found and told where to go. No photos in the list.
export const gateSearch = (eventId, q) =>
  api.get(`/gate/events/${eventId}/delegates?q=${encodeURIComponent(q)}`, { auth: true })

// The Check in tap, after a scan or on a name from the search. {@code code} is the badge scanned, so the
// session's log records a scan; without it (found by name) it records a manual find.
export const gateCheckIn = (eventId, delegateId, code) =>
  api.post(`/gate/events/${eventId}/delegates/${delegateId}/check-in`, { code: code ? badgeCode(code) : null }, { auth: true })

// The session open right now — the one every gate and desk check-in is counted at — or null when
// none is (the API answers 204). Today's only; the admin opens and closes it on the Check-in page.
export const getLiveSession = (eventId) => api.get(`/gate/events/${eventId}/session`, { auth: true })

// How often the gate and desk ask again, so a session the admin opens or closes reaches every phone.
export const SESSION_POLL_MS = 60_000

/**
 * The line a check-in result shows about the session: counted now, already on its list (a second
 * pass, or the desk after the gate), or nothing when no session is open.
 */
export function sessionLine(session) {
  if (!session) return null
  return session.counted ? `Counted for ${session.label}` : `Welcome back · already counted for ${session.label}`
}

/**
 * The line above a desk card, from a scan or a Check in tap: whether this checked them in, someone
 * already had (and who), or nobody has yet — the card's own button and face check say what to do.
 * Already in but not yet counted at the open session ('count_in') gets no line: the card's Check in
 * prompt says when they arrived and which session is today, and "already checked in" read as done.
 */
export function arrivalNote(r) {
  if (r.justCheckedIn) return 'Checked in just now.'
  if (r.reasonCode === 'count_in') return null
  if (r.result === 'pending') return 'Not checked in yet.'
  const at = r.card?.checkIn
  return at ? `Already checked in at ${formatVenueTime(at.at)} by ${at.by}.` : null
}

/** "On board 12 · Booked 38/40" — the bus as the marshal needs it at the door. */
export const busLine = (b) => `On board ${b.onBoard} · Booked ${b.reserved}/${b.capacity}`

/** Null unless boarding them would put the bus over: then "Full 40/40 — this makes 41". */
export const overCapacityLine = (b) =>
  b.overCapacity ? `Full ${b.reserved}/${b.capacity} — this makes ${b.reserved + 1}` : null

/**
 * What a delegate still owes, as the scanner says it: { tone, text }. Null for someone with no seat
 * to pay for (cancelled, substituted) — the API sends none.
 */
export function paymentLine(payment) {
  if (!payment) return null
  if (payment.status === 'paid') return { tone: 'ok', text: 'Paid in full' }
  if (payment.status === 'partial') return { tone: 'warn', text: `Balance ${formatPeso(payment.balance)}` }
  return { tone: 'bad', text: `Not paid · ${formatPeso(payment.balance)}` }
}

// What each lane tells whoever is at the gate. Tone is the sheet's colour.
export const GATE_LANE = {
  A: { tone: 'ok', icon: 'fa-circle-check', headline: 'Desk A', line: 'Send them to Desk A for their ID & OR.' },
  B: { tone: 'warn', icon: 'fa-circle-exclamation', headline: 'Desk B', line: 'Send them to Desk B to pay the balance and get their ID & OR.' },
  C: { tone: 'ok', icon: 'fa-circle-check', headline: 'Desk C', line: 'ID & OR collected. Send them to Desk C for their kit.' },
  Done: { tone: 'ok', icon: 'fa-circle-check', headline: 'Go in', line: 'ID and kit already collected. Let them in.' },
}

// Lane B also holds someone who already paid the cashier and has yet to collect: their ID & OR wait
// at Desk B, not A. Nothing is owed, so the sheet goes green — still Desk B.
const GATE_LANE_B_PAID = {
  tone: 'ok', icon: 'fa-circle-check', headline: 'Desk B', line: 'Already paid. Send them to Desk B for their ID & OR.',
}

// How far through the gate → ID & OR → kit someone is, read off the lane: a lane exists only once
// they're checked in, C means the ID & OR is out, Done means the kit is too.
export function gateSteps(lane) {
  return [
    { label: 'Checked in', done: true },
    { label: 'ID & OR', done: lane === 'C' || lane === 'Done' },
    { label: 'Kit', done: lane === 'Done' },
  ]
}

export function gateLane(response) {
  if (response.lane === 'B' && response.delegate?.payment?.status === 'paid') return GATE_LANE_B_PAID
  return GATE_LANE[response.lane]
}

// ---- Secretariat desk ------------------------------------------------------

// A scan returns the delegate's card. Someone the gate didn't check in comes back 'pending' with the
// card, and the card's Check in tap does it (deskStep, with the code scanned). Like a marshal's scan, a refusal is a 200 with result 'denied', not an error,
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
// Desk C fills in a shirt size nobody gave; it answers with the card. Fill-only: a size already
// given answers 409 'shirt_size_set' — changing one is an Admin's, on the booking page.
export const deskShirtSize = (card, shirtSize) =>
  api.put(`/desk/events/${card.eventId}/delegates/${card.id}/shirt-size`, { shirtSize }, { auth: true })
// Every pass holder and how far each has got at the desk.
export const deskRoster = (eventId) => api.get(`/desk/events/${eventId}/roster`, { auth: true })

// Admin only: one scanning day's timeline of everything staff did at check-in. No day means today.
export const checkInActivity = (eventId, day) =>
  api.get(`/admin/events/${eventId}/activity${day ? `?day=${day}` : ''}`, { auth: true })

// A checkpoint on a delegate's trail (the desk card), as the API names its standing there.
export const TRAIL_STATUS = {
  Scanned: { label: 'Scanned', icon: 'fa-circle-check', tone: 'is-scanned' },
  Missed: { label: 'Missed', icon: 'fa-circle-xmark', tone: 'is-missed' },
  NotYet: { label: 'Not yet', icon: 'fa-circle-dot', tone: 'is-notyet' },
  Upcoming: { label: 'Upcoming', icon: 'fa-circle', tone: 'is-upcoming' },
}

const DESK_ACTION = { CheckIn: 'check-in', Id: 'release-id', Kit: 'release-kit' }

/**
 * Do the card's next step. Every step answers with the updated card, or 409 with a reasonCode.
 * At Desk B, releasing the ID & OR is the payment: it carries the balance the cashier was shown and
 * took. If the seat owes anything else by now (an online payment landed meanwhile) the API records
 * nothing and answers 'balance_changed'.
 */
export const deskStep = (card, step, code) =>
  api.post(`/desk/events/${card.eventId}/delegates/${card.id}/${DESK_ACTION[step]}`,
    step === 'Id' && card.balance > 0 ? { amount: card.balance }
      : step === 'CheckIn' && code ? { code: badgeCode(code) } : {}, { auth: true })

/**
 * Take back one step, with a reason. The API refuses one that something later still stands on: the
 * ID & OR while the kit is out, the check-in while anything is. Taking back the ID & OR also takes
 * back the cash recorded with it.
 */
export const deskUndo = (card, step, reason) =>
  api.post(`/desk/events/${card.eventId}/delegates/${card.id}/undo`, { step, reason }, { auth: true })

// Check-in; then the ID & OR at Desk A or B (at B, handing them over records the balance as paid);
// then the kit at Desk C. The payment row has no button of its own: it comes with the ID & OR.
// The card's field for each, and what the button and the log call it.
export const DESK_STEPS = [
  { step: 'CheckIn', field: 'checkIn', label: 'Checked in', action: 'Check in', undo: 'check-in' },
  { step: 'Payment', field: 'payment', label: 'Balance paid at the desk', action: null, undo: 'payment' },
  { step: 'Id', field: 'idRelease', label: 'ID & OR', action: 'Release', undo: 'ID & OR release' },
  { step: 'Kit', field: 'kit', label: 'Kit', action: 'Release', undo: 'kit release' },
]

/**
 * Whether a done step can be taken back now — the API's rule, so the card only offers what it would
 * accept: the kit any time, the ID & OR once the kit is back (its cash goes with it), the check-in
 * once nothing else is. The cash alone is never offered: it only comes back with the ID & OR.
 * (A check-in someone was already scanned in on is still refused by the API.)
 */
export function canUndoDeskStep(card, step) {
  if (step === 'Kit') return true
  if (step === 'Id') return !card.kit
  if (step === 'Payment') return false
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
  Entry: { label: 'Session', icon: 'fa-door-open', blurb: 'A programme session — e.g. “Opening Ceremony”. One is open at a time: opening it closes the day’s other session, and every check-in at the gate or desk while it’s open counts for it.' },
  Meal: { label: 'Meal', icon: 'fa-utensils', blurb: 'One plate per delegate. A second scan of the same badge is refused.' },
  Tour: { label: 'Tour', icon: 'fa-bus', blurb: 'One bus — a tour batch. A scan shows their booking; the marshal taps Board. Someone booked elsewhere or on no tour can board here instead, which moves their booking. One tour per person a day.' },
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
  // A session scan records attendance — the gate already let them in — so it says what was recorded.
  ok: { tone: 'ok', icon: 'fa-circle-check', entry: 'Present', meal: 'Meal claimed', tour: 'Boarded' },
  // Not a verdict yet: the scan showed who it is, and a staff tap decides.
  pending: { tone: 'pend', icon: 'fa-hand-pointer', entry: 'Check the face', meal: 'Check the face', tour: 'Check the face' },
  denied: { tone: 'bad', icon: 'fa-circle-xmark', entry: 'Not recorded', meal: 'Not served', tour: 'Not boarded' },
}

/**
 * A result the scanner shows as a strip and reads past — a clean pass at the gate or a session door.
 * Anything else (a refusal, an error, a tap still to make) stops the camera until the guard closes it.
 */
export const isQuickResult = (response) => response?.result === 'ok'

// A repeat this soon after the first scan is the same badge read twice, not someone coming back.
const JUST_SCANNED_MS = 60_000

/**
 * True when a pass is a repeat of a scan under a minute old — a session's re-entry or a gate scan of
 * someone already in — so the strip says "Just scanned" rather than "Welcome back" (ATOP, 2026-10-21).
 * The time is the server's first scan, so a colleague's scan at the same door counts too.
 */
export function justScanned(response) {
  const first = response?.reasonCode === 'reentry' ? response.scannedAt
    : response?.justCheckedIn === false ? response.checkedInAt
      : null
  return !!first && Date.now() - new Date(first).getTime() < JUST_SCANNED_MS
}

/** The diet as one line for the scan strip — { text, allergy } — or null when the API sent none. */
export function dietSummary(diet) {
  if (!diet) return null
  const parts = [...diet.restrictions, diet.notes && `“${diet.notes}”`].filter(Boolean)
  if (diet.hasAllergy) return { text: ['Food allergy', ...parts].join(' · '), allergy: true }
  return { text: parts.length > 0 ? parts.join(' · ') : 'No dietary needs', allergy: false }
}

// A shorter headline for the refusals a guard meets most, so the big line says what happened. A
// plain string reads the same at every kind of checkpoint.
const DENIED_HEADLINE = {
  already_scanned: { entry: 'Already marked present', meal: 'Already claimed', tour: 'Already boarded' },
  unknown_code: 'Code not recognised',
  cancelled: 'Cancelled',
  online: 'Online attendee',
  no_pass: 'No seat',
  balance_due: 'Balance not paid',
  not_checked_in: 'Main gate first',
  boarded_elsewhere: 'Already on a bus today',
  booking_changed: 'Booking changed · scan again',
  board_failed: 'Not boarded',
  checkpoint_inactive: 'Checkpoint closed',
  not_today: 'Not today’s checkpoint',
  no_show: 'Marked no-show',
  confirm_required: 'Check the face first',
}

// The pending sheets, by what the tap will do.
const PENDING_HEADLINE = {
  check_in: 'Not checked in yet',
  count_in: 'Check in for today',
  board_own: 'Booked on this bus',
  board_none: 'No tour booked',
  board_other: 'Booked on another bus',
}

// The one tap a pending sheet offers. A move asks once more before it happens.
export const PENDING_ACTION = {
  check_in: { label: 'Check in', icon: 'fa-check' },
  count_in: { label: 'Check in', icon: 'fa-check' },
  board_own: { label: 'Board', icon: 'fa-bus' },
  board_none: { label: 'Board here', icon: 'fa-bus' },
  board_other: { label: 'Board here instead', icon: 'fa-right-left', confirm: true },
}

export function resultHeadline(response, kind) {
  const which = kind === 'Meal' ? 'meal' : kind === 'Tour' ? 'tour' : 'entry'
  if (response.reasonCode === 'reentry') return 'Welcome back'
  if (response.result === 'pending') return PENDING_HEADLINE[response.reasonCode] || RESULT.pending[which]
  if (response.reasonCode === 'added') return 'Boarded · booked here'
  if (response.reasonCode === 'moved') return 'Boarded · moved here'
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

// One formatter, built once: a list of a thousand rows calls these on every keystroke.
const MANILA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })
const MANILA_STAMP = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short' })

/**
 * The scanning day an instant belongs to, "YYYY-MM-DD" in Manila: a check-in at 1:30 AM on the 21st
 * is the 20th's, as the API and the Activity tab count it.
 */
export function scanningDay(instant) {
  return MANILA_DATE.format(new Date(Date.parse(instant) - DAY_TURNS_OVER_MS))
}

/**
 * Today as the scanner reads it, "YYYY-MM-DD" in Manila: the earliest day a checkpoint can be set
 * on, since the API refuses a past one.
 */
export function scanningToday(now = Date.now()) {
  return MANILA_DATE.format(new Date(now - DAY_TURNS_OVER_MS))
}

/** The Manila calendar day of an instant, "YYYY-MM-DD" — for showing beside a time, not for grouping. */
export const venueDate = (instant) => MANILA_DATE.format(new Date(instant))

/** "2026-10-20 17:02" in Manila, for a CSV: sortable in a spreadsheet. */
export const csvStamp = (instant) => (instant ? MANILA_STAMP.format(new Date(instant)) : '')

/** Case- and accent-blind, so "pena" finds "Peña" and "QUEZON" finds "Quezon City". */
export const fold = (text) => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

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

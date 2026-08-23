// Domain vocabulary for convention registration. Mirrors the backend enums
// (Atop.Modules.Events) so the UI can label values and send back the exact
// strings the API parses. JSON from the API is camelCase.

// ---- Attendance mode ------------------------------------------------------

// The module's central distinction, not just a second price. It decides what the
// form asks for, what the badge means, and what a delegate actually gets.
export const ATTENDANCE_MODE = {
  InPerson: {
    label: 'In person',
    short: 'In person',
    tone: 'success',
    icon: 'fa-location-dot',
    blurb: 'Attend at the venue, with a seat at the Awarding Ceremonies.',
  },
  Virtual: {
    label: 'Online',
    short: 'Online',
    tone: 'info',
    icon: 'fa-video',
    blurb: 'Watch the sessions and the Awarding Ceremonies by livestream.',
  },
}

export function modeMeta(mode) {
  return ATTENDANCE_MODE[mode] || { label: mode, short: mode, tone: 'neutral', icon: 'fa-user' }
}

// Fields we only ask an in-person delegate for. Kept here so the form and any
// future export agree on what "physical only" means.
export const IN_PERSON_ONLY_FIELDS = ['dietaryRestrictions', 'shirtSize', 'accessibilityNeeds']

// ---- Registration lifecycle ----------------------------------------------

export const REGISTRATION_STATUS = {
  Draft: { label: 'Draft', tone: 'neutral', icon: 'fa-pen-ruler' },
  PendingPayment: { label: 'Awaiting payment', tone: 'warn', icon: 'fa-hourglass-half' },
  Confirmed: { label: 'Confirmed', tone: 'success', icon: 'fa-circle-check' },
  Expired: { label: 'Expired', tone: 'neutral', icon: 'fa-clock-rotate-left' },
  Cancelled: { label: 'Cancelled', tone: 'danger', icon: 'fa-circle-xmark' },
}

export function registrationStatusMeta(status) {
  return REGISTRATION_STATUS[status] || { label: status, tone: 'neutral', icon: 'fa-circle' }
}

export const ALL_REGISTRATION_STATUSES = Object.keys(REGISTRATION_STATUS)

// A booking's details and delegate list are only editable while it's a Draft —
// after checkout the amounts are on an invoice someone may already be paying.
export const isRegistrationEditable = (status) => status === 'Draft'

// Whether there is a payment to make. Not a status question any more: a downpayment confirms the
// booking, so a Confirmed one may still owe a balance — and paying it is the point. Only a
// cancelled booking, or one that owes nothing, has nothing to check out.
export const canCheckout = (status, balance = 0) =>
  status !== 'Cancelled' && Number(balance) > 0

export const DELEGATE_STATUS = {
  Registered: { label: 'Registered', tone: 'info', icon: 'fa-user-check' },
  Substituted: { label: 'Substituted', tone: 'progress', icon: 'fa-right-left' },
  Cancelled: { label: 'Cancelled', tone: 'danger', icon: 'fa-user-xmark' },
  CheckedIn: { label: 'Checked in', tone: 'success', icon: 'fa-door-open' },
  NoShow: { label: 'No show', tone: 'neutral', icon: 'fa-user-slash' },
}

export function delegateStatusMeta(status) {
  return DELEGATE_STATUS[status] || { label: status, tone: 'neutral', icon: 'fa-user' }
}

// ---- Invoice --------------------------------------------------------------

export const INVOICE_STATUS = {
  Draft: { label: 'Not yet opened', tone: 'neutral' },
  Pending: { label: 'Awaiting payment', tone: 'warn' },
  Paid: { label: 'Paid', tone: 'success' },
  Expired: { label: 'Expired', tone: 'neutral' },
  Cancelled: { label: 'Cancelled', tone: 'danger' },
  Refunded: { label: 'Refunded', tone: 'progress' },
}

export function invoiceStatusMeta(status) {
  return INVOICE_STATUS[status] || { label: status, tone: 'neutral' }
}

// ---- Who is registering, and who is paying --------------------------------

export const REGISTRANT_TYPES = [
  {
    value: 'LguDelegation',
    label: 'LGU delegation',
    hint: 'A local government unit sending one or more delegates.',
    icon: 'fa-building-columns',
  },
  {
    value: 'Organization',
    label: 'Organization',
    hint: 'A company, agency, or NGO.',
    icon: 'fa-briefcase',
  },
  {
    value: 'Individual',
    label: 'Individual',
    hint: 'Registering yourself.',
    icon: 'fa-user',
  },
]

export const PAYER_TYPES = [
  { value: 'Lgu', label: 'LGU / government office' },
  { value: 'Organization', label: 'Organization' },
  { value: 'Personal', label: 'Personal' },
]

// A TIN is required unless the payer is an individual — an LGU can't liquidate
// a disbursement against a receipt without one. Mirrors BillingInfo.Validate().
export const requiresTin = (payerType) => payerType === 'Lgu' || payerType === 'Organization'

// ATOP's four classifications (2026-08-20). Every one of them pays the same rate;
// the classification drives the badge and the reporting, not the price.
export const PARTICIPANT_TYPES = [
  { value: 'NationalBoard', label: 'National Board' },
  { value: 'Delegate', label: 'Delegate' },
  { value: 'Guest', label: 'Guest' },
  { value: 'Speaker', label: 'Speaker' },
]

export const PARTICIPANT_TYPE_LABELS = Object.fromEntries(
  PARTICIPANT_TYPES.map((p) => [p.value, p.label]),
)

// ---- Paying -----------------------------------------------------------------

/**
 * What reserving one seat costs: a flat ₱1,350 per pax (ATOP, 2026-08-23). Not a percentage and not
 * a floor — choosing a downpayment charges exactly this.
 *
 * The server is authoritative; this copy exists because the booking form prices a delegate list that
 * has not been saved yet. Every figure on a saved booking comes back as `downpaymentAmount` per
 * delegate, and those are the ones to trust.
 */
export const DOWNPAYMENT_PER_PAX = 1350

/** What a seat costs to pay for now, given the mode chosen for it. */
export const seatCharge = (seatAmount, mode) =>
  mode === 'downpayment' ? Math.min(DOWNPAYMENT_PER_PAX, Number(seatAmount)) : Number(seatAmount)

// ---- Money ----------------------------------------------------------------

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

/**
 * Format an amount as pesos. Rates are quoted **fee-inclusive** — what's shown
 * here is exactly what the payer is charged, so never add anything to it.
 */
export function formatPeso(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  return PESO.format(Number(amount))
}

/** Line up the delegates by rate the way the invoice will: one row per rate. */
export function summariseByRate(delegates = []) {
  const active = delegates.filter((d) => d.status !== 'Cancelled')
  const groups = new Map()
  for (const d of active) {
    const existing = groups.get(d.rateCode)
    if (existing) {
      existing.quantity += 1
      existing.lineTotal += Number(d.amount)
    } else {
      groups.set(d.rateCode, {
        rateCode: d.rateCode,
        attendanceMode: d.attendanceMode,
        unitAmount: Number(d.amount),
        quantity: 1,
        lineTotal: Number(d.amount),
      })
    }
  }
  return [...groups.values()]
}

// ---- Registration window --------------------------------------------------

/**
 * A human sentence about whether you can still register. The backend is the
 * authority (it re-checks on every write) — this is only so the UI can explain
 * itself before the user fills in a form they can't submit.
 */
export function registrationWindow(event, now = new Date()) {
  if (!event) return { open: false, message: null }
  if (event.registrationOpen) {
    const closes = new Date(event.registrationClosesAt)
    const days = Math.ceil((closes - now) / 86_400_000)
    return {
      open: true,
      message:
        days <= 0 ? 'Registration closes today.'
        : days === 1 ? 'Registration closes tomorrow.'
        : days <= 14 ? `Registration closes in ${days} days.`
        : null,
    }
  }
  return { open: false, message: event.registrationClosedReason || 'Registration is closed.' }
}

// ---- Delegate helpers -----------------------------------------------------

/** What a booking's money situation should be called, given it may be confirmed and still owe. */
export function paymentStandingLabel(registration) {
  if (!registration) return ''
  if (registration.isComplimentary) return 'Complimentary'
  if (Number(registration.balance) > 0 && Number(registration.amountPaid) > 0) return 'Balance due'
  if (Number(registration.balance) > 0) return 'Unpaid'
  return 'Paid in full'
}

/** Build the display name the badge would carry. */
export function delegateDisplayName(delegate) {
  return delegate?.badgeName || delegate?.fullName || '—'
}

/** A delegate still occupying a paid seat. */
export const isActiveDelegate = (d) => d?.status !== 'Cancelled'

// What the live pass says, worked out from the API's answer. Kept out of the components so the
// wording has one home: the page, the welcome overlay and the timeline all read from here.

const VENUE_TZ = 'Asia/Manila'
const DAY_MS = 86_400_000

// The greeting names the host city. Until the Secretariat sets the event's host LGU, it is Ormoc —
// where the 2026 convention is — and "Welcome to Ormoc City" reads like a road sign, so it is trimmed.
export function hostCityName(event) {
  const name = (event?.hostCity || '').replace(/^City of\s+/i, '').replace(/\s+City$/i, '').trim()
  return name || 'Ormoc'
}

// The convention's calendar days at the venue, as YYYY-MM-DD.
const venueDay = (iso) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10)
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

/**
 * Where today sits in the convention: before (with days to go), during (day N of M) or after.
 * `today` is the server's scanning day, so a phone with the wrong clock still counts right.
 */
export function phaseOf(pass) {
  const first = venueDay(pass.event.startsAt)
  const last = venueDay(pass.event.endsAt)
  const total = daysBetween(first, last) + 1

  if (pass.today < first) return { kind: 'before', daysToGo: daysBetween(pass.today, first), total }
  if (pass.today > last) return { kind: 'after', total }
  return { kind: 'during', day: conventionDay(pass.event, pass.today), total }
}

export function phaseChip(phase) {
  if (phase.kind === 'before')
    return phase.daysToGo === 1 ? 'Tomorrow!' : `${phase.daysToGo} days to go`
  if (phase.kind === 'after') return 'Thank you for coming'
  return phase.total > 1 ? `Day ${phase.day} of ${phase.total}` : 'Today'
}

/** Which day of the convention a YYYY-MM-DD is: 1 for its first. */
export const conventionDay = (event, day) => daysBetween(venueDay(event.startsAt), day) + 1

// "07:30:00" → "7:30 AM"
export const formatClock = (hhmmss) => {
  const [h, m] = hhmmss.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const timeAt = (iso) =>
  new Date(iso).toLocaleTimeString('en-PH', { timeZone: VENUE_TZ, hour: 'numeric', minute: '2-digit' })

export const dayLabel = (yyyyMmDd) =>
  new Date(`${yyyyMmDd}T00:00:00Z`).toLocaleDateString('en-PH', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
  })

export const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-PH', { timeZone: VENUE_TZ, weekday: 'long', month: 'long', day: 'numeric' })

/**
 * The one thing to do next. The gate's lane decides the desk — the page never names a desk the gate
 * didn't — and an amount owed is said without a figure: an LGU paying for its people may not want it
 * on every delegate's screen.
 */
export function nextStep(pass, phase) {
  if (phase.kind === 'after')
    return { tone: 'done', icon: 'fa-heart', title: 'Thank you for joining us', body: `We hope to see you at the next ATOP convention, ${pass.greetingName}.` }

  if (!pass.checkedInAt) {
    return phase.kind === 'before'
      ? { tone: 'info', icon: 'fa-calendar-check', title: 'See you at the main gate', body: `Bring this pass on ${longDate(pass.event.startsAt)}. One scan at the gate checks you in.` }
      : { tone: 'go', icon: 'fa-qrcode', title: 'Show this pass at the main gate', body: 'The marshal scans your QR and checks you in. Turn your screen brightness up for a quicker scan.' }
  }

  const live = pass.sessions.find((s) => s.isOpen && !s.attendedAt)
  const toCollect = [!pass.idReleased && 'ID', !pass.kitReleased && 'kit'].filter(Boolean)

  if (pass.owes)
    return { tone: 'warn', icon: 'fa-receipt', title: 'Please drop by Desk B', body: `Settle your balance at Desk B${toCollect.length ? `, then collect your ${toCollect.join(' and ')} there` : ''}.` }
  if (pass.desk !== 'Done' && toCollect.length)
    return { tone: 'go', icon: 'fa-id-badge', title: `Collect your ${toCollect.join(' and ')} at Desk ${pass.desk}`, body: 'Show this same QR at the desk.' }
  if (live)
    return { tone: 'go', icon: 'fa-door-open', title: `${live.label} is on now`, body: 'Show your QR at the door to be counted in.' }
  return { tone: 'done', icon: 'fa-champagne-glasses', title: "You're all set", body: 'Enjoy the convention. Keep this page handy — it is your pass all week.' }
}

/**
 * Everything on this pass that happened at a scan, each with a key that never changes once it
 * happened. The page remembers which keys it has celebrated, so a reload never welcomes anyone twice.
 */
export function moments(pass) {
  const list = []
  if (pass.checkedInAt) list.push({ key: `in:${pass.checkedInAt}`, kind: 'checkin', at: pass.checkedInAt })
  for (const s of pass.sessions)
    if (s.attendedAt) list.push({ key: `s:${s.id}`, kind: 'session', at: s.attendedAt, label: s.label })
  if (pass.tour?.boardedAt)
    list.push({ key: `t:${pass.tour.boardedAt}`, kind: 'tour', at: pass.tour.boardedAt, label: pass.tour.batch })
  return list
}

/** What the overlay says for the moments just scanned — a gate scan in a session is one welcome, not two. */
export function welcomeFor(pass, fresh) {
  const city = hostCityName(pass.event)
  const name = pass.greetingName
  const checkin = fresh.find((m) => m.kind === 'checkin')
  const session = fresh.find((m) => m.kind === 'session')
  const tour = fresh.find((m) => m.kind === 'tour')

  if (tour)
    return { title: `All aboard, ${name}!`, line: `You're on ${tour.label} — ${pass.tour.package}. Enjoy the tour.` }
  if (checkin)
    return {
      title: `Welcome to ${city}, ${name}!`,
      line: session ? `You're checked in and counted at ${session.label}.` : "You're checked in. We're so glad you're here.",
    }
  return { title: `Welcome back, ${name}!`, line: `You're counted at ${session.label}.` }
}

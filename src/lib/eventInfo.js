import { api } from './apiClient'

/**
 * The published convention, fetched once per page.
 *
 * The pass used to carry a hardcoded title, a hardcoded venue and hardcoded dates — which had
 * already drifted from the record before anyone printed one. Anything a delegate is handed should
 * say what the event row says.
 */
let pending = null

export function currentEvent() {
  pending ??= api.get('/events/').then((events) => events?.[0] ?? null).catch(() => null)
  return pending
}

/**
 * "20–22 October 2026", collapsing whatever the two dates share.
 *
 * Read in UTC on purpose: the API stores each day as midnight UTC standing for a calendar date, so
 * formatting in the viewer's zone would show a delegate west of Greenwich the day before.
 */
export function formatEventDates(startsAt, endsAt) {
  if (!startsAt) return null
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : null

  const day = (d) => d.getUTCDate()
  const month = (d) => d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  const year = (d) => d.getUTCFullYear()

  if (!end || (day(start) === day(end) && month(start) === month(end) && year(start) === year(end)))
    return `${day(start)} ${month(start)} ${year(start)}`

  if (year(start) !== year(end))
    return `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`

  if (month(start) !== month(end))
    return `${day(start)} ${month(start)} – ${day(end)} ${month(end)} ${year(end)}`

  return `${day(start)}–${day(end)} ${month(start)} ${year(start)}`
}

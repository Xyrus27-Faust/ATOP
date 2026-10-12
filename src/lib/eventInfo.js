import { api, ApiError } from './apiClient'

/**
 * "The convention": the one event the desk, the scanner, the checkpoints and the pass mean. The API
 * decides which (the one still to finish that starts soonest, never a draft or a cancelled one), so
 * publishing next year early can't move this year's desk. Null when there is none; any other
 * failure throws, so a page can offer Retry instead of claiming there's no event.
 */
export async function fetchCurrentEvent() {
  try {
    return await api.get('/events/current')
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * The same, fetched once per page, for the pass: it used to carry a hardcoded title, venue and
 * dates, which had drifted from the record before anyone printed one. A failure just leaves them off.
 */
let pending = null

export function currentEvent() {
  pending ??= fetchCurrentEvent().catch(() => null)
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

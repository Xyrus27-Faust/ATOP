// The two orders a check-in list offers: whoever was dealt with last on top, or the roster's A–Z.
export const SORTS = [
  { key: 'latest', label: 'Latest first' },
  { key: 'name', label: 'A–Z' },
]

/** The newest of the given ISO times, as milliseconds, or null when there is none. */
export function newest(...stamps) {
  let best = null
  for (const s of stamps) {
    const t = s ? Date.parse(s) : NaN
    if (!Number.isNaN(t) && (best === null || t > best)) best = t
  }
  return best
}

/**
 * `rows` with the newest `timeOf(row)` first, and those with none after them. The sort is stable, so
 * equal times and everyone without a time keep the order they came in: the roster's A–Z.
 */
export function latestFirst(rows, timeOf) {
  const at = new Map(rows.map((r) => [r, timeOf(r)]))
  return [...rows].sort((a, b) => {
    const x = at.get(a)
    const y = at.get(b)
    if (x === y) return 0
    if (x === null) return 1
    if (y === null) return -1
    return y - x
  })
}

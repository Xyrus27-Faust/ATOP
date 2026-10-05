/**
 * The convention ID front, in points, and the rules for setting the three lines on it.
 *
 * <p>Every number here is the matching constant in <c>IdCardRenderer</c> on the API — the card is
 * 246.75 × 156 pt (87 × 55 mm) and the positions were measured off ATOP-ID-87-x-55-mm.pdf. The
 * fitting below mirrors that renderer's too, so {@link IdCardPreview} lays the lines out exactly
 * where the printer will. If the card art or the renderer changes, this changes with it or the
 * preview starts lying.</p>
 *
 * <p>The typeface is Libre Baskerville, which is what the server prints with — itself a stand-in for
 * the Miller family the artwork was set in, licensed through Canva and unshippable on a server. It
 * is loaded in <c>index.html</c> alongside the site's own faces.</p>
 */

/** The page. */
export const CARD = { w: 246.75, h: 156 }

/** The photo well: a rounded rectangle, very slightly taller than it is wide. */
export const WELL = { x: 32.39, y: 56.38, w: 64.54, h: 66.70, r: 10.5 }

/** The column the three lines are centred in and fitted to. */
export const COLUMN = 84

export const NAME = { cx: 157.2, baseline: 77.73, max: 10.6, minSingle: 8, twoLineMax: 9, min: 6.5 }
export const CLASSIFICATION = { cx: 157.2, baseline: 88.05, size: 7.4 }
export const ID_NO = { cx: 158.6, baseline: 109.88, size: 9.6 }

/** The renderer steps the size down by this much looking for a fit. */
const STEP = 0.2

/** Space between the name's two lines, as the renderer sets it. */
export const NAME_LEADING = 1.15

export const FAMILY = '"Libre Baskerville", Georgia, serif'

/**
 * Where the baseline sits inside a line box, in em. Libre Baskerville's typo metrics are 0.97 up and
 * 0.27 down and it sets USE_TYPO_METRICS, so the content area is 1.24em and the browser splits the
 * leading evenly.
 */
export const baselineFromTop = (lineHeight) => (lineHeight - 1.24) / 2 + 0.97

/** One canvas for every measurement on the page; it is never drawn to. */
let shared = null
const context = () => {
  if (!shared && typeof document !== 'undefined') {
    shared = document.createElement('canvas').getContext('2d')
  }
  return shared
}

/**
 * Measured at the point size and compared against the column in points — the ratio is what matters,
 * and both this and Skia measure unhinted, so the two agree to within a rounding error.
 */
function measure(text, size) {
  const ctx = context()
  if (!ctx || !text) return 0
  ctx.font = `${size}px ${FAMILY}`
  return ctx.measureText(text).width
}

/** The largest size from max down to min at which the text fits the column. */
export function fit(text, max, min) {
  let size = max
  while (size > min && measure(text, size) > COLUMN) size -= STEP
  return size
}

/**
 * One line while it fits at a legible size; otherwise two, split at the space nearest the middle and
 * capped below the one-line size so they do not crowd the logo above. A name too long even at the
 * smallest size overflows the column rather than splitting further — which is what the renderer
 * does, and seeing it overflow is the point.
 */
export function layoutName(name) {
  if (!name) return { lines: [], size: NAME.max }

  for (let size = NAME.max; size >= NAME.minSingle - 1e-9; size -= STEP) {
    if (measure(name, size) <= COLUMN) return { lines: [name], size }
  }

  const [first, second] = splitNearMiddle(name)
  const longer = first.length >= second.length ? first : second
  return { lines: [first, second].filter(Boolean), size: fit(longer, NAME.twoLineMax, NAME.min) }
}

function splitNearMiddle(text) {
  const spaces = [...text].map((c, i) => (c === ' ' ? i : -1)).filter((i) => i >= 0)
  if (spaces.length === 0) return ['', text]

  const middle = Math.floor(text.length / 2)
  const cut = spaces.reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a))
  return [text.slice(0, cut), text.slice(cut + 1)]
}

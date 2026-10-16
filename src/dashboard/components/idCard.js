/**
 * The convention ID front, in points, and the rules for setting the three lines on it.
 *
 * <p>Every number here is the matching constant in <c>IdCardRenderer</c> on the API — the card is
 * 156 × 246.75 pt (55 × 87 mm), portrait since 2026-10-16 because it hangs upright in the jacket
 * holder; the art is the API's front.png scaled down. The
 * fitting below mirrors that renderer's too, so {@link IdCardPreview} lays the lines out exactly
 * where the printer will. If the card art or the renderer changes, this changes with it or the
 * preview starts lying.</p>
 *
 * <p>The typeface is Libre Baskerville, which is what the server prints with — itself a stand-in for
 * the Miller family the artwork was set in, licensed through Canva and unshippable on a server. It
 * is loaded in <c>index.html</c> alongside the site's own faces.</p>
 */

/** The page. */
export const CARD = { w: 156, h: 246.75 }

/** The photo well: a rounded rectangle, very slightly taller than it is wide. */
export const WELL = { x: 35.91, y: 69.26, w: 84.37, h: 87.17, r: 13.65 }

/**
 * The columns the lines are fitted to. The name sits above the pineapple and may use the card's
 * width; the two lines under it sit beside the pineapple and are held narrower.
 */
export const NAME_COLUMN = 108
export const COLUMN = 80

export const NAME = { cx: 78, baseline: 181, max: 10.6, minSingle: 8, twoLineMax: 9, min: 6.5 }
export const CLASSIFICATION = { cx: 78, baseline: 192, size: 7.4 }
export const ID_NO = { cx: 78, baseline: 212, size: 9.6 }

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
export function fit(text, max, min, column = COLUMN) {
  let size = max
  while (size > min && measure(text, size) > column) size -= STEP
  return size
}

/**
 * One line while it fits at a legible size; otherwise two, split at the space nearest the middle and
 * capped below the one-line size so they do not crowd the photo above. A name too long even at the
 * smallest size overflows the column rather than splitting further — which is what the renderer
 * does, and seeing it overflow is the point.
 */
export function layoutName(name) {
  if (!name) return { lines: [], size: NAME.max }

  for (let size = NAME.max; size >= NAME.minSingle - 1e-9; size -= STEP) {
    if (measure(name, size) <= NAME_COLUMN) return { lines: [name], size }
  }

  const [first, second] = splitNearMiddle(name)
  // Sized by the wider line, not the one with more letters — as the renderer does.
  const size = Math.min(
    fit(first, NAME.twoLineMax, NAME.min, NAME_COLUMN),
    fit(second, NAME.twoLineMax, NAME.min, NAME_COLUMN))
  return { lines: [first, second].filter(Boolean), size }
}

function splitNearMiddle(text) {
  const spaces = [...text].map((c, i) => (c === ' ' ? i : -1)).filter((i) => i >= 0)
  if (spaces.length === 0) return ['', text]

  const middle = Math.floor(text.length / 2)
  const cut = spaces.reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a))
  return [text.slice(0, cut), text.slice(cut + 1)]
}

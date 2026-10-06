/**
 * One dashboard stat tile: a number, what it counts, and a watermark in the corner.
 *
 * <p>The three pages that show these had byte-identical copies of this component. They are one now
 * because the fix has to hold everywhere: these tiles carry money and ratios, not just counts, and
 * "₱12,369,600.00" at the full 2rem is wider than the tile it sits in.</p>
 *
 * <p>Two things keep a long value off the watermark, and both live in the stylesheet
 * (<c>.dash-stat</c> in DashboardLayout). The content sits on its own layer, so the glyph can only
 * ever be behind the digits rather than over them; and the value's size is worked out from the
 * tile's width and <c>--stat-len</c>, the only thing this component has to supply.</p>
 */
export default function Stat({ icon, label, value, className = '' }) {
  const text = value === null || value === undefined ? '' : String(value)

  return (
    <div
      className={`dash-card dash-stat ${className}`.trim()}
      style={{ '--stat-len': Math.max(text.length, 1) }}
    >
      <div className="dash-stat-icon"><i className={`fas ${icon}`} aria-hidden="true" /></div>
      <div>
        <div className="dash-stat-value">{text}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </div>
  )
}

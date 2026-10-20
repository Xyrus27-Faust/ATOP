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
export default function Stat({ icon, label, value, className = '', breakdown = null }) {
  const text = value === null || value === undefined ? '' : String(value)

  const tile = (
    <div
      className={`dash-card dash-stat ${breakdown ? 'has-breakdown' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={{ '--stat-len': Math.max(text.length, 1) }}
    >
      <div className="dash-stat-icon"><i className={`fas ${icon}`} aria-hidden="true" /></div>
      <div>
        <div className="dash-stat-value">{text}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </div>
  )
  if (!breakdown?.length) return tile

  // How the figure is made, on hover — or on focus, so a keyboard or a tap reaches it too. It sits
  // beside the tile rather than in it: the tile clips its overflow to keep the watermark inside.
  return (
    <div className="dash-stat-wrap" tabIndex={0} aria-label={`${label}: ${text}. ${breakdown.map((r) => `${r.label} ${r.value}`).join('; ')}`}>
      {tile}
      <div className="dash-stat-tip" role="tooltip">
        <table>
          <tbody>
            {breakdown.map((row) => (
              <tr key={row.label} className={row.total ? 'is-total' : ''}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

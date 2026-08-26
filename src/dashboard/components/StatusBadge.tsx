import { statusMeta } from '@/lib/pearlAwards'

// A colour-coded pill for an entry's lifecycle status.
export default function StatusBadge({ status }) {
  const m = statusMeta(status)
  return (
    <span className={`dash-badge tone-${m.tone}`}>
      <i className={`fas ${m.icon}`} aria-hidden="true" /> {m.label}
    </span>
  )
}

/** Previous / Page x of y / Next under a paged list, as on the Registrations admin page. Hidden on a single page. */
export default function Pager({ paged: p, onPage }) {
  if (p.pages <= 1) return null
  return (
    <div className="dash-pager">
      <button type="button" className="dash-btn" disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}>
        <i className="fas fa-chevron-left" aria-hidden="true" /> Previous
      </button>
      <span>Page {p.page} of {p.pages} · {p.from + 1}–{p.from + p.rows.length} of {p.total}</span>
      <button type="button" className="dash-btn" disabled={p.page >= p.pages} onClick={() => onPage(p.page + 1)}>
        Next <i className="fas fa-chevron-right" aria-hidden="true" />
      </button>
    </div>
  )
}

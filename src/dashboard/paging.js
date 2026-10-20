// Rows drawn per page on a list held whole in the browser — the same page size as the Registrations admin page.
export const PAGE_SIZE = 50

/**
 * The page of `items` to draw. `at` is the component's `{ key, page }` state, `key` the list's current
 * filters and search: when they no longer match, the list changed under the admin and it is back to
 * page 1. Clamped to the last page, so a Refresh that shrinks the list never leaves an empty page.
 */
export function pageOf(items, at, key) {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const page = Math.min(at.key === key ? at.page : 1, pages)
  const from = (page - 1) * PAGE_SIZE
  return { page, pages, from, rows: items.slice(from, from + PAGE_SIZE), total: items.length }
}

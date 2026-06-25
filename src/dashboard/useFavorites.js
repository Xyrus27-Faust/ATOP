import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'

/**
 * Loads and mutates the caller's favourited award-category numbers. Toggling is
 * optimistic — the star flips immediately and the change is rolled back if the
 * request fails. Favourites are a low-stakes convenience, so a load failure is
 * non-fatal: the catalog still renders, just without any saved stars.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState(() => new Set())

  useEffect(() => {
    let active = true
    api.get('/award-categories/favorites', { auth: true }).then(
      (res) => { if (active) setFavorites(new Set(res?.numbers || [])) },
      () => {},
    )
    return () => { active = false }
  }, [])

  // Depends on `favorites` so the closure always sees current membership; the
  // request fires from the handler body (once), never from inside a setState
  // updater (which React double-invokes in StrictMode).
  const toggle = useCallback((number) => {
    const adding = !favorites.has(number)

    setFavorites((prev) => {
      const next = new Set(prev)
      if (adding) next.add(number)
      else next.delete(number)
      return next
    })

    const request = adding
      ? api.post(`/award-categories/${number}/favorite`, undefined, { auth: true })
      : api.delete(`/award-categories/${number}/favorite`, { auth: true })

    // Roll back to the pre-toggle membership if the server rejects the change.
    request.catch(() => {
      setFavorites((prev) => {
        const rb = new Set(prev)
        if (adding) rb.delete(number)
        else rb.add(number)
        return rb
      })
    })
  }, [favorites])

  return { favorites, toggle }
}

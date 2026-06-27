import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'

/**
 * Loads and mutates the caller's favourited award-category numbers. Toggling is
 * optimistic — the star flips immediately and rolls back if the request fails.
 *
 * Pass `enabled=false` for signed-out visitors so it never fires an
 * authenticated request (a 401 there would trip the session-expiry flow). When
 * `enabled` flips true (e.g. after sign-in), favourites are (re)loaded.
 */
export function useFavorites(enabled = true) {
  const [favorites, setFavorites] = useState(() => new Set())

  useEffect(() => {
    if (!enabled) return
    let active = true
    api.get('/award-categories/favorites', { auth: true }).then(
      (res) => { if (active) setFavorites(new Set(res?.numbers || [])) },
      () => {},
    )
    return () => { active = false }
  }, [enabled])

  const toggle = useCallback((number) => {
    if (!enabled) return
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

    request.catch(() => {
      setFavorites((prev) => {
        const rb = new Set(prev)
        if (adding) rb.delete(number)
        else rb.add(number)
        return rb
      })
    })
  }, [favorites, enabled])

  return { favorites, toggle }
}

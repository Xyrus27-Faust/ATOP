import { api } from './apiClient'

/**
 * Where an LGU sits, in words: "Ormoc City · Leyte".
 *
 * The registration snapshots an LGU's own name but not its parent, and the directory returns a
 * province *code* rather than a name — so the province costs a second lookup. Both are public,
 * both are seeded reference data that never changes under us, so results are cached for the life
 * of the page and a pass opened twice makes no request the second time.
 *
 * A province registers as itself, with no parent to add; those return just the name.
 */
const cache = new Map()

export async function lguLabel(code) {
  if (!code) return null
  if (cache.has(code)) return cache.get(code)

  const pending = (async () => {
    try {
      const lgu = await api.get(`/lgus/${code}`)
      if (!lgu?.name) return null
      if (lgu.isProvince || !lgu.provinceCode) return lgu.name

      const province = await api.get(`/lgus/${lgu.provinceCode}`).catch(() => null)
      return province?.name ? `${lgu.name} · ${province.name}` : lgu.name
    } catch {
      // A pass that cannot name a province is still a valid pass. Fall back to nothing rather
      // than blocking the QR the delegate actually came for.
      return null
    }
  })()

  cache.set(code, pending)
  return pending
}

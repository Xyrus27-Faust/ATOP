import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/apiClient'
import { getPass } from '@/lib/pass'
import { moments } from './passCopy'

// Fast while someone is likely standing at the gate with the page open, slow after: the welcome has
// to land within a breath of the scan, but a phone left on a table all morning should not poll every
// few seconds. Under the API's 60-a-minute ceiling per link either way.
const FAST_MS = 3_000
const SLOW_MS = 60_000
const FAST_FOR_MS = 120_000

// A scan this recent is news; an older one, seen for the first time, is history — opening the link
// on the bus home should not throw a welcome at you.
const NEWS_FOR_MS = 180_000

const cacheKey = (token) => `atop-pass:${token}`
const seenKey = (token) => `atop-pass-seen:${token}`

function readCache(token) {
  try {
    const raw = localStorage.getItem(cacheKey(token))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(token, pass) {
  try {
    if (pass) localStorage.setItem(cacheKey(token), JSON.stringify(pass))
    else localStorage.removeItem(cacheKey(token))
  } catch {
    // Private mode or a full disk: the page still works, it just can't open offline.
  }
}

/** The scans this phone has not celebrated yet, and remembers the rest as celebrated. */
function takeFresh(token, pass) {
  let seen = []
  try { seen = JSON.parse(localStorage.getItem(seenKey(token)) || '[]') } catch { /* start clean */ }
  const all = moments(pass)
  const now = Date.parse(pass.serverTime)
  const fresh = all.filter((m) => !seen.includes(m.key) && now - Date.parse(m.at) < NEWS_FOR_MS)
  try { localStorage.setItem(seenKey(token), JSON.stringify(all.map((m) => m.key))) } catch { /* see writeCache */ }
  return fresh
}

/**
 * A live pass, kept fresh. The last answer is cached on the phone, so the QR still shows at a gate
 * with no signal — the code in it never changes, only what the page says around it.
 *
 * Polling stops while the tab is hidden and restarts fast when it comes back: a delegate unlocking
 * their phone at the gate is exactly the moment to be quick.
 */
export function usePassStatus(token) {
  const [pass, setPass] = useState(() => readCache(token))
  const [status, setStatus] = useState(() => (readCache(token) ? 'cached' : 'loading')) // loading | live | cached | offline | missing
  const [updatedAt, setUpdatedAt] = useState(null)
  const [fresh, setFresh] = useState([])
  const fastUntil = useRef(0)

  const load = useCallback(async (signal) => {
    try {
      const next = await getPass(token)
      if (signal.aborted) return
      setPass(next)
      setStatus('live')
      setUpdatedAt(new Date())
      writeCache(token, next)
      const news = takeFresh(token, next)
      if (news.length) setFresh(news)
    } catch (err) {
      if (signal.aborted) return
      if (err instanceof ApiError && err.status === 404) {
        // Not a pass any more (or never was): drop the copy so the QR stops showing.
        writeCache(token, null)
        setPass(null)
        setStatus('missing')
        return
      }
      // No signal, a timeout, or the rate limit: keep showing what we had.
      setStatus((s) => (s === 'loading' ? 'offline' : s === 'live' ? 'cached' : s))
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    let timer = null
    fastUntil.current = Date.now() + FAST_FOR_MS

    const schedule = () => {
      clearTimeout(timer)
      if (document.hidden || controller.signal.aborted) return
      const wait = Date.now() < fastUntil.current ? FAST_MS : SLOW_MS
      timer = setTimeout(async () => {
        await load(controller.signal)
        schedule()
      }, wait)
    }

    const onVisible = () => {
      if (document.hidden) { clearTimeout(timer); return }
      fastUntil.current = Date.now() + FAST_FOR_MS
      load(controller.signal).then(schedule)
    }

    load(controller.signal).then(schedule)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const clearFresh = useCallback(() => setFresh([]), [])

  // `fresh`: what was just scanned, for the welcome. Cleared by the page once it has been shown.
  return { pass, status, updatedAt, fresh, clearFresh }
}

import { useCallback, useEffect, useState } from 'react'
import { getLiveSession, SESSION_POLL_MS } from '@/lib/checkin'

/**
 * The session open right now, for the gate and the desk: { session, known, refresh }.
 *
 * <p>Asked on mount, every minute, and whenever {@code refresh} is called (after each scan), so a
 * session the admin opens or closes reaches every phone without a reload. A failed ask keeps the last
 * answer rather than blanking the bar — a phone that drops off the Wi-Fi for a moment still shows
 * the right session; {@code known} is false only until the first answer arrives.</p>
 */
export function useLiveSession(eventId) {
  const [state, setState] = useState({ session: null, known: false })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!eventId) return undefined
    let active = true
    getLiveSession(eventId).then(
      (session) => { if (active) setState({ session: session || null, known: true }) },
      () => { /* keep the last answer; the next poll tries again */ },
    )
    const timer = setTimeout(refresh, SESSION_POLL_MS)
    return () => { active = false; clearTimeout(timer) }
  }, [eventId, nonce, refresh])

  return { ...state, refresh }
}

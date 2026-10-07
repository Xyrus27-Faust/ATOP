import { useCallback, useEffect, useRef, useState } from 'react'

// The same badge held in front of the camera decodes several times a second. Once a code has been
// handled, the same code is ignored for this long after the guard is ready again — otherwise
// dismissing "Let in" would instantly re-scan the badge still in frame and show "Already entered".
const SAME_CODE_COOLDOWN_MS = 3000

// A minute with no badge read and no result closed: the camera goes off, which is what heats a phone
// left running at a quiet gate. One tap — or closing the result — brings it back in about a second.
const SLEEP_AFTER_MS = 60_000

/**
 * The camera, reading QR codes.
 *
 * <p>The decoder (nimiq's qr-scanner, with its web worker) is imported here, on demand, so only
 * someone who opens the scanner downloads it. It is used over the browser's own BarcodeDetector
 * because iOS Safari does not have one — and most of the guards will be holding iPhones.</p>
 *
 * <p>{@code ready} is the parent saying "I can take another code". While it is false (a scan is in
 * flight, or a result is on screen) the picture freezes and nothing is decoded — the camera stays
 * warm, so closing the result scans again at once. Anything decoded in the gap is dropped, not
 * queued: a guard wants the badge in front of them now, not the one from a minute ago.</p>
 *
 * <p>After {@link SLEEP_AFTER_MS} without a read or a closed result the camera switches off and a
 * "Tap to scan" button takes its place; the tap, or the parent becoming ready again, wakes it.</p>
 *
 * <p>{@code lastCode} is for a parent that takes the camera away while a result shows (the desk swaps
 * in the card): the code it last handled, so the badge still in front of the lens when the camera
 * comes back isn't read again as a new arrival. It gets the same cooldown as any repeat.</p>
 *
 * <p>When the camera cannot be used — no permission, no camera, or a page not served over HTTPS —
 * {@code onUnavailable} gets a sentence the guard can act on, and the parent swaps in the search.</p>
 */
export default function QrViewfinder({ ready, onCode, onUnavailable, lastCode = null }) {
  const video = useRef(null)
  const readyRef = useRef(ready)
  const onCodeRef = useRef(onCode)
  const onUnavailableRef = useRef(onUnavailable)
  // Read once, at mount: the cooldown below starts it from the moment the camera is ready.
  const last = useRef({ code: lastCode, at: 0 })
  const scannerRef = useRef(null)
  const wasReady = useRef(ready)
  const [starting, setStarting] = useState(true)
  const [asleep, setAsleep] = useState(false)

  const wake = useCallback(() => {
    scannerRef.current?.start()
      .then(() => setAsleep(false))
      .catch(() => onUnavailableRef.current?.('no-camera'))
  }, [])

  useEffect(() => {
    readyRef.current = ready
    onCodeRef.current = onCode
    onUnavailableRef.current = onUnavailable
    // The cooldown runs from the moment the guard is ready again, not from the first decode —
    // a result that sat on screen for ten seconds should still not re-fire the moment it closes.
    if (ready && last.current.code) last.current.at = Date.now()
  }, [ready, onCode, onUnavailable])

  useEffect(() => {
    let scanner = null
    let cancelled = false

    async function start() {
      // No mediaDevices at all means the page isn't in a secure context (plain http on a LAN IP).
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailableRef.current?.('insecure')
        return
      }
      try {
        const { default: QrScanner } = await import('qr-scanner')
        if (cancelled || !video.current) return

        scanner = new QrScanner(
          video.current,
          (result) => {
            const code = (result?.data || '').trim()
            if (!code || !readyRef.current) return
            const now = Date.now()
            if (code === last.current.code && now - last.current.at < SAME_CODE_COOLDOWN_MS) return
            last.current = { code, at: now }
            onCodeRef.current?.(code)
          },
          {
            preferredCamera: 'environment',
            // Plenty for a badge held still, at half the work for the phone.
            maxScansPerSecond: 4,
            returnDetailedScanResult: true,
            // Our own gold brackets mark the target; the library's overlay would fight them.
            highlightScanRegion: false,
            // Frames that hold no QR are the normal case, not an error worth reporting.
            onDecodeError: () => {},
          },
        )
        await scanner.start()
        if (cancelled) return
        scannerRef.current = scanner
        setStarting(false)
      } catch (err) {
        if (cancelled) return
        const text = String(err?.name || err?.message || err)
        onUnavailableRef.current?.(/NotAllowed|Permission|denied/i.test(text) ? 'denied' : 'no-camera')
      }
    }

    start()
    return () => {
      scannerRef.current = null
      cancelled = true
      scanner?.destroy()
    }
  }, [])

  // Behind a result: freeze the picture, which stops the decoder's frame loop without letting the
  // camera go. Ready again: play, and the loop picks up. Either way the sleep clock starts over.
  useEffect(() => {
    const s = scannerRef.current
    if (!s || asleep) return
    if (ready) video.current?.play().catch(() => {})
    else video.current?.pause()
    const t = setTimeout(() => { s.stop(); setAsleep(true) }, SLEEP_AFTER_MS)
    return () => clearTimeout(t)
  }, [ready, asleep, starting])

  // Closing a result is the guard's tap: a camera that fell asleep behind it wakes with it.
  useEffect(() => {
    if (ready && !wasReady.current && asleep) wake()
    wasReady.current = ready
  }, [ready, asleep, wake])

  return (
    <div className="qvf">
      {/* muted + playsInline, or iOS opens the stream full screen in its own player. */}
      <video ref={video} className="qvf-video" muted playsInline aria-label="Camera view" />
      <div className="qvf-target" aria-hidden="true">
        <span className="qvf-corner tl" /><span className="qvf-corner tr" />
        <span className="qvf-corner bl" /><span className="qvf-corner br" />
      </div>
      {asleep && (
        <button type="button" className="qvf-sleep" onClick={wake}>
          <i className="fas fa-camera" aria-hidden="true" />
          <span>Tap to scan</span>
          <small>Camera off to save battery</small>
        </button>
      )}
      {starting && (
        <div className="qvf-starting" role="status">
          <i className="fas fa-camera" aria-hidden="true" /> Starting camera…
        </div>
      )}
      <style>{QVF_CSS}</style>
    </div>
  )
}

const QVF_CSS = `
  .qvf {
    position: relative; width: 100%; max-width: 420px; margin: 0 auto;
    aspect-ratio: 1 / 1; border-radius: var(--radius-md); overflow: hidden;
    background: #000;
  }
  .qvf-video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .qvf-target { position: absolute; inset: 14%; pointer-events: none; }
  .qvf-corner { position: absolute; width: 34px; height: 34px; border: 4px solid var(--gold); }
  .qvf-corner.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 10px; }
  .qvf-corner.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 10px; }
  .qvf-corner.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 10px; }
  .qvf-corner.br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 10px; }
  .qvf-sleep {
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; border: 0; cursor: pointer; background: var(--navy); color: var(--white);
    font-family: var(--font-heading); font-weight: 800; font-size: 1.3rem;
  }
  .qvf-sleep i { font-size: 2.4rem; color: var(--gold); }
  .qvf-sleep small { font-family: var(--font-body); font-weight: 400; font-size: 0.85rem; color: rgba(255,255,255,0.7); }
  .qvf-starting {
    position: absolute; inset: 0; display: grid; place-items: center; gap: 8px;
    color: rgba(255,255,255,0.85); font-family: var(--font-heading); font-size: 0.85rem; font-weight: 600;
  }
`

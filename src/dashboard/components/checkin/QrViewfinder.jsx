import { useEffect, useRef, useState } from 'react'

// The same badge held in front of the camera decodes several times a second. Once a code has been
// handled, the same code is ignored for this long after the guard is ready again — otherwise
// dismissing "Checked in" would instantly re-scan the badge still in frame and show "Already entered".
const SAME_CODE_COOLDOWN_MS = 3000

/**
 * The camera, reading QR codes.
 *
 * <p>The decoder (nimiq's qr-scanner, with its web worker) is imported here, on demand, so only
 * someone who opens the scanner downloads it. It is used over the browser's own BarcodeDetector
 * because iOS Safari does not have one — and most of the guards will be holding iPhones.</p>
 *
 * <p>{@code ready} is the parent saying "I can take another code". While it is false (a scan is in
 * flight, or a result is on screen) decoded frames are dropped rather than queued: a guard wants
 * the badge in front of them now, not the one from four seconds ago.</p>
 *
 * <p>When the camera cannot be used — no permission, no camera, or a page not served over HTTPS —
 * {@code onUnavailable} gets a sentence the guard can act on, and the parent swaps in the search.</p>
 */
export default function QrViewfinder({ ready, onCode, onUnavailable }) {
  const video = useRef(null)
  const readyRef = useRef(ready)
  const onCodeRef = useRef(onCode)
  const onUnavailableRef = useRef(onUnavailable)
  const last = useRef({ code: null, at: 0 })
  const [starting, setStarting] = useState(true)

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
            maxScansPerSecond: 8,
            returnDetailedScanResult: true,
            // Our own gold brackets mark the target; the library's overlay would fight them.
            highlightScanRegion: false,
            // Frames that hold no QR are the normal case, not an error worth reporting.
            onDecodeError: () => {},
          },
        )
        await scanner.start()
        if (!cancelled) setStarting(false)
      } catch (err) {
        if (cancelled) return
        const text = String(err?.name || err?.message || err)
        onUnavailableRef.current?.(/NotAllowed|Permission|denied/i.test(text) ? 'denied' : 'no-camera')
      }
    }

    start()
    return () => {
      cancelled = true
      scanner?.destroy()
    }
  }, [])

  return (
    <div className="qvf">
      {/* muted + playsInline, or iOS opens the stream full screen in its own player. */}
      <video ref={video} className="qvf-video" muted playsInline aria-label="Camera view" />
      <div className="qvf-target" aria-hidden="true">
        <span className="qvf-corner tl" /><span className="qvf-corner tr" />
        <span className="qvf-corner bl" /><span className="qvf-corner br" />
      </div>
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
  .qvf-starting {
    position: absolute; inset: 0; display: grid; place-items: center; gap: 8px;
    color: rgba(255,255,255,0.85); font-family: var(--font-heading); font-size: 0.85rem; font-weight: 600;
  }
`

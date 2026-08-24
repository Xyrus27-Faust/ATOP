import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

/**
 * A delegate's check-in code, drawn.
 *
 * The QR encodes the reference code itself — the same string the door scanner looks up, and the
 * same one the emailed copy carries. Drawn in the browser rather than fetched: it is derived data,
 * so a round trip would buy nothing and fail offline.
 *
 * Only a seat somebody has paid for has a code at all, so the caller decides whether to render this.
 */
export default function SeatQr({ code, size = 104, onOpen }) {
  const canvas = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!canvas.current || !code) return
    let cancelled = false

    QRCode.toCanvas(canvas.current, code, {
      width: size,
      margin: 1,                 // a QR with no quiet zone is one a cheap scanner refuses
      errorCorrectionLevel: 'Q', // survives a smudged screen held at an angle
      color: { dark: '#17284a', light: '#ffffff' },
    }).catch(() => { if (!cancelled) setFailed(true) })

    return () => { cancelled = true }
  }, [code, size])

  // Never leave someone at the door with nothing: if the canvas fails, the code still reads.
  if (failed) {
    return (
      <div className="sq sq-failed" style={{ width: size, height: size }}>
        <span>{code}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="sq"
      onClick={onOpen}
      title="Show this pass full screen"
      aria-label={`Check-in code ${code} — tap to enlarge`}
    >
      <canvas ref={canvas} width={size} height={size} />
      <style>{SQ_CSS}</style>
    </button>
  )
}

const SQ_CSS = `
  .sq {
    display: block; padding: 5px; cursor: zoom-in;
    background: #ffffff; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
    line-height: 0; transition: var(--transition-fast);
  }
  .sq:hover { border-color: var(--navy); }
  .sq canvas { display: block; }
  .sq-failed {
    display: grid; place-items: center; text-align: center; cursor: default;
    font-family: var(--font-heading); font-size: 0.62rem; color: var(--gray-600); word-break: break-all;
  }
`

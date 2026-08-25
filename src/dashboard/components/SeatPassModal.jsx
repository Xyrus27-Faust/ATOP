import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import SeatQr from './SeatQr'
import { lguLabel } from '@/lib/lgu'
import { currentEvent, formatEventDates } from '@/lib/eventInfo'

/**
 * One delegate's pass, big enough to scan off the screen and downloadable as a card.
 *
 * Shared by the delegate's own booking page and the Secretariat's registration list: the desk
 * needs to pull up a pass for someone who arrives without theirs, and a second implementation
 * would be a second chance for the two to disagree about what a pass looks like.
 *
 * The download is composed rather than captured. Saving the bare QR canvas produced a PNG of
 * anonymous squares — whoever found it in Downloads could not tell whose it was, and neither
 * could anyone it was forwarded to.
 */
export default function SeatPassModal({ delegate, reference, onClose }) {
  const canvas = useRef(null)
  const [where, setWhere] = useState(null)
  const [event, setEvent] = useState(null)

  const code = delegate.referenceCode
  const lguCode = delegate.lguCode

  useEffect(() => {
    let cancelled = false
    if (!lguCode) { setWhere(delegate.organizationName || null); return }
    lguLabel(lguCode).then((label) => {
      if (!cancelled) setWhere(label || delegate.lguName || delegate.organizationName || null)
    })
    return () => { cancelled = true }
  }, [lguCode, delegate.lguName, delegate.organizationName])

  useEffect(() => {
    let cancelled = false
    currentEvent().then((e) => { if (!cancelled) setEvent(e) })
    return () => { cancelled = true }
  }, [])

  function download() {
    const qr = canvas.current?.querySelector('canvas')
    if (!qr) return

    const png = composePass({ qr, name: delegate.fullName, where, code, reference, event })
    const safeName = delegate.fullName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const link = document.createElement('a')
    link.href = png
    link.download = `ATOP-pass-${safeName}-${code}.png`
    link.click()
  }

  return (
    <Modal title={delegate.fullName} onClose={onClose}>
      <div className="pm" ref={canvas}>
        <SeatQr code={code} size={260} />
        <div className="pm-code">{code}</div>
        {where && <div className="pm-where">{where}</div>}
        <p className="pm-note">
          Show this at the registration desk. It admits {delegate.fullName} only, under booking {reference}.
        </p>
        <button type="button" className="dash-btn is-primary" onClick={download}>
          <i className="fas fa-download" aria-hidden="true" /> Download
        </button>
      </div>

      <style>{`
        .pm { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 4px 0 8px; }
        .pm-code {
          font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800;
          letter-spacing: 0.08em; color: var(--navy); font-variant-numeric: tabular-nums;
        }
        .pm-where { font-size: 0.92rem; font-weight: 600; color: var(--gray-700, #374151); text-align: center; }
        .pm-note { margin: 0; text-align: center; font-size: 0.86rem; color: var(--gray-600); max-width: 34ch; }
      `}</style>
    </Modal>
  )
}

/**
 * Draw the pass: event, name, where they are from, the code, and the QR itself.
 *
 * Sized at 2× and drawn in system faces on purpose — a canvas cannot rely on the app's webfonts
 * having loaded, and a pass that renders in a fallback face at the wrong size is worse than one
 * that was always going to be Helvetica.
 */
function composePass({ qr, name, where, code, reference, event }) {
  const S = 2
  const W = 620 * S
  const H = (where ? 745 : 715) * S

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')

  const NAVY = '#17284a'
  const GOLD = '#a58a3c'
  const GREY = '#5b6472'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // A navy band, so the pass reads as ATOP's at a glance rather than as a stray QR.
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, W, 96 * S)

  // Title and the where/when line both come from the event row. If it could not be fetched the
  // pass still issues — the QR is what the door reads — it just carries less on its face.
  const title = event?.name || 'ATOP National Convention'
  const dates = formatEventDates(event?.startsAt, event?.endsAt)
  const venueLine = [event?.venueName, dates].filter(Boolean).join(' · ')

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${17 * S}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`
  fitText(ctx, title.toUpperCase(), W / 2, 44 * S, W - 56 * S, 17 * S)
  if (venueLine) {
    ctx.font = `400 ${13 * S}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    fitText(ctx, venueLine, W / 2, 72 * S, W - 56 * S, 13 * S)
  }

  let y = 150 * S

  ctx.fillStyle = NAVY
  ctx.font = `800 ${32 * S}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`
  fitText(ctx, name, W / 2, y, W - 80 * S, 32 * S)
  y += 34 * S

  if (where) {
    ctx.fillStyle = GREY
    ctx.font = `600 ${18 * S}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`
    fitText(ctx, where, W / 2, y, W - 80 * S, 18 * S)
    y += 30 * S
  }

  // The QR, on its own plate so it never sits on anything but white.
  //
  // 390×2 is exactly 3× the 260px canvas on screen. Any other factor lands module edges between
  // pixels and, with smoothing off, some modules come out a pixel wider than their neighbours —
  // which is precisely the irregularity a cheap scanner gives up on.
  const qrSize = 390 * S
  const qrX = (W - qrSize) / 2
  const qrY = y + 12 * S
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#e4e7ec'
  ctx.lineWidth = 2 * S
  ctx.strokeRect(qrX - 10 * S, qrY - 10 * S, qrSize + 20 * S, qrSize + 20 * S)
  ctx.imageSmoothingEnabled = false          // keep the modules crisp when scaled up
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)

  y = qrY + qrSize + 52 * S

  ctx.fillStyle = NAVY
  ctx.font = `800 ${30 * S}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.fillText(code, W / 2, y)
  y += 34 * S

  ctx.fillStyle = GREY
  ctx.font = `400 ${14 * S}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`
  ctx.fillText(`Booking ${reference} · admits one`, W / 2, y)

  ctx.fillStyle = GOLD
  ctx.fillRect(0, H - 8 * S, W, 8 * S)

  return out.toDataURL('image/png')
}

/** Shrink a line until it fits rather than letting a long name run off the card. */
function fitText(ctx, text, x, y, maxWidth, startPx) {
  let px = startPx
  const family = ctx.font.slice(ctx.font.indexOf('px') + 3)
  const weight = ctx.font.slice(0, ctx.font.indexOf(' '))
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 1
    ctx.font = `${weight} ${px}px ${family}`
  }
  ctx.fillText(text, x, y)
}

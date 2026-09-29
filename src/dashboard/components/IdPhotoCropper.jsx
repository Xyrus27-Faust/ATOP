import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/apiClient'
import Modal from './Modal'

/**
 * Crop a photo to the square the convention ID wants, and upload it.
 *
 * <p>Every pixel is handled here rather than on the server, and that is the whole point. A modern
 * phone photo is ~5MB on the wire and ~50MB decoded; a thousand of them through the API pods would
 * be memory pressure during the exact window registration is busiest. The browser already has the
 * image decoded and the CPU is the delegate's, so it crops, downscales to {@link OUT}px and
 * re-encodes as JPEG — about 350KB whatever the camera produced — and PUTs that straight to S3 with
 * a presigned URL. The API only ever sees a key.</p>
 *
 * <p>The card is drawn alongside with the crop live inside its photo well, which is the cheapest
 * quality control there is: people fix their own bad photos when they see their face in the frame,
 * and they do not when they see a file picker. The well is a true square (measured off
 * ATOP-ID-FINAL.pdf: 300×300 at 32.5%/40.89% of the card), which is why the crop cannot be
 * optional — every phone on earth produces a 3:4 portrait, and something has to reconcile them.</p>
 */

/** What we upload. 1600px covers 300dpi up to a 5.3" photo — every plausible print size for this card. */
const OUT = 1600

/** Side of the on-screen crop square. Big enough to aim with, small enough for a phone. */
const VIEW = 264

/** Where the photo well sits on the card front, as fractions of the artwork. */
const WELL = { left: 0.3250, top: 0.4089, size: 0.4688 }

/** Refused before we even decode it. The re-encode bounds what we upload; this bounds what we read. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024

/** Width the card preview is rendered at, in CSS pixels. Shared with the well maths below. */
const IP_CARD_WIDTH = 168

export default function IdPhotoCropper({ registrationId, delegate, onClose, onSaved }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const drag = useRef(null)
  const fileInput = useRef(null)

  // The object URL has to outlive the decode: both preview panes bind it as an <img src>, and a URL
  // revoked as soon as the image decoded leaves them showing a broken icon. Held here so the
  // previous one is released when a new photo is picked, and the last one when the dialog closes.
  const objectUrl = useRef(null)
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current) }, [])

  // Cover the viewport at zoom 1, exactly like object-fit: cover, so there is never a blank edge.
  const baseScale = image ? Math.max(VIEW / image.width, VIEW / image.height) : 1
  const scale = baseScale * zoom
  const drawn = image ? { w: image.width * scale, h: image.height * scale } : { w: 0, h: 0 }

  // Keep the image covering the square. Clamping here rather than on every pointer event means a
  // zoom-out can never strand the picture half off the frame.
  const clamp = useCallback(
    (next, size) => ({
      x: Math.min(0, Math.max(VIEW - size.w, next.x)),
      y: Math.min(0, Math.max(VIEW - size.h, next.y)),
    }),
    [],
  )

  /**
   * Zoom about the middle of the frame rather than its top-left corner, so the face someone has
   * just centred stays centred. Clamped in the same pass — doing it in an effect would let a
   * zoom-out strand the picture half outside the square for one paint.
   */
  function changeZoom(next) {
    setZoom(next)
    if (!image) return

    const after = baseScale * next
    const size = { w: image.width * after, h: image.height * after }
    setOffset((o) => clamp(
      {
        x: VIEW / 2 - ((VIEW / 2 - o.x) / scale) * after,
        y: VIEW / 2 - ((VIEW / 2 - o.y) / scale) * after,
      },
      size,
    ))
  }

  function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''            // so choosing the same file twice still fires
    if (!file) return
    setError(null)

    if (file.size > MAX_INPUT_BYTES) {
      setError('That image is very large. Please choose one under 25MB.')
      return
    }

    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    const url = URL.createObjectURL(file)
    objectUrl.current = url

    const img = new Image()
    img.onload = () => {
      setImage(img)
      setZoom(1)
      // Centre it: the interesting part of a portrait is rarely in the corner.
      const s = Math.max(VIEW / img.width, VIEW / img.height)
      setOffset({ x: (VIEW - img.width * s) / 2, y: (VIEW - img.height * s) / 2 })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      objectUrl.current = null
      // Chrome cannot decode the HEIC an iPhone shoots by default, and the error is otherwise silent.
      setError('We couldn’t read that image. If it came from an iPhone, try saving it as JPEG first.')
    }
    img.src = url
  }

  function onPointerDown(e) {
    if (!image) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, from: offset }
  }

  function onPointerMove(e) {
    if (!drag.current) return
    const { startX, startY, from } = drag.current
    setOffset(clamp({ x: from.x + (e.clientX - startX), y: from.y + (e.clientY - startY) }, drawn))
  }

  function onPointerUp(e) {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId)
    drag.current = null
  }

  /** The visible square, redrawn at print size. One canvas, one encode, no server. */
  function toBlob() {
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, OUT, OUT)

    const r = OUT / VIEW
    ctx.drawImage(image, offset.x * r, offset.y * r, drawn.w * r, drawn.h * r)

    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.85))
  }

  async function save() {
    if (!image || busy) return
    setBusy(true)
    setError(null)
    try {
      const blob = await toBlob()
      const base = `/registrations/${registrationId}/delegates/${delegate.delegateId}/photo`

      // No request body: the key, the content type and the name are all the server's to choose.
      const pres = await api.post(`${base}/presign`, {}, { auth: true })

      // Straight to S3. The content type must match what was signed or S3 refuses the object.
      const res = await fetch(pres.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`)

      // Only now is it real: the server checks the object landed and is small enough.
      await api.put(base, { fileKey: pres.fileKey }, { auth: true })

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t upload that photo. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // The same crop, scaled into the well on the card. `r` is the only thing that differs.
  const wellPreview = (cardWidth) => {
    const r = (cardWidth * WELL.size) / VIEW
    return {
      width: drawn.w * r,
      height: drawn.h * r,
      transform: `translate(${offset.x * r}px, ${offset.y * r}px)`,
    }
  }

  return (
    <Modal title={`ID photo — ${delegate.fullName}`} onClose={onClose}>
      <div className="ip-wrap">
        {error && (
          <div className="ip-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!image ? (
          <div className="ip-empty">
            <i className="fas fa-camera" aria-hidden="true" />
            <p>Choose a clear photo of just this person, facing the camera.</p>
            <button type="button" className="dash-btn dash-btn-primary" onClick={() => fileInput.current?.click()}>
              Choose a photo
            </button>
            <span className="ip-hint">It gets cropped to a square for the ID — you choose which part.</span>
          </div>
        ) : (
          <div className="ip-panes">
            <div className="ip-crop">
              <div
                className="ip-view"
                style={{ width: VIEW, height: VIEW }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  style={{
                    width: drawn.w,
                    height: drawn.h,
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                  }}
                />
              </div>

              <label className="ip-zoom">
                <i className="fas fa-magnifying-glass-minus" aria-hidden="true" />
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => changeZoom(Number(e.target.value))}
                  aria-label="Zoom"
                />
                <i className="fas fa-magnifying-glass-plus" aria-hidden="true" />
              </label>

              <p className="ip-hint ip-drag-hint">Drag the photo to reposition it.</p>
            </div>

            <div className="ip-preview">
              <div className="ip-card">
                <img className="ip-card-art" src="/atop-id-front.jpg" alt="" />
                <div
                  className="ip-well"
                  style={{
                    left: `${WELL.left * 100}%`,
                    top: `${WELL.top * 100}%`,
                    width: `${WELL.size * 100}%`,
                  }}
                >
                  <img src={image.src} alt="" draggable={false} style={wellPreview(IP_CARD_WIDTH)} />
                </div>
              </div>
              <span className="ip-hint">How it will print</span>
            </div>
          </div>
        )}

        <div className="ip-actions">
          {image && (
            <button type="button" className="dash-btn" onClick={() => fileInput.current?.click()} disabled={busy}>
              Choose another
            </button>
          )}
          <span className="ip-spacer" />
          <button type="button" className="dash-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="dash-btn dash-btn-primary" onClick={save} disabled={!image || busy}>
            {busy
              ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Uploading…</>
              : 'Use this photo'}
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="ip-file"
          onChange={pick}
        />
      </div>

      <style>{ipStyles}</style>
    </Modal>
  )
}

const ipStyles = `
  .ip-wrap { display: grid; gap: 16px; }
  .ip-file { display: none; }
  .ip-hint { display: block; font-size: 0.74rem; color: var(--gray-600); line-height: 1.4; }
  .ip-error { display: flex; gap: 8px; align-items: flex-start; background: #fdeaea; color: #8a1c1c; border-radius: 8px; padding: 10px 12px; font-size: 0.85rem; }

  .ip-empty { display: grid; gap: 10px; justify-items: center; text-align: center; padding: 22px 12px; border: 1px dashed var(--gray-300); border-radius: var(--radius-lg); }
  .ip-empty i { font-size: 1.6rem; color: var(--gray-400, #9aa3b2); }
  .ip-empty p { font-size: 0.88rem; color: var(--navy); margin: 0; }

  .ip-panes { display: flex; gap: 18px; align-items: flex-start; justify-content: center; flex-wrap: wrap; }
  .ip-crop { display: grid; gap: 10px; justify-items: center; }

  .ip-view { position: relative; overflow: hidden; border-radius: 14px; background: var(--gray-100, #f1f3f7); cursor: grab; touch-action: none; box-shadow: inset 0 0 0 1px var(--gray-200); }
  .ip-view:active { cursor: grabbing; }
  .ip-view img { position: absolute; top: 0; left: 0; max-width: none; user-select: none; -webkit-user-drag: none; }

  .ip-zoom { display: flex; align-items: center; gap: 10px; width: 100%; color: var(--gray-600); font-size: 0.78rem; }
  .ip-zoom input { flex: 1; accent-color: var(--navy); }
  .ip-drag-hint { text-align: center; }

  .ip-preview { display: grid; gap: 8px; justify-items: center; }
  .ip-card { position: relative; width: ${IP_CARD_WIDTH}px; border-radius: 8px; overflow: hidden; box-shadow: 0 6px 18px rgba(15,25,46,0.18); }
  .ip-card-art { display: block; width: 100%; height: auto; }
  .ip-well { position: absolute; aspect-ratio: 1; overflow: hidden; border-radius: 6px; background: #fff; }
  .ip-well img { position: absolute; top: 0; left: 0; max-width: none; transform-origin: top left; }

  .ip-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ip-spacer { flex: 1; }

  @media (max-width: 520px) {
    .ip-panes { gap: 14px; }
    .ip-actions .dash-btn { flex: 1; justify-content: center; }
    .ip-spacer { display: none; }
  }
`

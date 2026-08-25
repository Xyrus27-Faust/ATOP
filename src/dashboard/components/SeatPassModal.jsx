import { useRef } from 'react'
import Modal from './Modal'
import SeatQr from './SeatQr'

/**
 * One delegate's pass, big enough to scan off the screen and downloadable as a PNG.
 *
 * Shared by the delegate's own booking page and the Secretariat's registration list: the desk
 * needs to pull up a pass for someone who arrives without theirs, and a second implementation
 * would be a second chance for the two to disagree about what a pass looks like.
 */
export default function SeatPassModal({ delegate, reference, onClose }) {
  const canvas = useRef(null)

  function download() {
    const png = canvas.current?.querySelector('canvas')?.toDataURL('image/png')
    if (!png) return

    // Named for a human: whoever finds this in Downloads three weeks later should know whose it is.
    const safeName = delegate.fullName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const link = document.createElement('a')
    link.href = png
    link.download = `ATOP-pass-${safeName}-${delegate.referenceCode}.png`
    link.click()
  }

  return (
    <Modal title={delegate.fullName} onClose={onClose}>
      <div className="pm" ref={canvas}>
        <SeatQr code={delegate.referenceCode} size={260} />
        <div className="pm-code">{delegate.referenceCode}</div>
        <p className="pm-note">
          Show this at the registration desk. It admits {delegate.fullName} only, under booking {reference}.
        </p>
        <button type="button" className="dash-btn is-primary" onClick={download}>
          <i className="fas fa-download" aria-hidden="true" /> Download
        </button>
      </div>

      <style>{`
        .pm { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 4px 0 8px; }
        .pm-code {
          font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800;
          letter-spacing: 0.08em; color: var(--navy); font-variant-numeric: tabular-nums;
        }
        .pm-note { margin: 0; text-align: center; font-size: 0.86rem; color: var(--gray-600); max-width: 34ch; }
      `}</style>
    </Modal>
  )
}

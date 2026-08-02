import { useEffect } from 'react'

/**
 * A centred dialog over a dimmed page. Closes on Escape or a click on the backdrop itself
 * (mousedown on the overlay, so a drag that ends outside the panel doesn't dismiss it).
 *
 * Carries its own styles so a page can drop it in without copying CSS. Three admin pages
 * (AdminAccess, AssessorAdmin, AdjudicatorAdmin) still define their own identical copy —
 * they can move over to this one whenever they're next touched.
 */
export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dash-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dash-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dash-modal-head">
          <h3>{title}</h3>
          <button type="button" className="dash-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="dash-modal-body">{children}</div>
      </div>

      <style>{`
        .dash-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(15,25,46,0.45); display: grid; place-items: center; padding: 20px; animation: dashModalFade 0.15s ease-out; }
        .dash-modal { width: 100%; max-width: 520px; background: var(--white); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg, 0 24px 60px rgba(15,25,46,0.3)); overflow: hidden; }
        .dash-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--gray-200); }
        .dash-modal-head h3 { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); }
        .dash-modal-close { display: grid; place-items: center; width: 32px; height: 32px; border: none; background: none; color: var(--gray-600); cursor: pointer; border-radius: 8px; }
        .dash-modal-close:hover { background: var(--gray-100); color: var(--navy); }
        .dash-modal-body { padding: 20px; }
        @keyframes dashModalFade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  )
}

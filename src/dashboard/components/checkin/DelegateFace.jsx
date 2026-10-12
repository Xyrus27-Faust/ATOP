import { useState } from 'react'

/**
 * The delegate's ID photo, which is what the guard checks the person against — or their initials
 * when there is no usable photo. The URL is a short-lived presigned link, so a failed load (it
 * expired while the sheet sat open) falls back to initials rather than a broken image.
 */
export default function DelegateFace({ name, photoUrl, size = 96 }) {
  const [broken, setBroken] = useState(false)
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div className="dfc" style={{ width: size, height: size }}>
      {photoUrl && !broken
        ? <img src={photoUrl} alt={`Photo of ${name}`} onError={() => setBroken(true)} />
        : <span aria-label={`No photo on file for ${name}`}>{initials}</span>}
      <style>{DFC_CSS}</style>
    </div>
  )
}

const DFC_CSS = `
  .dfc {
    flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden;
    background: var(--navy-mid); display: grid; place-items: center;
    border: 3px solid var(--white); box-shadow: var(--shadow-md);
  }
  .dfc img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .dfc span { font-family: var(--font-heading); font-weight: 800; font-size: 1.6rem; color: var(--gold-light); }
`

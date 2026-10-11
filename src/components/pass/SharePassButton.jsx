import { useEffect, useState } from 'react'

/**
 * Send one delegate their live pass. The phone's own share sheet where there is one — Messenger and
 * Viber are how a tourism office actually reaches its people — and a copied link everywhere else.
 */
export default function SharePassButton({ url, name, className = '' }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name}'s ATOP pass`,
          text: `${name}, here is your ATOP convention pass. Show it at the main gate — it welcomes you the moment you're scanned in.`,
          url,
        })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return // they closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt('Copy this link and send it to them:', url)
    }
  }

  return (
    <button type="button" className={`dash-btn ${className}`} onClick={share} aria-live="polite">
      <i className={`fas ${copied ? 'fa-check' : 'fa-share-nodes'}`} aria-hidden="true" />
      {copied ? 'Link copied' : 'Send live pass'}
    </button>
  )
}

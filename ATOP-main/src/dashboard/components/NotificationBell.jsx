import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'

const ICONS = {
  EntrySubmitted: 'fa-paper-plane',
  EntryValidated: 'fa-circle-check',
  EntryReturned: 'fa-rotate-left',
  EntryDisqualified: 'fa-circle-xmark',
}

function timeAgo(iso) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'just now'
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The dashboard bell: polls the caller's notifications, shows an unread badge,
 * and a dropdown to open one (marks it read + navigates) or mark all read.
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const [data, setData] = useState({ items: [], unreadCount: 0 })
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const load = () =>
    api.get('/notifications/', { auth: true }).then(
      (res) => setData(res || { items: [], unreadCount: 0 }),
      () => {}, // non-fatal — the bell just stays quiet
    )

  useEffect(() => {
    load()
    const t = setInterval(load, 45000)
    return () => clearInterval(t)
  }, [])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  function toggle() {
    setOpen((o) => {
      if (!o) load() // refresh on open
      return !o
    })
  }

  function openItem(n) {
    setOpen(false)
    if (!n.isRead) {
      setData((d) => ({
        items: d.items.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)),
        unreadCount: Math.max(0, d.unreadCount - 1),
      }))
      api.post(`/notifications/${n.id}/read`, undefined, { auth: true }).catch(() => {})
    }
    if (n.link) navigate(n.link)
  }

  function markAll() {
    setData((d) => ({ items: d.items.map((i) => ({ ...i, isRead: true })), unreadCount: 0 }))
    api.post('/notifications/read-all', undefined, { auth: true }).catch(() => {})
  }

  const { items, unreadCount } = data

  return (
    <div className="nb" ref={rootRef}>
      <button
        type="button"
        className="nb-btn"
        onClick={toggle}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <i className="fas fa-bell" aria-hidden="true" />
        {unreadCount > 0 && <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="nb-panel">
          <div className="nb-head">
            <span>Notifications</span>
            {unreadCount > 0 && <button type="button" className="nb-readall" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="nb-list">
            {items.length === 0 ? (
              <div className="nb-empty"><i className="far fa-bell" aria-hidden="true" /><p>You’re all caught up.</p></div>
            ) : (
              items.map((n) => (
                <button type="button" key={n.id} className={`nb-item${n.isRead ? '' : ' is-unread'}`} onClick={() => openItem(n)}>
                  <span className="nb-item-icon"><i className={`fas ${ICONS[n.type] || 'fa-bell'}`} aria-hidden="true" /></span>
                  <span className="nb-item-body">
                    <span className="nb-item-title">{n.title}</span>
                    <span className="nb-item-text">{n.body}</span>
                    <span className="nb-item-time">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.isRead && <span className="nb-dot" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <style>{NB_CSS}</style>
    </div>
  )
}

const NB_CSS = `
  .nb { position: relative; }
  .nb-btn { position: relative; background: none; border: none; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--gray-600); font-size: 1.05rem; transition: var(--transition-fast); }
  .nb-btn:hover { background: var(--gray-100); color: var(--navy); }
  .nb-badge { position: absolute; top: 3px; right: 3px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: #DC2626; color: #fff; font-family: var(--font-heading); font-size: 0.62rem; font-weight: 800; display: grid; place-items: center; box-shadow: 0 0 0 2px rgba(255,255,255,0.95); }
  .nb-panel { position: absolute; top: calc(100% + 10px); right: 0; width: 360px; max-width: calc(100vw - 32px); background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: 0 20px 50px rgba(15,25,46,0.25); overflow: hidden; z-index: 40; animation: nb-in 0.16s ease-out; }
  .nb-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--gray-100); font-family: var(--font-heading); font-weight: 800; font-size: 0.84rem; color: var(--navy); }
  .nb-readall { background: none; border: none; cursor: pointer; color: var(--gold-dark); font-family: var(--font-heading); font-weight: 700; font-size: 0.74rem; }
  .nb-readall:hover { color: var(--navy); text-decoration: underline; }
  .nb-list { max-height: 400px; overflow-y: auto; }
  .nb-item { display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left; padding: 13px 16px; background: none; border: none; border-bottom: 1px solid var(--gray-100); cursor: pointer; transition: var(--transition-fast); }
  .nb-item:last-child { border-bottom: none; }
  .nb-item:hover { background: var(--off-white); }
  .nb-item.is-unread { background: rgba(200,168,75,0.07); }
  .nb-item-icon { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: rgba(200,168,75,0.12); color: var(--gold-dark); font-size: 0.8rem; }
  .nb-item-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .nb-item-title { font-family: var(--font-heading); font-weight: 700; font-size: 0.84rem; color: var(--navy); }
  .nb-item-text { font-size: 0.8rem; color: var(--gray-600); line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .nb-item-time { font-size: 0.7rem; color: var(--gray-400); font-family: var(--font-heading); font-weight: 600; margin-top: 2px; }
  .nb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--gold); flex-shrink: 0; margin-top: 6px; }
  .nb-empty { text-align: center; padding: 34px 20px; color: var(--gray-400); }
  .nb-empty i { font-size: 1.7rem; margin-bottom: 10px; }
  .nb-empty p { font-size: 0.84rem; }
  @keyframes nb-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 480px) { .nb-panel { position: fixed; top: 58px; right: 12px; left: 12px; width: auto; } }
`

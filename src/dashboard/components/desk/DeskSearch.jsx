import { useEffect, useRef, useState } from 'react'
import { SEARCH_MIN_CHARS } from '@/lib/checkin'

// Long enough that typing "dela cruz" sends one request, not nine.
const DEBOUNCE_MS = 350

/**
 * Find a delegate when their badge won't scan — at the desk or at the main gate ({@code search} is
 * deskSearch or gateSearch, {@code post} names the place in the header). Picking a row never checks
 * anyone in by itself: the desk opens their card, the gate asks for a Confirm tap. The list shows no
 * photos — it's ten strangers' faces to whoever is in the queue.
 *
 * <p>Someone who never paid has no QR at all, so they are listed too, last and tagged No seat:
 * picking them says why and where to send them.</p>
 */
export default function DeskSearch({ eventId, search, post, onPick, onClose }) {
  const [q, setQ] = useState('')
  // The last answer, tagged with the term it answers, so anything stale is read off at render.
  const [answer, setAnswer] = useState({ term: null, error: null, rows: null })
  const input = useRef(null)
  const term = q.trim()
  const searchable = term.length >= SEARCH_MIN_CHARS

  useEffect(() => { input.current?.focus() }, [])

  useEffect(() => {
    if (!searchable) return undefined
    let active = true
    const t = setTimeout(() => {
      search(eventId, term).then(
        (rows) => { if (active) setAnswer({ term, error: null, rows }) },
        (error) => { if (active) setAnswer({ term, error, rows: null }) },
      )
    }, DEBOUNCE_MS)
    return () => { active = false; clearTimeout(t) }
  }, [eventId, term, searchable, search])

  const current = searchable && answer.term === term
  const loading = searchable && !current
  const rows = current ? answer.rows : null
  const error = current ? answer.error : null

  return (
    <div className="dsr">
      <div className="dsr-head">
        <button type="button" className="dsr-back" onClick={onClose} aria-label="Back to the camera">
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <span>Search · {post}</span>
      </div>

      <div className="dsr-field">
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          ref={input}
          className="dsr-input"
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Name or reference code"
          aria-label="Search delegates by name or reference code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="dsr-body" aria-live="polite">
        {!searchable && <p className="dsr-hint">Type at least {SEARCH_MIN_CHARS} letters of a name.</p>}
        {loading && <p className="dsr-hint"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Searching…</p>}
        {error && (
          <div className="dash-banner tone-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{error.message}</span>
          </div>
        )}
        {rows?.length === 0 && (
          <p className="dsr-hint">
            No in-person delegate matches &ldquo;{term}&rdquo;. Check the spelling, or try the reference code
            on their pass. If they aren&rsquo;t booked at all, send them to Desk B.
          </p>
        )}
        {rows?.length > 0 && (
          <ul className="dsr-list">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="dsr-row" onClick={() => onPick(r)}>
                  <span className="dsr-row-main">
                    <strong>{r.fullName}</strong>
                    <span>{[r.lgu, r.designation].filter(Boolean).join(' · ')}</span>
                  </span>
                  {r.noSeat
                    ? <span className="dash-badge tone-danger">No seat</span>
                    : r.checkedIn
                      ? <span className="dash-badge tone-success">Checked in</span>
                      : <i className="fas fa-chevron-right" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{DSR_CSS}</style>
    </div>
  )
}

const DSR_CSS = `
  .dsr { display: flex; flex-direction: column; flex: 1; background: var(--off-white); }
  .dsr-head {
    display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--white);
    border-bottom: 1px solid var(--gray-200); font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; color: var(--navy);
  }
  .dsr-back {
    width: 48px; height: 48px; flex-shrink: 0; display: grid; place-items: center; border: 0; background: transparent;
    color: var(--navy); font-size: 1.1rem; cursor: pointer; border-radius: var(--radius-sm);
  }
  .dsr-back:hover { background: var(--gray-100); }
  .dsr-field { position: relative; padding: 12px 16px; background: var(--white); border-bottom: 1px solid var(--gray-200); }
  .dsr-field i { position: absolute; left: 32px; top: 50%; transform: translateY(-50%); color: var(--gray-400); }
  /* 16px or iOS zooms the page when the field takes focus. */
  .dsr-input {
    width: 100%; min-height: 52px; padding: 0 14px 0 44px; font-size: 16px; font-family: var(--font-body);
    border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); background: var(--white); color: var(--gray-800);
  }
  .dsr-input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,168,75,0.2); }
  .dsr-body { flex: 1; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
  .dsr-hint { font-family: var(--font-body); font-size: 0.92rem; color: var(--gray-600); line-height: 1.55; padding: 8px 2px; }
  .dsr-list { list-style: none; margin: 0; padding: 0; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); overflow: hidden; }
  .dsr-list li + li { border-top: 1px solid var(--gray-200); }
  .dsr-row {
    width: 100%; min-height: 60px; display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    border: 0; background: transparent; text-align: left; cursor: pointer; color: var(--gray-400);
  }
  .dsr-row:hover, .dsr-row:focus-visible { background: rgba(200,168,75,0.08); }
  .dsr-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .dsr-row-main strong { font-family: var(--font-heading); font-weight: 700; font-size: 0.98rem; color: var(--navy); }
  .dsr-row-main span { font-family: var(--font-body); font-size: 0.82rem; color: var(--gray-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (min-width: 640px) {
    .dsr-field, .dsr-body { padding-left: calc(50% - 280px); padding-right: calc(50% - 280px); }
    .dsr-field i { left: calc(50% - 264px); }
  }
`

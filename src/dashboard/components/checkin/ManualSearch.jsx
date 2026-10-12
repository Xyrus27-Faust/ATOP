import { useEffect, useRef, useState } from 'react'
import DelegateFace from './DelegateFace'
import {
  searchDelegates, getDelegate, logManually, formatVenueTime, isPostGone, SEARCH_MIN_CHARS, NOTE_MAX,
} from '@/lib/checkin'

// Long enough that typing "dela cruz" sends one request, not nine.
const DEBOUNCE_MS = 350

/**
 * The fallback when a badge won't scan — a cracked screen, a photocopied QR, a camera the browser
 * won't open. The guard finds the delegate by name or reference code and logs them by hand.
 *
 * <p>Two taps, deliberately: the list has no photos (it's ten strangers' faces to anyone looking
 * over the guard's shoulder), so picking a row opens a confirm card with the one photo that
 * matters, and only then does the gold button log the scan. Logging runs the same checks as the
 * camera — a manual entry can't let in someone a scan would have refused.</p>
 */
export default function ManualSearch({ checkpoint, onResult, onClose, onGone }) {
  const [q, setQ] = useState('')
  // The last answer, tagged with the term it answers. Anything tagged with another term is stale, so
  // "searching" and "too short" are read off at render instead of being stored and kept in sync.
  const [answer, setAnswer] = useState({ term: null, error: null, rows: null })
  const [picked, setPicked] = useState(null)
  const input = useRef(null)
  const term = q.trim()

  useEffect(() => { input.current?.focus() }, [])

  const searchable = term.length >= SEARCH_MIN_CHARS
  useEffect(() => {
    if (!searchable) return undefined
    let active = true
    const t = setTimeout(() => {
      searchDelegates(checkpoint.id, term).then(
        (rows) => { if (active) setAnswer({ term, error: null, rows }) },
        (error) => { if (active) setAnswer({ term, error, rows: null }) },
      )
    }, DEBOUNCE_MS)
    return () => { active = false; clearTimeout(t) }
  }, [checkpoint.id, term, searchable])

  const current = searchable && answer.term === term
  const search = {
    loading: searchable && !current,
    error: current ? answer.error : null,
    rows: current ? answer.rows : null,
  }

  if (picked) {
    return (
      <ConfirmCard
        checkpoint={checkpoint}
        row={picked}
        onBack={() => setPicked(null)}
        onResult={onResult}
      />
    )
  }

  return (
    <div className="msr">
      <div className="msr-head">
        <button type="button" className="msr-back" onClick={onClose} aria-label="Back to the camera">
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <span>Search · {checkpoint.label}</span>
      </div>

      <div className="msr-field">
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          ref={input}
          className="msr-input"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Name or reference code"
          aria-label="Search delegates by name or reference code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="msr-body" aria-live="polite">
        {!searchable && (
          <p className="msr-hint">Type at least {SEARCH_MIN_CHARS} letters of a name.</p>
        )}
        {search.loading && <p className="msr-hint"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Searching…</p>}
        {search.error && (
          <div className="dash-banner tone-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{search.error.message}</span>
          </div>
        )}
        {isPostGone(search.error?.raw?.reasonCode) && (
          <button type="button" className="dash-btn is-primary msr-gone" onClick={onGone}>
            <i className="fas fa-list" aria-hidden="true" /> Pick a checkpoint
          </button>
        )}
        {!search.loading && search.rows?.length === 0 && (
          <p className="msr-hint">
            No in-person delegate with a confirmed booking matches &ldquo;{term}&rdquo;. Check the
            spelling, or send them to the Secretariat desk.
          </p>
        )}
        {!search.loading && search.rows?.length > 0 && (
          <ul className="msr-list">
            {search.rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="msr-row" onClick={() => setPicked(r)}>
                  <span className="msr-row-main">
                    <strong>{r.fullName}</strong>
                    <span>{[r.lgu, r.designation].filter(Boolean).join(' · ')}</span>
                  </span>
                  {r.scannedAt
                    ? <span className="dash-badge tone-success">{formatVenueTime(r.scannedAt)}</span>
                    : <i className="fas fa-chevron-right" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{MSR_CSS}</style>
    </div>
  )
}

function ConfirmCard({ checkpoint, row, onBack, onResult }) {
  const [detail, setDetail] = useState({ loading: true, error: null, data: null })
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getDelegate(checkpoint.id, row.id).then(
      (data) => { if (active) setDetail({ loading: false, error: null, data }) },
      (err) => { if (active) setDetail({ loading: false, error: err, data: null }) },
    )
    return () => { active = false }
  }, [checkpoint.id, row.id])

  async function log() {
    setSaving(true)
    setError(null)
    try {
      onResult(await logManually(checkpoint.id, row.id, note.trim()))
    } catch (err) {
      // Stay on the card: the guard still has the person in front of them and can try again.
      setError(err)
      setSaving(false)
    }
  }

  // The photo is a nice-to-have on this step; failing to load it must not block logging the person.
  const person = detail.data || row

  return (
    <div className="msr">
      <div className="msr-head">
        <button type="button" className="msr-back" onClick={onBack} aria-label="Back to the search results">
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <span>Confirm · {checkpoint.label}</span>
      </div>

      <div className="msr-body">
        <div className="dash-card dash-card-pad msr-confirm">
          {detail.loading
            ? <div className="msr-face-wait"><i className="fas fa-spinner fa-spin" aria-hidden="true" /></div>
            : <DelegateFace name={person.fullName} photoUrl={person.photoUrl} size={120} />}
          <strong>{person.fullName}</strong>
          <span>{[person.designation, person.lgu].filter(Boolean).join(' · ')}</span>
          <p className="dash-help">Check the face against the person before logging.</p>
        </div>

        <label className="dash-field msr-note">
          <span className="dash-label">Note <span className="msr-opt">(optional)</span></span>
          <input
            className="dash-input"
            maxLength={NOTE_MAX}
            placeholder="e.g. QR on a cracked screen"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {error && (
          <div className="dash-banner tone-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{error.message}</span>
          </div>
        )}
      </div>

      <div className="msr-foot">
        {/* Held while the photo loads: on slow Wi-Fi the face is the only check on this path, and
            a tap before it arrives would skip it. A photo that fails to load doesn't hold it. */}
        <button type="button" className="dash-btn is-primary msr-log" onClick={log} disabled={saving || detail.loading}>
          {saving
            ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Logging…</>
            : <><i className="fas fa-check" aria-hidden="true" /> Log {checkpoint.label}</>}
        </button>
      </div>
      <style>{MSR_CSS}</style>
    </div>
  )
}

const MSR_CSS = `
  .msr { display: flex; flex-direction: column; min-height: 100%; flex: 1; background: var(--off-white); }
  .msr-head {
    display: flex; align-items: center; gap: 6px; padding: 8px 12px;
    background: var(--white); border-bottom: 1px solid var(--gray-200);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; color: var(--navy);
  }
  .msr-head > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .msr-gone { width: 100%; min-height: 48px; margin-top: 10px; }
  .msr-back {
    width: 48px; height: 48px; flex-shrink: 0; display: grid; place-items: center;
    border: 0; background: transparent; color: var(--navy); font-size: 1.1rem; cursor: pointer; border-radius: var(--radius-sm);
  }
  .msr-back:hover { background: var(--gray-100); }

  .msr-field { position: relative; padding: 12px 16px; background: var(--white); border-bottom: 1px solid var(--gray-200); }
  .msr-field i { position: absolute; left: 32px; top: 50%; transform: translateY(-50%); color: var(--gray-400); }
  /* 16px or iOS zooms the page when the field takes focus. */
  .msr-input {
    width: 100%; min-height: 52px; padding: 0 14px 0 44px; font-size: 16px; font-family: var(--font-body);
    border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); background: var(--white); color: var(--gray-800);
  }
  .msr-input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,168,75,0.2); }

  .msr-body { flex: 1; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
  .msr-hint { font-family: var(--font-body); font-size: 0.92rem; color: var(--gray-600); line-height: 1.55; padding: 8px 2px; }

  .msr-list { list-style: none; margin: 0; padding: 0; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); overflow: hidden; }
  .msr-list li + li { border-top: 1px solid var(--gray-200); }
  .msr-row {
    width: 100%; min-height: 60px; display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    border: 0; background: transparent; text-align: left; cursor: pointer; color: var(--gray-400);
  }
  .msr-row:hover, .msr-row:focus-visible { background: rgba(200,168,75,0.08); }
  .msr-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .msr-row-main strong { font-family: var(--font-heading); font-weight: 700; font-size: 0.98rem; color: var(--navy); }
  .msr-row-main span { font-family: var(--font-body); font-size: 0.82rem; color: var(--gray-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .msr-confirm { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .msr-confirm strong { font-family: var(--font-heading); font-weight: 800; font-size: 1.2rem; color: var(--navy); text-transform: uppercase; margin-top: 6px; }
  .msr-confirm > span { font-family: var(--font-body); font-size: 0.9rem; color: var(--gray-600); }
  .msr-face-wait { width: 120px; height: 120px; display: grid; place-items: center; color: var(--gold-dark); font-size: 1.4rem; }
  .msr-note .dash-input { font-size: 16px; min-height: 48px; }
  .msr-opt { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--gray-400); }

  .msr-foot {
    position: sticky; bottom: 0; padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: var(--white); border-top: 1px solid var(--gray-200);
  }
  .msr-log { width: 100%; min-height: 56px; justify-content: center; font-size: 1rem; }

  @media (min-width: 640px) {
    .msr-field, .msr-body, .msr-foot { padding-left: calc(50% - 280px); padding-right: calc(50% - 280px); }
    .msr-field i { left: calc(50% - 264px); }
  }
`

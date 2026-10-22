import { useCallback, useEffect, useState } from 'react'
import { getBusList, formatVenueTime } from '@/lib/checkin'

/**
 * A bus's list, for the marshal at its door (ATOP, 2026-10-21): everyone booked on it, the ones not on
 * board yet first, so heads can be cross-checked before the bus leaves and again before the ride back.
 *
 * <p>Read-only. Someone on the list who is standing there gets scanned and boarded as usual; someone
 * who boarded but was never scanned is the secretariat's Mark attended, not a tap here. Names and LGU
 * only — the list is held up in a crowd.</p>
 */
export default function BusList({ checkpoint, onClose }) {
  // The last answer, tagged with the refresh it answers: "loading" is read off at render, as in
  // ManualSearch, rather than stored. A failed refresh keeps the last list on screen under the error.
  const [turn, setTurn] = useState(0)
  const [answer, setAnswer] = useState({ turn: -1, error: null, rows: null })
  const refresh = useCallback(() => setTurn((t) => t + 1), [])

  useEffect(() => {
    let active = true
    getBusList(checkpoint.id).then(
      (rows) => { if (active) setAnswer({ turn, error: null, rows }) },
      (error) => { if (active) setAnswer((a) => ({ turn, error, rows: a.rows })) },
    )
    return () => { active = false }
  }, [checkpoint.id, turn])

  const state = { loading: answer.turn !== turn, error: answer.error, rows: answer.rows }

  const rows = state.rows || []
  const waiting = rows.filter((r) => !r.boardedAt)
  const boarded = rows.filter((r) => r.boardedAt)

  return (
    <div className="bsl">
      <div className="bsl-head">
        <button type="button" className="bsl-back" onClick={onClose} aria-label="Back to the camera">
          <i className="fas fa-arrow-left" aria-hidden="true" />
        </button>
        <span>Bus list · {checkpoint.label}</span>
        <button type="button" className="bsl-refresh" onClick={refresh} disabled={state.loading} aria-label="Refresh the list">
          <i className={`fas fa-rotate-right${state.loading ? ' fa-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <div className="bsl-body" aria-live="polite">
        {state.error && (
          <div className="dash-banner tone-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{state.error.message}</span>
          </div>
        )}
        {state.loading && !state.rows && (
          <p className="bsl-hint"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading the list…</p>
        )}

        {state.rows && (
          <p className="bsl-sum">
            <strong>{boarded.length}</strong> of {rows.length} on board
            {waiting.length > 0 && <> · <strong className="is-wait">{waiting.length}</strong> not yet</>}
          </p>
        )}
        {state.rows && rows.length === 0 && (
          <p className="bsl-hint">Nobody is booked on this bus yet.</p>
        )}

        {waiting.length > 0 && (
          <section>
            <h2 className="bsl-group">Not on board yet</h2>
            <ul className="bsl-list">
              {waiting.map((r) => <Row key={r.delegateId} row={r} />)}
            </ul>
          </section>
        )}
        {boarded.length > 0 && (
          <section>
            <h2 className="bsl-group">On board</h2>
            <ul className="bsl-list">
              {boarded.map((r) => <Row key={r.delegateId} row={r} />)}
            </ul>
          </section>
        )}
      </div>
      <style>{BSL_CSS}</style>
    </div>
  )
}

function Row({ row }) {
  return (
    <li className="bsl-row">
      <span className="bsl-row-main">
        <strong>{row.fullName}</strong>
        <span>{[row.lgu, row.designation].filter(Boolean).join(' · ')}</span>
      </span>
      {row.boardedAt
        ? <span className="dash-badge tone-success"><i className="fas fa-check" aria-hidden="true" /> {formatVenueTime(row.boardedAt)}</span>
        : !row.checkedIn && <span className="dash-badge tone-neutral">Not checked in</span>}
    </li>
  )
}

const BSL_CSS = `
  .bsl { display: flex; flex-direction: column; min-height: 100%; flex: 1; background: var(--off-white); }
  .bsl-head {
    display: flex; align-items: center; gap: 6px; padding: 8px 12px;
    background: var(--white); border-bottom: 1px solid var(--gray-200);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; color: var(--navy);
  }
  .bsl-head > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bsl-back, .bsl-refresh {
    width: 48px; height: 48px; flex-shrink: 0; display: grid; place-items: center;
    border: 0; background: transparent; color: var(--navy); font-size: 1.1rem; cursor: pointer; border-radius: var(--radius-sm);
  }
  .bsl-back:hover, .bsl-refresh:hover { background: var(--gray-100); }

  .bsl-body { flex: 1; padding: 12px 16px 32px; display: flex; flex-direction: column; gap: 14px; }
  .bsl-hint { font-family: var(--font-body); font-size: 0.92rem; color: var(--gray-600); line-height: 1.55; padding: 8px 2px; }
  .bsl-sum { font-family: var(--font-body); font-size: 0.95rem; color: var(--gray-600); }
  .bsl-sum strong { font-family: var(--font-heading); font-size: 1.15rem; color: var(--navy); }
  .bsl-sum strong.is-wait { color: var(--gold-dark); }
  .bsl-group {
    font-family: var(--font-heading); font-weight: 800; font-size: 0.74rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--gold-dark); margin-bottom: 8px;
  }

  .bsl-list { list-style: none; margin: 0; padding: 0; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); overflow: hidden; }
  .bsl-list li + li { border-top: 1px solid var(--gray-200); }
  .bsl-row { min-height: 56px; display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
  .bsl-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .bsl-row-main strong { font-family: var(--font-heading); font-weight: 700; font-size: 0.98rem; color: var(--navy); }
  .bsl-row-main span { font-family: var(--font-body); font-size: 0.82rem; color: var(--gray-600); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bsl-row .dash-badge { flex-shrink: 0; }
`

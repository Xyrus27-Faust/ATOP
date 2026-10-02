import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCheckpointScans, updateCheckpoint, voidScan, formatDay, formatVenueTime, kindMeta, stateMeta, progressPct, REASON_MAX } from '@/lib/checkin'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'

// Case- and accent-blind, so "pena" finds "Peña" and "QUEZON" finds "Quezon City".
const fold = (text) => (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * One checkpoint's log: who was scanned, when, by which marshal — newest first — and the escape hatch
 * for a wrong scan. Voiding keeps a copy with the reason and frees the slot, so the right person can
 * then be scanned; the voids list below the log is the paper trail.
 *
 * <p>The search narrows the log by name or LGU ("did anyone from Tacloban eat?") in the browser: the
 * page already holds every scan for this checkpoint. Print turns whatever is showing into a paper
 * list — the browser's print dialog saves it as a PDF.</p>
 */
export default function CheckpointDetailPage() {
  const { id } = useParams()
  const { loading, error, data, reload } = useAsync(() => getCheckpointScans(id), [id])
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState(null)
  const [q, setQ] = useState('')

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { checkpoint: c, scans, voids } = data
  const kind = kindMeta(c.kind)
  const state = stateMeta(c.state)
  const pct = progressPct(c.scanCount, c.expected)
  const term = fold(q.trim())
  const shown = term ? scans.filter((s) => fold(s.fullName).includes(term) || fold(s.lgu).includes(term)) : scans

  async function toggle() {
    setToggling(true)
    setToggleError(null)
    try {
      await updateCheckpoint(c.id, { isActive: !c.isActive })
      reload()
    } catch (err) {
      setToggleError(err.message)
    }
    setToggling(false)
  }

  return (
    <>
      <div className="ckd-screen">
      <div className="dash-page-head">
        <div>
          <Link to="/dashboard/admin/checkpoints" className="dash-btn is-ghost is-sm ckd-back">
            <i className="fas fa-arrow-left" aria-hidden="true" /> Checkpoints
          </Link>
          <span className="dash-eyebrow">
            <i className={`fas ${kind.icon}`} aria-hidden="true" /> {kind.label} · {formatDay(c.day)}
          </span>
          <h1 className="dash-h1">{c.label}</h1>
        </div>
      </div>

      <section className="dash-card dash-card-pad ckd-summary">
        <div className="ckd-count">
          <span><b>{c.scanCount}</b> / {c.expected} {c.kind === 'Meal' ? 'claimed' : 'entered'}</span>
          <span className="ckd-pct">{pct}%</span>
        </div>
        <div className="dash-meter" aria-hidden="true">
          <div className={`dash-meter-fill${pct >= 100 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="ckd-state">
          <span className={`dash-badge ${state.tone}`}>{state.detail}</span>
          {state.canToggle && (
            <button type="button" className={`dash-btn is-sm ${c.isActive ? 'is-ghost' : 'is-primary'}`} onClick={toggle} disabled={toggling}>
              {toggling
                ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                : <i className={`fas ${c.isActive ? 'fa-lock' : 'fa-lock-open'}`} aria-hidden="true" />}
              {' '}{c.isActive ? 'Close checkpoint' : 'Reopen checkpoint'}
            </button>
          )}
        </div>
        {toggleError && (
          <div className="dash-banner tone-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{toggleError}</span>
          </div>
        )}
      </section>

      <div className="ckd-head">
        <h2>Scan log</h2>
        <div className="ckd-head-actions">
          <button type="button" className="dash-btn is-ghost is-sm" onClick={reload} disabled={loading}>
            <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
          <button type="button" className="dash-btn is-ghost is-sm" onClick={() => window.print()} disabled={shown.length === 0}>
            <i className="fas fa-print" aria-hidden="true" /> Print / PDF
          </button>
        </div>
      </div>

      {scans.length > 0 && (
        <div className="ckd-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="dash-input"
            type="search"
            autoComplete="off"
            placeholder="Search name or LGU"
            aria-label="Search the scan log by name or LGU"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      {term && scans.length > 0 && (
        <p className="ckd-filtered" aria-live="polite">
          {shown.length} of {scans.length} match &ldquo;{q.trim()}&rdquo;
        </p>
      )}

      {scans.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>No one scanned here yet.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>No one scanned here matches &ldquo;{q.trim()}&rdquo;.</p>
        </div>
      ) : (
        <ul className="dash-card ckd-list">
          {shown.map((s) => <ScanRow key={s.id} scan={s} onVoided={reload} />)}
        </ul>
      )}

      {voids.length > 0 && (
        <>
          <div className="ckd-head"><h2>Voided scans</h2></div>
          <ul className="dash-card ckd-list is-voids">
            {voids.map((v) => (
              <li key={`${v.id}-${v.voidedAt}`} className="ckd-row">
                <div className="ckd-row-main">
                  <strong>{v.fullName}</strong>
                  <span>
                    Scanned {formatVenueTime(v.scannedAt)} · voided {formatVenueTime(v.voidedAt)} by {v.voidedBy}
                  </span>
                  <span className="ckd-note">&ldquo;{v.reason}&rdquo;</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      </div>
      <PrintSheet checkpoint={c} scans={shown} total={scans.length} query={q.trim()} />
      <style>{CKD_CSS}</style>
    </>
  )
}

/**
 * The paper version, only rendered by the printer. Grouped by LGU then name rather than by time:
 * on paper the question is "who from where", and a secretariat ticking off a delegation reads down
 * one LGU at a time. Voided scans are left off — they don't count, and the screen keeps their trail.
 */
function PrintSheet({ checkpoint: c, scans, total, query }) {
  const rows = [...scans].sort((a, b) =>
    (a.lgu || '\uffff').localeCompare(b.lgu || '\uffff') || a.fullName.localeCompare(b.fullName))
  const printedAt = new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  })

  return (
    <section className="ckd-print" aria-hidden="true">
      <header className="ckd-print-head">
        <h1>{c.label}</h1>
        <p>
          {kindMeta(c.kind).label} · {formatDay(c.day)} · <b>{c.scanCount}</b> of {c.expected}{' '}
          {c.kind === 'Meal' ? 'claimed' : 'entered'}
        </p>
        {query && <p>Showing {scans.length} of {total} matching &ldquo;{query}&rdquo;</p>}
        <p className="ckd-print-stamp">Printed {printedAt} (Manila)</p>
      </header>
      <table>
        <thead>
          <tr><th>#</th><th>Name</th><th>LGU / Organisation</th><th>Time</th><th>Scanned by</th></tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td>{s.fullName}{s.method === 'Manual' ? ' (manual)' : ''}</td>
              <td>{s.lgu || '—'}</td>
              <td>{formatVenueTime(s.scannedAt)}</td>
              <td>{s.scannedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ScanRow({ scan: s, onVoided }) {
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Say why — it goes in the record.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await voidScan(s.id, reason.trim())
      onVoided()
    } catch (err) {
      setError(err.fieldErrors?.reason?.[0] || err.message)
      setSaving(false)
    }
  }

  return (
    <li className="ckd-row">
      <div className="ckd-row-top">
        <div className="ckd-row-main">
          <strong>
            {s.fullName}
            {s.method === 'Manual' && <span className="dash-badge tone-warn ckd-chip">Manual</span>}
          </strong>
          <span>{[s.lgu, `${formatVenueTime(s.scannedAt)} by ${s.scannedBy}`].filter(Boolean).join(' · ')}</span>
          {s.note && <span className="ckd-note">&ldquo;{s.note}&rdquo;</span>}
        </div>
        {!confirming && (
          <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setConfirming(true)}>Void</button>
        )}
      </div>

      {confirming && (
        <form className="ckd-void" onSubmit={submit} noValidate>
          <label className="dash-label" htmlFor={`reason-${s.id}`}>Why void this scan?</label>
          <input
            id={`reason-${s.id}`}
            className={`dash-input${error ? ' has-error' : ''}`}
            maxLength={REASON_MAX}
            placeholder="e.g. Scanned the wrong badge"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(null) }}
            autoFocus
          />
          {error && <span className="dash-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}</span>}
          <div className="ckd-void-actions">
            <button type="button" className="dash-btn is-ghost is-sm" onClick={() => { setConfirming(false); setReason(''); setError(null) }} disabled={saving}>
              Keep
            </button>
            <button type="submit" className="dash-btn is-danger is-sm" disabled={saving}>
              {saving ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-ban" aria-hidden="true" />} Void scan
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

const CKD_CSS = `
  .dash-btn.ckd-back { display: flex; width: fit-content; margin-bottom: 12px; }
  .ckd-summary { display: flex; flex-direction: column; gap: 12px; margin-bottom: 22px; }
  .ckd-count { display: flex; justify-content: space-between; align-items: baseline; color: var(--gray-600); font-family: var(--font-body); }
  .ckd-count b { font-family: var(--font-heading); font-size: 1.6rem; color: var(--navy); }
  .ckd-pct { font-family: var(--font-heading); font-weight: 700; color: var(--gold-dark); }
  .ckd-state { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }

  .ckd-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; margin: 6px 0 10px; }
  .ckd-head h2 { font-family: var(--font-heading); font-weight: 800; font-size: 1rem; color: var(--navy); white-space: nowrap; }
  .ckd-head-actions { display: flex; gap: 8px; }
  .ckd-head-actions .dash-btn { white-space: nowrap; }

  .ckd-search { position: relative; margin-bottom: 10px; }
  .ckd-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
  .ckd-search .dash-input { padding-left: 36px; min-height: 44px; font-size: 16px; }
  .ckd-filtered { font-family: var(--font-body); font-size: 0.85rem; color: var(--gray-600); margin: 0 2px 10px; }

  .ckd-list { list-style: none; margin: 0 0 22px; padding: 0; overflow: hidden; }
  .ckd-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
  .ckd-row + .ckd-row { border-top: 1px solid var(--gray-200); }
  .ckd-row-top { display: flex; align-items: flex-start; gap: 10px; }
  .ckd-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .ckd-row-main strong { font-family: var(--font-heading); font-weight: 700; color: var(--navy); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .ckd-row-main > span { font-family: var(--font-body); font-size: 0.85rem; color: var(--gray-600); }
  .ckd-note { font-style: italic; }
  .ckd-chip { font-size: 0.68rem; }
  .ckd-list.is-voids .ckd-row-main strong { text-decoration: line-through; color: var(--gray-600); }

  .ckd-void { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: var(--radius-sm); background: var(--bad-bg); }
  .ckd-void .dash-input { font-size: 16px; min-height: 44px; }
  .ckd-void-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .ckd-void-actions .dash-btn { min-height: 40px; }

  .ckd-print { display: none; }
  @media print {
    .dash-sidebar, .dash-topbar, .ckd-screen { display: none !important; }
    .dash-content { padding: 0; max-width: none; }
    .dash-content > * { animation: none; }
    .ckd-print { display: block; color: #000; font-family: var(--font-body); }
    .ckd-print-head { margin-bottom: 14px; }
    .ckd-print-head h1 { font-family: var(--font-heading); font-size: 18pt; font-weight: 800; margin: 0 0 4px; }
    .ckd-print-head p { font-size: 10pt; margin: 2px 0; }
    .ckd-print-stamp { color: #555; }
    .ckd-print table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .ckd-print th, .ckd-print td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
    .ckd-print th { background: #eee; }
    .ckd-print thead { display: table-header-group; }
    .ckd-print tr { break-inside: avoid; }
  }
`

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { REGIONS, labelFor } from '@/lib/pearlAwards'
import Modal from './Modal'

const POLL_MS = 4000

const regionName = (code) => (code === 'NoRegion' ? 'No region' : labelFor(REGIONS, code))

const startedAt = (iso) =>
  new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * ID card print runs. The cards are drawn off the API by the print-run Lambda — a thousand cards
 * with photos is too much for the API to draw in one request — so this starts a run, then watches
 * it: one row per region, and once a region is done, a zip per LGU (a PDF per delegate inside) and
 * the region's combined PDF, every card front then back.
 *
 * <p>Follows the region filter on the page it sits on; with no filter a run covers every region.
 * Only delegates who have sent a photo unless asked otherwise — a card with the silhouette on it is
 * one a printer will print.</p>
 */
export default function IdCardRunsButton({ eventId, region }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="dash-btn" onClick={() => setOpen(true)} disabled={!eventId}>
        <i className="fas fa-id-card" aria-hidden="true" /> ID cards
      </button>
      {open && <RunsModal eventId={eventId} region={region} onClose={() => setOpen(false)} />}
    </>
  )
}

function RunsModal({ eventId, region, onClose }) {
  const [runs, setRuns] = useState(null)
  const [runId, setRunId] = useState(null)
  const [includeMissing, setIncludeMissing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

  // Bumped to list the runs again, after starting one or coming back from one.
  const [listed, setListed] = useState(0)
  const loadRuns = () => setListed((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    api.get(`/admin/events/${eventId}/id-card-runs`, { auth: true })
      .then((next) => { if (!cancelled) setRuns(next) })
      .catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [eventId, listed])

  async function start() {
    setError(null)
    setStarting(true)
    try {
      const run = await api.post(
        `/admin/events/${eventId}/id-card-runs`,
        { region: region || null, includeMissingPhotos: includeMissing },
        { auth: true },
      )
      setRunId(run.runId)
      loadRuns()
    } catch (err) {
      setError(err)
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal title="ID card print runs" onClose={onClose} wide>
      {runId ? (
        <RunDetail eventId={eventId} runId={runId} onBack={() => { setRunId(null); loadRuns() }} />
      ) : (
        <>
          <div className="icr-start">
            <p>
              Prints <strong>{region ? regionName(region) : 'every region'}</strong>
              {region ? ' (from the region filter).' : '. Pick a region in the filter below to print just one.'}{' '}
              Each region gets a zip per LGU, with a PDF per delegate, and one PDF of the whole region.
            </p>
            <label className="icr-check">
              <input type="checkbox" checked={includeMissing} onChange={(e) => setIncludeMissing(e.target.checked)} />
              Include delegates without a photo (their card prints with a silhouette)
            </label>
            <button type="button" className="dash-btn dash-btn-primary" onClick={start} disabled={starting}>
              <i className={`fas ${starting ? 'fa-spinner fa-spin' : 'fa-print'}`} aria-hidden="true" />
              {starting ? ' Starting…' : ' Start print run'}
            </button>
          </div>
          {error && <p className="dash-error">{error.message || 'Something went wrong.'}</p>}

          <h4 className="icr-h">Earlier runs</h4>
          {runs == null ? (
            <p className="icr-muted">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="icr-muted">No print runs yet.</p>
          ) : (
            <ul className="icr-runs">
              {runs.map((r) => (
                <li key={r.runId}>
                  <button type="button" onClick={() => setRunId(r.runId)}>
                    <span>{startedAt(r.startedAt)}</span>
                    <span className="icr-muted">
                      {r.regions} {r.regions === 1 ? 'region' : 'regions'}
                    </span>
                    <RunState done={r.done} failed={r.failed} pending={r.pending} />
                    <i className="fas fa-chevron-right" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Styles />
    </Modal>
  )
}

function RunState({ done, failed, pending }) {
  if (pending > 0) return <span className="dash-badge tone-progress"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> {done} done, {pending} drawing</span>
  if (failed > 0) return <span className="dash-badge tone-error">{failed} failed</span>
  return <span className="dash-badge tone-success">Done</span>
}

/** One run, polled until every region has finished. Links are good for an hour; reopening refreshes them. */
function RunDetail({ eventId, runId, onBack }) {
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let timer
    async function poll() {
      try {
        const next = await api.get(`/admin/events/${eventId}/id-card-runs/${runId}`, { auth: true })
        if (cancelled) return
        setRun(next)
        setError(null)
        if (next.regions.some((r) => r.status === 'Pending')) timer = setTimeout(poll, POLL_MS)
      } catch (err) {
        if (cancelled) return
        setError(err)
        timer = setTimeout(poll, POLL_MS * 2)
      }
    }
    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [eventId, runId])

  return (
    <>
      <button type="button" className="icr-back" onClick={onBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" /> All runs
      </button>
      {error && <p className="dash-error">{error.message || 'Could not load the run.'}</p>}
      {!run ? (
        <p className="icr-muted">Loading…</p>
      ) : (
        <>
          <p className="icr-muted">Started {startedAt(run.startedAt)} · run {run.runId}</p>
          {run.regions.length === 0 && <p className="icr-muted">Nobody to print in this run.</p>}
          {run.regions.map((r) => <RegionRow key={r.region} region={r} />)}
        </>
      )}
    </>
  )
}

function RegionRow({ region: r }) {
  return (
    <section className="icr-region">
      <header>
        <strong>{regionName(r.region)}</strong>
        {r.status === 'Pending' && <span className="dash-badge tone-progress"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Drawing{r.cards != null && ` ${r.cards} cards`}…</span>}
        {r.status === 'Failed' && <span className="dash-badge tone-error">Failed</span>}
        {r.status === 'Done' && (
          <span className="icr-muted">
            {r.cards} cards · {r.withPhoto} with photo
            {r.photosNotFetched > 0 && <span className="icr-warn"> · {r.photosNotFetched} photo(s) could not be read</span>}
          </span>
        )}
      </header>
      {r.status === 'Failed' && <p className="dash-error">{r.error || 'The run failed.'}</p>}
      {r.status === 'Done' && (
        <div className="icr-files">
          {r.zips.map((z) => (
            <a key={z.lgu} className="icr-file" href={z.url} download>
              <i className="fas fa-file-zipper" aria-hidden="true" /> {z.lgu} <span className="icr-muted">{megabytes(z.size)}</span>
            </a>
          ))}
          {r.pdfUrl && (
            <a className="icr-file icr-all" href={r.pdfUrl} target="_blank" rel="noreferrer">
              <i className="fas fa-file-pdf" aria-hidden="true" /> Whole region, one PDF
            </a>
          )}
        </div>
      )}
    </section>
  )
}

function Styles() {
  return (
    <style>{`
      .icr-start { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid var(--gray-200); }
      .icr-start p { margin: 0; color: var(--gray-700); line-height: 1.5; }
      .icr-check { display: flex; gap: 8px; align-items: center; font-size: 0.9rem; color: var(--gray-700); }
      .icr-h { margin: 16px 0 8px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gray-600); }
      .icr-muted { color: var(--gray-600); font-size: 0.88rem; }
      .icr-warn { color: var(--warning, #b45309); }
      .icr-runs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .icr-runs button { width: 100%; display: grid; grid-template-columns: 1fr auto auto 16px; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: 8px; background: none; cursor: pointer; text-align: left; font: inherit; color: var(--navy); }
      .icr-runs button:hover { background: var(--gray-100); }
      .icr-back { border: none; background: none; padding: 0; margin-bottom: 10px; cursor: pointer; color: var(--navy); font: inherit; font-weight: 600; }
      .icr-region { padding: 12px 0; border-top: 1px solid var(--gray-200); }
      .icr-region header { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .icr-files { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .icr-file { display: inline-flex; gap: 6px; align-items: center; padding: 6px 10px; border: 1px solid var(--gray-200); border-radius: 8px; color: var(--navy); text-decoration: none; font-size: 0.9rem; }
      .icr-file:hover { background: var(--gray-100); }
      .icr-all { border-style: dashed; }
      @media (max-width: 560px) { .icr-runs button { grid-template-columns: 1fr auto; } .icr-runs button .icr-muted, .icr-runs button .fa-chevron-right { display: none; } }
    `}</style>
  )
}

import { useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { getEvaluationResponses, getEvaluationSummary } from '@/lib/evaluation'
import { datedFilename, downloadCsv } from '@/lib/csv'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import Stat from '../components/Stat'

const RATING_ORDER = ['5', '4', '3', '2', '1', 'N/A']

/**
 * What delegates said after the convention (ATOP, 2026-10-22). Admin only: the comments name
 * people and offices.
 *
 * <p>The page is the summary the API already worked out — averages, the 0–10 recommend score, the
 * comments under each part. The full one-row-per-delegate table is only fetched when someone asks
 * for the CSV, because it is the heaviest thing here and most visits never need it.</p>
 */
export default function AdminEvaluationPage() {
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return { event: null, summary: null }
    return { event, summary: await getEvaluationSummary(event.id) }
  }, [])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { event, summary } = data
  if (!event) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-clipboard-check" aria-hidden="true" /></div>
        <h3>No published convention</h3>
        <p>Publish an event before there is anything to evaluate.</p>
      </div>
    )
  }

  const questions = summary.sections.flatMap((s) => s.questions)
  const overall = questions.find((q) => q.code === 'G12')
  const recommend = questions.find((q) => q.code === 'G13')

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{event.name}</span>
          <h1 className="dash-h1">Evaluations</h1>
          <p className="dash-sub">
            What delegates said in the post-convention form, part by part. One answer per delegate.
            The form is at <strong>/evaluation</strong>.
          </p>
        </div>
        <div className="evr-actions">
          <button className="dash-btn is-ghost" onClick={reload}>
            <i className="fas fa-rotate-right" aria-hidden="true" /> Refresh
          </button>
          <CsvButton eventId={event.id} disabled={summary.responses === 0} />
        </div>
      </div>

      <div className="dash-grid evr-stats">
        <Stat icon="fa-clipboard-check" label="Responses" value={summary.responses} />
        <Stat icon="fa-clock" label="Last received" value={summary.lastSubmittedAt ? when(summary.lastSubmittedAt) : '—'} />
        <Stat icon="fa-star" label="Overall rating (1–10)" value={fixed(overall?.average)} />
        <Stat icon="fa-bullhorn" label="Would recommend (NPS)" value={recommend?.nps != null ? signed(recommend.nps) : '—'} />
      </div>

      {summary.responses === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-inbox" aria-hidden="true" /></div>
          <h3>No answers yet</h3>
          <p>Share the form link with delegates. Answers show here as soon as they&rsquo;re sent.</p>
        </div>
      ) : (
        summary.sections.map((section) => <SectionCard key={section.code} section={section} />)
      )}

      <style>{ADMIN_CSS}</style>
    </>
  )
}

function SectionCard({ section }) {
  return (
    <section className="dash-card dash-card-pad evr-section">
      <h2 className="evr-sec-title">
        <span className="evr-sec-code">{section.code}</span> {section.title}
      </h2>
      {section.schedule && <p className="evr-sec-when">{section.schedule}</p>}
      <div className="evr-rows">
        {section.questions.map((q) => <QuestionRow key={q.id} question={q} />)}
      </div>
    </section>
  )
}

function QuestionRow({ question: q }) {
  if (q.kind === 'Text' || q.kind === 'ShortText') return <Comments question={q} />

  if (q.kind === 'Choice') {
    const total = Object.values(q.counts).reduce((a, b) => a + b, 0)
    return (
      <div className="evr-row">
        <p className="evr-prompt">{q.prompt} <span className="evr-muted">· {q.answered} answered</span></p>
        <ul className="evr-dist">
          {Object.entries(q.counts).sort((a, b) => b[1] - a[1]).map(([option, n]) => (
            <li key={option}>
              <span className="evr-dist-label">{option}</span>
              <Bar value={n} of={total} />
              <span className="evr-dist-n">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const max = q.kind === 'Rating' ? 5 : 10
  const order = q.kind === 'Rating'
    ? RATING_ORDER
    : Object.keys(q.counts).sort((a, b) => Number(b) - Number(a))
  const total = q.answered + q.notApplicable
  return (
    <details className="evr-row">
      <summary>
        <span className="evr-prompt">{q.code}. {q.prompt}</span>
        <span className="evr-score">
          <strong>{fixed(q.average)}</strong><span className="evr-muted"> / {max}</span>
          {q.nps != null && <span className="evr-nps">NPS {signed(q.nps)}</span>}
        </span>
        <Bar value={q.average ?? 0} of={max} />
        <span className="evr-muted evr-count">
          {q.answered} rated{q.notApplicable > 0 ? ` · ${q.notApplicable} N/A` : ''}
        </span>
      </summary>
      <ul className="evr-dist">
        {order.map((k) => (
          <li key={k}>
            <span className="evr-dist-label">{k}</span>
            <Bar value={q.counts[k] ?? 0} of={total} />
            <span className="evr-dist-n">{q.counts[k] ?? 0}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function Comments({ question: q }) {
  if (q.comments.length === 0) {
    return <p className="evr-row evr-muted">{q.prompt} — no comments.</p>
  }
  return (
    <details className="evr-row">
      <summary>
        <span className="evr-prompt"><i className="far fa-comment" aria-hidden="true" /> {q.prompt}</span>
        <span className="evr-muted evr-count">{q.comments.length} comment{q.comments.length === 1 ? '' : 's'}</span>
      </summary>
      <ul className="evr-comments">
        {q.comments.map((c, i) => (
          <li key={`${c.responseId}-${i}`}>
            <p>{c.text}</p>
            {c.name && <span className="evr-muted">— {c.name}</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * The raw table, one row per delegate. Fetched on the click, not on the page load. Every cell goes
 * through `spreadsheetSafe` because the comments are typed by the public.
 */
function CsvButton({ eventId, disabled }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const { questions, rows } = await getEvaluationResponses(eventId)
      const header = ['Submitted at', 'ID NO', 'Name', 'Email', ...questions.map((q) => `${q.code}. ${q.prompt}`)]
      const body = rows.map((r) => [
        when(r.submittedAt),
        r.idNo,
        r.delegateName,
        r.email,
        ...questions.map((q) => r.answers[q.code] ?? ''),
      ])
      downloadCsv(datedFilename('atop-evaluations'), [header, ...body].map((row) => row.map(spreadsheetSafe)))
    } catch (err) {
      setError(err?.message || 'The download failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="evr-csv">
      <button className="dash-btn" onClick={download} disabled={busy || disabled}>
        <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-file-csv'}`} aria-hidden="true" /> Download CSV
      </button>
      {error && <span className="evr-csv-error" role="alert">{error}</span>}
    </span>
  )
}

/**
 * A comment that starts with = + - or @ is a formula to Excel and Sheets: "=HYPERLINK(...)" typed
 * into the form would run on the admin's machine when the file opens. A leading apostrophe makes the
 * cell plain text. The shared csv.js has no such guard; its other callers export staff-entered data.
 */
function spreadsheetSafe(value) {
  const text = value == null ? '' : String(value)
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function Bar({ value, of }) {
  const pct = of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0
  return (
    <span className="evr-bar" role="img" aria-label={`${pct}%`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  )
}

const fixed = (n) => (n == null ? '—' : n.toFixed(1))
const signed = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}`
const when = (iso) =>
  new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const ADMIN_CSS = `
  .evr-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start; }
  .evr-csv { display: inline-flex; flex-direction: column; gap: 4px; }
  .evr-csv-error { font-size: 0.8rem; color: var(--bad); max-width: 240px; }
  .evr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .evr-section { margin-bottom: 16px; }
  .evr-sec-title { margin: 0; font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); display: flex; gap: 10px; align-items: baseline; }
  .evr-sec-code {
    flex-shrink: 0; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px;
    background: var(--navy); color: var(--gold-light); font-size: 0.85rem;
  }
  .evr-sec-when { margin: 4px 0 0 38px; font-size: 0.82rem; color: var(--gray-600); }
  .evr-rows { margin-top: 12px; display: flex; flex-direction: column; }
  .evr-row { padding: 12px 0; border-top: 1px solid var(--gray-100); margin: 0; }
  .evr-row > summary {
    list-style: none; cursor: pointer; display: grid; gap: 6px 12px;
    grid-template-columns: 1fr auto; align-items: center;
  }
  .evr-row > summary::-webkit-details-marker { display: none; }
  .evr-row > summary .evr-bar { grid-column: 1 / -1; }
  .evr-row > summary .evr-count { grid-column: 1 / -1; }
  @media (min-width: 768px) {
    .evr-row > summary { grid-template-columns: minmax(0, 1fr) 160px 90px 120px; }
    .evr-row > summary .evr-bar, .evr-row > summary .evr-count { grid-column: auto; }
    .evr-row > summary .evr-score { order: 1; }
    .evr-row > summary .evr-count { order: 2; text-align: right; }
  }
  .evr-prompt { margin: 0; font-size: 0.9rem; color: var(--text-body); line-height: 1.4; }
  .evr-score { white-space: nowrap; color: var(--navy); font-size: 0.95rem; }
  .evr-nps { margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--gray-100); font-size: 0.75rem; font-weight: 700; }
  .evr-muted { color: var(--gray-600); font-size: 0.8rem; }
  .evr-bar { display: block; height: 8px; border-radius: 999px; background: var(--gray-100); overflow: hidden; }
  .evr-bar > span { display: block; height: 100%; background: var(--gold); border-radius: inherit; }
  .evr-dist { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .evr-dist li { display: grid; grid-template-columns: minmax(48px, 160px) 1fr 36px; gap: 10px; align-items: center; font-size: 0.82rem; }
  .evr-dist-label { color: var(--gray-600); overflow-wrap: anywhere; }
  .evr-dist-n { text-align: right; font-variant-numeric: tabular-nums; color: var(--navy); font-weight: 700; }
  .evr-comments { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .evr-comments li { padding: 10px 12px; border-radius: 10px; background: var(--off-white); font-size: 0.88rem; }
  .evr-comments p { margin: 0 0 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
`

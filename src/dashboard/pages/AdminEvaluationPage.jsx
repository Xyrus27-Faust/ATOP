import { useEffect, useState } from 'react'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { getEvaluationCertificates, getEvaluationResponses, getEvaluationSummary, sendEvaluationCertificates } from '@/lib/evaluation'
import { datedFilename, downloadCsv } from '@/lib/csv'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import Stat from '../components/Stat'

const RATING_ORDER = ['5', '4', '3', '2', '1', 'N/A']
const COMMENTS_PER_PAGE = 10

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
        {/* Reloading the summary remounts the certificate card below, so this one button refreshes both. */}
        <div className="evr-actions evr-head-actions">
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

      {summary.responses > 0 && <CertificateRecord eventId={event.id} />}

      {summary.responses === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-inbox" aria-hidden="true" /></div>
          <h3>No answers yet</h3>
          <p>Share the form link with delegates. Answers show here as soon as they&rsquo;re sent.</p>
        </div>
      ) : (
        <Sections sections={summary.sections} />
      )}

      <style>{ADMIN_CSS}</style>
    </>
  )
}

const sectionAnchor = (code) => `evr-sec-${code}`

/**
 * Every part starts as a closed tile, two to a row on a wide screen, so the whole form fits on one
 * screen before anyone drills in. An open part takes the full width: at half width the question rows
 * would wrap to three or four lines. The chip bar and the highlights open a part before scrolling to it,
 * so a tap never lands on a closed tile. Nothing is remembered: Refresh or a reload starts all closed.
 */
function Sections({ sections }) {
  const [open, setOpen] = useState(() => new Set())
  const [jump, setJump] = useState(null)

  const toggle = (code) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  const openAndJump = (code) => {
    setOpen((prev) => (prev.has(code) ? prev : new Set(prev).add(code)))
    setJump({ code })
  }

  // Scroll after the part has rendered open, or the page would scroll to where the closed tile was.
  useEffect(() => {
    if (jump) document.getElementById(sectionAnchor(jump.code))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [jump])

  return (
    <>
      <Highlights sections={sections} onJump={openAndJump} />
      <SectionNav sections={sections} onJump={openAndJump} />
      <div className="evr-tiles">
        {sections.map((section) => (
          <SectionCard key={section.code} section={section} open={open.has(section.code)} onToggle={() => toggle(section.code)} />
        ))}
      </div>
    </>
  )
}

/**
 * The three weakest and three strongest rated questions, so the takeaway is on screen before the
 * 80-odd rows. Ratings (1–5) and scales (1–10) are compared as a share of their top mark. Each one
 * jumps to its part of the form.
 */
function Highlights({ sections, onJump }) {
  const rated = sections.flatMap((s) =>
    s.questions
      .filter((q) => (q.kind === 'Rating' || q.kind === 'Scale') && q.average != null)
      .map((q) => ({ ...q, section: s.code, max: maxOf(q), share: q.average / maxOf(q) })),
  )
  // Under two rated questions there is nothing to rank; under six, the lists would overlap.
  const n = Math.min(3, Math.floor(rated.length / 2))
  if (n === 0) return null

  const sorted = [...rated].sort((a, b) => a.share - b.share)
  const lists = [
    { title: 'Needs attention', icon: 'fa-triangle-exclamation', items: sorted.slice(0, n) },
    { title: 'Rated best', icon: 'fa-thumbs-up', items: sorted.slice(-n).reverse() },
  ]

  return (
    <section className="dash-card dash-card-pad evr-section evr-highlights">
      {lists.map((list) => (
        <div key={list.title}>
          <h2 className="evr-hl-title"><i className={`fas ${list.icon}`} aria-hidden="true" /> {list.title}</h2>
          <ul className="evr-hl-list">
            {list.items.map((q) => (
              <li key={q.id}>
                <button className="evr-hl-item" onClick={() => onJump(q.section)}>
                  <span className="evr-prompt">{q.code}. {q.prompt}</span>
                  <span className={`evr-hl-score ${tone(q.average, q.max)}`}>
                    {fixed(q.average)}<span className="evr-muted"> / {q.max}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/** A row of the form's parts that stays under the top bar: a phone would otherwise scroll for minutes. */
function SectionNav({ sections, onJump }) {
  return (
    <nav className="evr-nav" aria-label="Parts of the form">
      {sections.map((s) => (
        <button key={s.code} className="evr-nav-chip" onClick={() => onJump(s.code)}>
          <span className="evr-nav-code">{s.code}</span> {s.title}
        </button>
      ))}
    </nav>
  )
}

function SectionCard({ section, open, onToggle }) {
  // The tile's score is the 1–5 ratings only. The 1–10 overall and recommend have their own tiles up
  // top, and folding them in would mix two scales into one number.
  const ratings = section.questions.filter((q) => q.kind === 'Rating' && q.average != null)
  const average = ratings.length > 0 ? ratings.reduce((sum, q) => sum + q.average, 0) / ratings.length : null
  const count = section.questions.length
  const rows = `evr-rows-${section.code}`
  return (
    <section id={sectionAnchor(section.code)} className={`dash-card dash-card-pad evr-tile${open ? ' is-open' : ''}`}>
      <h2 className="evr-tile-h">
        <button className="evr-tile-head" onClick={onToggle} aria-expanded={open} aria-controls={rows}>
          <span className="evr-sec-code">{section.code}</span>
          <span className="evr-tile-text">
            <span className="evr-tile-title">{section.title}</span>
            {section.schedule && <span className="evr-tile-when">{section.schedule}</span>}
            <span className="evr-tile-meta">
              {count} question{count === 1 ? '' : 's'}
              {average != null && (
                <> · <strong className={tone(average, 5)}>{fixed(average)}</strong> / 5 average</>
              )}
            </span>
          </span>
          <i className="fas fa-chevron-down evr-tile-chev" aria-hidden="true" />
        </button>
      </h2>
      {open && (
        <div className="evr-rows" id={rows}>
          {section.questions.map((q) => <QuestionRow key={q.id} question={q} />)}
        </div>
      )}
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

  const max = maxOf(q)
  const order = q.kind === 'Rating'
    ? RATING_ORDER
    : Object.keys(q.counts).sort((a, b) => Number(b) - Number(a))
  const total = q.answered + q.notApplicable
  const shade = tone(q.average, max)
  return (
    <details className="evr-row">
      <summary>
        <span className="evr-prompt">{q.code}. {q.prompt}</span>
        <span className="evr-score">
          <strong className={shade}>{fixed(q.average)}</strong><span className="evr-muted"> / {max}</span>
          {q.nps != null && <span className="evr-nps">NPS {signed(q.nps)}</span>}
        </span>
        <Bar value={q.average ?? 0} of={max} tone={shade} />
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

/**
 * A question's comments, a page at a time: some have hundreds. The search runs over the comment and
 * the name before paging, so a match on page 9 still comes up first. Closing the question starts it
 * over, so whoever opens it next does not land on someone else's page 4 of a search.
 */
function Comments({ question: q }) {
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(0)

  if (q.comments.length === 0) {
    return <p className="evr-row evr-muted">{q.prompt} — no comments.</p>
  }

  const needle = term.trim().toLowerCase()
  const matches = needle
    ? q.comments.filter((c) => c.text.toLowerCase().includes(needle) || c.name?.toLowerCase().includes(needle))
    : q.comments
  const pages = Math.max(1, Math.ceil(matches.length / COMMENTS_PER_PAGE))
  const current = Math.min(page, pages - 1)
  const shown = matches.slice(current * COMMENTS_PER_PAGE, (current + 1) * COMMENTS_PER_PAGE)

  const reset = (e) => {
    if (e.currentTarget.open) return
    setTerm('')
    setPage(0)
  }

  return (
    <details className="evr-row" onToggle={reset}>
      <summary>
        <span className="evr-prompt"><i className="far fa-comment" aria-hidden="true" /> {q.prompt}</span>
        <span className="evr-muted evr-count">{q.comments.length} comment{q.comments.length === 1 ? '' : 's'}</span>
      </summary>
      {q.comments.length > COMMENTS_PER_PAGE && (
        <input
          type="search"
          className="dash-input evr-search"
          placeholder="Search comments or names"
          aria-label={`Search comments: ${q.prompt}`}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setPage(0)
          }}
        />
      )}
      {needle && (
        <p className="evr-muted evr-found" role="status">
          {matches.length} of {q.comments.length} match &ldquo;{term.trim()}&rdquo;
        </p>
      )}
      <ul className="evr-comments">
        {shown.map((c) => (
          <li key={`${c.responseId}-${q.comments.indexOf(c)}`}>
            <p>{c.text}</p>
            {c.name && <span className="evr-muted">— {c.name}</span>}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav className="evr-pager" aria-label="Comment pages">
          <button className="dash-btn is-ghost" onClick={() => setPage(current - 1)} disabled={current === 0}>
            <i className="fas fa-chevron-left" aria-hidden="true" /> Prev
          </button>
          <span className="evr-muted">Page {current + 1} of {pages}</span>
          <button className="dash-btn is-ghost" onClick={() => setPage(current + 1)} disabled={current === pages - 1}>
            Next <i className="fas fa-chevron-right" aria-hidden="true" />
          </button>
        </nav>
      )}
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
 * The Certificate of Appearance (ATOP, 2026-10-29) goes out with each receipt; this sends it to
 * whoever answered before that, or whose mail failed. Asks first — a dry run says how many — then
 * sends in batches of 40 (the API stops a request at 60 s) until none are left or a batch fails.
 */
function CertificatesButton({ eventId, disabled, onDone }) {
  const [state, setState] = useState({ phase: 'idle' }) // idle | checking | confirm | sending | done
  const [error, setError] = useState(null)

  const check = async () => {
    setError(null)
    setState({ phase: 'checking' })
    try {
      const dry = await sendEvaluationCertificates(eventId)
      setState(dry.due === 0 ? { phase: 'done', sent: 0, failed: 0 } : { phase: 'confirm', due: dry.due })
    } catch (err) {
      setError(err?.message || 'Could not check. Try again.')
      setState({ phase: 'idle' })
    }
  }

  const send = async () => {
    setError(null)
    let sent = 0
    let failed = 0
    setState({ phase: 'sending', sent, due: state.due })
    try {
      for (;;) {
        const run = await sendEvaluationCertificates(eventId, { send: true })
        sent += run.sent
        failed += run.failed
        setState({ phase: 'sending', sent, due: state.due })
        // A batch that failed outright would fail again: stop and say so rather than loop.
        if (run.remaining === 0 || run.failed > 0 || run.sent === 0) break
      }
      setState({ phase: 'done', sent, failed })
    } catch (err) {
      setError(`${err?.message || 'Sending stopped.'} ${sent} sent so far — run it again to continue.`)
      setState({ phase: 'idle' })
    }
    // Some may have gone out even when the run stopped part way, so the count above is redrawn either way.
    onDone?.()
  }

  const { phase } = state
  return (
    <span className="evr-csv">
      {phase === 'confirm' ? (
        <span className="evr-confirm">
          <button className="dash-btn" onClick={send}>
            <i className="fas fa-paper-plane" aria-hidden="true" /> Send {state.due} certificate{state.due === 1 ? '' : 's'}
          </button>
          <button className="dash-btn is-ghost" onClick={() => setState({ phase: 'idle' })}>Cancel</button>
        </span>
      ) : (
        <button className="dash-btn" onClick={check} disabled={disabled || phase === 'checking' || phase === 'sending'}>
          <i className={`fas ${phase === 'checking' || phase === 'sending' ? 'fa-spinner fa-spin' : 'fa-award'}`} aria-hidden="true" />{' '}
          {phase === 'sending' ? `Sending… ${state.sent} of ${state.due}` : 'Send certificates'}
        </button>
      )}
      {phase === 'confirm' && (
        <span className="evr-muted">{state.due} answered without getting a certificate. Each gets one email with the PDF.</span>
      )}
      {phase === 'done' && (
        <span className="evr-muted" role="status">
          {state.sent === 0 && state.failed === 0
            ? 'Everyone who answered has their certificate.'
            : `${state.sent} sent${state.failed > 0 ? `, ${state.failed} failed — run it again to retry` : ''}.`}
        </span>
      )}
      {error && <span className="evr-csv-error" role="alert">{error}</span>}
    </span>
  )
}

/**
 * Who has been given a Certificate of Appearance, and when (ATOP, 2026-10-29). The API mails any
 * still due by itself every 10 minutes, so "waiting" should only ever be the last few minutes'
 * answers; the Send certificates button here is there to push them out now. The CSV is the record.
 */
function CertificateRecord({ eventId }) {
  const { loading, error, data, reload } = useAsync(() => getEvaluationCertificates(eventId), [eventId])

  const download = () => {
    const header = ['Submitted at', 'ID NO', 'Name', 'Email', 'Certificate sent at']
    const body = data.rows.map((r) => [
      when(r.submittedAt),
      r.idNo,
      r.delegateName,
      r.email,
      r.certificateSentAt ? when(r.certificateSentAt) : 'Not yet',
    ])
    downloadCsv(datedFilename('atop-certificates-sent'), [header, ...body].map((row) => row.map(spreadsheetSafe)))
  }

  return (
    <section className="dash-card dash-card-pad evr-section evr-cert">
      <div className="evr-cert-head">
        <div className="evr-cert-status">
          <h2 className="evr-sec-title">Certificates of Appearance</h2>
          {loading ? (
            <p className="evr-muted">Loading…</p>
          ) : error ? (
            <p className="evr-csv-error" role="alert">
              Couldn&rsquo;t load the record. <button className="evr-link" onClick={reload}>Try again</button>
            </p>
          ) : (
            <p className="evr-muted">
              <strong className={data.due > 0 ? 'is-warn' : 'is-ok'}>
                {data.sent} of {data.responses} sent{data.due === 0 && <> <i className="fas fa-check" aria-hidden="true" /></>}
              </strong>
              {data.due > 0 ? ` · ${data.due} waiting — they go out automatically within 10 minutes.` : ' · everyone who answered has theirs.'}
            </p>
          )}
        </div>
        <span className="evr-actions">
          <CertificatesButton eventId={eventId} onDone={reload} />
          <button className="dash-btn is-ghost" onClick={download} disabled={!data || data.rows.length === 0}>
            <i className="fas fa-file-csv" aria-hidden="true" /> Certificate record (CSV)
          </button>
        </span>
      </div>
    </section>
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

function Bar({ value, of, tone = '' }) {
  const pct = of > 0 ? Math.min(100, Math.round((value / of) * 100)) : 0
  return (
    <span className={`evr-bar ${tone}`} role="img" aria-label={`${pct}%`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  )
}

const maxOf = (q) => (q.kind === 'Rating' ? 5 : 10)

/**
 * Score colour as a share of the top mark: under 60% red, 60–80% gold, over 80% green. That is
 * under 3.0 / 3.0–4.0 / over 4.0 on a 1–5 rating and under 6 / 6–8 / over 8 on a 1–10 scale.
 */
const tone = (average, max) => {
  if (average == null) return ''
  const share = average / max
  return share < 0.6 ? 'is-bad' : share <= 0.8 ? 'is-mid' : 'is-ok'
}

const fixed = (n) => (n == null ? '—' : n.toFixed(1))
const signed = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}`
const when = (iso) =>
  new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const ADMIN_CSS = `
  .evr-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start; }
  .evr-csv { display: inline-flex; flex-direction: column; gap: 4px; }
  .evr-csv-error { font-size: 0.8rem; color: var(--bad); max-width: 240px; }
  .evr-csv > .evr-muted { max-width: 240px; }
  .evr-cert-head { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
  .evr-cert .evr-muted { margin: 6px 0 0; }
  .evr-link { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; }
  .evr-confirm { display: inline-flex; gap: 8px; flex-wrap: wrap; }
  .evr-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
  @media (min-width: 768px) { .evr-stats { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); } }
  @media (max-width: 560px) {
    .evr-head-actions, .evr-cert-head, .evr-cert-head .evr-actions { width: 100%; }
    .evr-head-actions > *, .evr-cert-head .evr-actions > * { flex: 1 1 100%; }
    .evr-actions .dash-btn { width: 100%; justify-content: center; }
    .evr-csv, .evr-csv > .evr-muted, .evr-csv-error { max-width: none; }
    .evr-confirm > .dash-btn { flex: 1 1 0; }
  }
  .evr-cert-status { min-width: 0; flex: 1 1 260px; }
  .evr-cert .is-ok { color: var(--ok); }
  .evr-cert .is-warn { color: var(--warn); }
  .evr-section, .evr-highlights { scroll-margin-top: 128px; }
  .evr-nav {
    position: sticky; top: 64px; z-index: 10; display: flex; gap: 8px; overflow-x: auto;
    margin: 0 0 16px; padding: 10px 0; background: var(--off-white); scrollbar-width: none;
  }
  .evr-nav::-webkit-scrollbar { display: none; }
  .evr-nav-chip {
    flex-shrink: 0; display: inline-flex; gap: 6px; align-items: center; padding: 6px 12px 6px 6px;
    border: 1px solid var(--gray-200); border-radius: 999px; background: var(--white); cursor: pointer;
    font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--navy); white-space: nowrap;
  }
  .evr-nav-chip:hover { border-color: var(--gold); }
  .evr-nav-code {
    display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 999px;
    background: var(--navy); color: var(--gold-light); font-size: 0.75rem;
  }
  .evr-highlights { display: grid; gap: 18px; }
  @media (min-width: 768px) { .evr-highlights { grid-template-columns: 1fr 1fr; gap: 28px; } }
  .evr-hl-title { margin: 0 0 6px; font-family: var(--font-heading); font-size: 0.95rem; font-weight: 800; color: var(--navy); display: flex; gap: 8px; align-items: center; }
  .evr-hl-list { list-style: none; margin: 0; padding: 0; }
  .evr-hl-item {
    width: 100%; display: flex; gap: 12px; justify-content: space-between; align-items: baseline; text-align: left;
    padding: 10px 0; border: 0; border-top: 1px solid var(--gray-100); background: none; cursor: pointer; font: inherit;
  }
  .evr-hl-item:hover .evr-prompt { text-decoration: underline; }
  .evr-hl-score { white-space: nowrap; font-weight: 800; font-size: 0.95rem; }
  .evr-score .is-bad, .evr-hl-score.is-bad { color: var(--bad); }
  .evr-score .is-mid, .evr-hl-score.is-mid { color: var(--gold-dark); }
  .evr-score .is-ok, .evr-hl-score.is-ok { color: var(--ok); }
  .evr-bar.is-bad > span { background: var(--bad); }
  .evr-bar.is-mid > span { background: var(--gold); }
  .evr-bar.is-ok > span { background: var(--ok); }
  .evr-section { margin-bottom: 16px; }
  .evr-tiles { display: grid; gap: 16px; margin-bottom: 16px; }
  @media (min-width: 768px) {
    .evr-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .evr-tile.is-open { grid-column: 1 / -1; }
  }
  .evr-tile-h { margin: 0; font-size: inherit; }
  .evr-tile { min-width: 0; scroll-margin-top: 128px; }
  .evr-tile-head {
    width: 100%; display: flex; gap: 12px; align-items: flex-start; text-align: left;
    border: 0; padding: 0; background: none; cursor: pointer; font: inherit; color: inherit;
  }
  .evr-tile-head .evr-sec-code { margin-top: 1px; }
  .evr-tile-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .evr-tile-title { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); line-height: 1.3; }
  .evr-tile-when { font-size: 0.82rem; color: var(--gray-600); }
  .evr-tile-meta { font-size: 0.85rem; color: var(--gray-600); }
  .evr-tile-meta .is-bad { color: var(--bad); }
  .evr-tile-meta .is-mid { color: var(--gold-dark); }
  .evr-tile-meta .is-ok { color: var(--ok); }
  .evr-tile-chev { margin-top: 6px; color: var(--gray-600); transition: transform 0.15s; }
  .evr-tile.is-open .evr-tile-chev { transform: rotate(180deg); }
  .evr-tile-head:hover .evr-tile-title { color: var(--gold-dark); }
  .evr-sec-title { margin: 0; font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); display: flex; gap: 10px; align-items: baseline; }
  .evr-sec-code {
    flex-shrink: 0; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px;
    background: var(--navy); color: var(--gold-light); font-size: 0.85rem;
  }
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
  .evr-search { display: block; width: 100%; max-width: 360px; margin-top: 10px; }
  .evr-found { margin: 8px 0 0; }
  .evr-pager { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-top: 10px; }
  @media (min-width: 768px) { .evr-pager { justify-content: flex-start; } }
`

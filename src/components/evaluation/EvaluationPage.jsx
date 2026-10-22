import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '@/dashboard/useAsync'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import { checkEvaluationIdentity, getEvaluationForm, submitEvaluation } from '@/lib/evaluation'
import EvaluationSection from './EvaluationSection'
import { clearDraft, loadDraft, missingIn, saveDraft, toPayload } from './evaluationDraft'

/** The API's 409 title when the form is shut; the other 409 is "already answered". Mirrors EvaluationEndpoints.ClosedTitle. */
const CLOSED = 'The evaluation form is closed.'

/**
 * The post-convention evaluation (ATOP, 2026-10-22). Public: delegates have no accounts.
 *
 * Three screens, each asking one thing: who you are (email + the ID NO on your convention ID), the
 * form one part at a time, and a thank-you. No code is mailed — the pair is checked when the form
 * opens and again at Submit. The name shown while answering is masked: anyone holding someone's ID
 * card and email could type them in. The answers live on the device as they're given, so a dropped
 * signal never costs anyone their work.
 */
export default function EvaluationPage() {
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    if (!event) return null
    return { slug: event.slug, form: await getEvaluationForm(event.slug) }
  })

  if (loading) {
    return <Shell><div className="ev-card ev-loading"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading the form…</div></Shell>
  }
  if (error) {
    return (
      <Shell>
        <State icon="fa-wifi" title="We couldn't load the form">
          Check your connection and try again.
          <button type="button" className="ev-btn is-primary ev-state-btn" onClick={reload}>Try again</button>
        </State>
      </Shell>
    )
  }
  if (!data) {
    return <Shell><State icon="fa-calendar-xmark" title="Nothing to evaluate yet">There's no convention open for evaluation right now.</State></Shell>
  }
  if (!data.form.open) {
    return (
      <Shell eventName={data.form.eventName}>
        <State icon="fa-lock" title="The evaluation form is closed">Thank you to everyone who took the time to answer.</State>
      </Shell>
    )
  }
  // Keyed on the event so the draft is read once, for the right event, when the form arrives.
  return <Evaluation key={data.form.eventId} slug={data.slug} form={data.form} />
}

function Evaluation({ slug, form }) {
  const sections = form.sections
  const [draft] = useState(() => loadDraft(form.eventId))
  // Checked once already on this device: straight back into the form. Submit checks it all again.
  const known = draft?.identity?.idNo ? draft.identity : null

  const [phase, setPhase] = useState(known ? 'form' : 'identify')
  const [email, setEmail] = useState(draft?.email ?? '')
  const [idNo, setIdNo] = useState(draft?.idNo ?? '')
  const [identity, setIdentity] = useState(known) // { email, idNo, name } — the name masked by the API
  const [answers, setAnswers] = useState(draft?.answers ?? {})
  const [step, setStep] = useState(Math.min(draft?.step ?? 0, sections.length - 1))

  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null) // { message, fields: { email|idNo: msg } }
  const [notice, setNotice] = useState(
    !known && draft?.answers && Object.keys(draft.answers).length > 0
      ? 'Welcome back — your answers are saved on this phone. Enter your email and ID number again to carry on.'
      : null,
  )
  const [showMissing, setShowMissing] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [done, setDone] = useState(null) // { title, body, icon, tone }

  const questionById = useMemo(() => {
    const map = {}
    for (const s of sections) for (const q of s.questions) map[q.id] = q
    return map
  }, [sections])

  // Every change goes to the device straight away; nothing is kept once the form is filed.
  useEffect(() => {
    if (done) return
    saveDraft(form.eventId, { email, idNo, identity, answers, step })
  }, [form.eventId, email, idNo, identity, answers, step, done])

  const fail = (err, fallback) => {
    const fields = {}
    for (const [k, msgs] of Object.entries(err?.fieldErrors ?? {})) fields[k] = Array.isArray(msgs) ? msgs[0] : msgs
    const hasField = Object.keys(fields).length > 0
    setProblem({ message: hasField ? null : err?.message || fallback, fields })
  }

  const finishWith = (title, body, icon = 'fa-circle-check', tone = 'ok') => {
    clearDraft(form.eventId)
    setDone({ title, body, icon, tone })
    setPhase('done')
  }

  // The refusals every step can meet: answered already, or never scanned at the venue.
  // Not attended keeps the draft — once they're scanned, the same answers can still go in.
  const refused = (err) => {
    if (err?.status === 409 && err.message !== CLOSED) {
      finishWith('Already answered', err.message)
      return true
    }
    if (err?.status === 403) {
      setDone({ title: 'We can’t open the form for you yet', body: err.message, icon: 'fa-id-card', tone: null })
      setPhase('done')
      return true
    }
    return false
  }

  // ---- step 1: who you are ----------------------------------------------------------

  const check = async (e) => {
    e?.preventDefault()
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      const res = await checkEvaluationIdentity(slug, { email: email.trim(), idNo: idNo.trim() })
      // A shared office computer: someone else's half-filled answers must not be filed under this name.
      if (draft?.identity?.idNo && draft.identity.idNo !== res.idNo) {
        setAnswers({})
        setStep(0)
      }
      setIdentity(res)
      setNotice(null)
      setPhase('form')
    } catch (err) {
      if (!refused(err)) fail(err, "We couldn't check your details. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const startOver = () => {
    if (!window.confirm('Start over as someone else? The answers on this device will be cleared.')) return
    clearDraft(form.eventId)
    setIdentity(null)
    setAnswers({})
    setStep(0)
    setEmail('')
    setIdNo('')
    setProblem(null)
    setNotice(null)
    setPhase('identify')
  }

  // ---- step 2: the form ----------------------------------------------------------------------

  const onAnswer = (questionId, patch) => {
    setAnswers((a) => ({ ...a, [questionId]: { ...a[questionId], ...patch } }))
    const qCode = questionById[questionId]?.code
    if (qCode && serverErrors[qCode]) {
      setServerErrors((errors) => {
        const rest = { ...errors }
        delete rest[qCode]
        return rest
      })
    }
  }

  const goTo = (index) => {
    setShowMissing(false)
    setProblem(null)
    setStep(index)
  }

  const pointAt = (questionIds) => {
    const first = questionById[questionIds[0]]
    // After the render that shows the red notes, so the scroll lands on the row and not above it.
    requestAnimationFrame(() =>
      document.getElementById(`q-${first.code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  const next = () => {
    const missing = missingIn(sections[step], answers)
    if (missing.length > 0) {
      setShowMissing(true)
      pointAt(missing)
      return
    }
    goTo(step + 1)
  }

  // ---- step 3: Submit checks the pair again and files the answers ----------------------------

  const submit = async () => {
    if (busy) return
    // Every part is checked on Next, but a draft from an older visit could still have a gap.
    const gap = sections.findIndex((s) => missingIn(s, answers).length > 0)
    if (gap !== -1) {
      setStep(gap)
      setShowMissing(true)
      pointAt(missingIn(sections[gap], answers))
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await submitEvaluation(slug, { email: identity.email, idNo: identity.idNo, answers: toPayload(sections, answers) })
      finishWith('Thank you!', 'Your evaluation has been sent. Your answers help us plan the next convention. You can close this page now.')
    } catch (err) {
      if (refused(err)) return
      const byCode = {}
      for (const [k, msgs] of Object.entries(err?.fieldErrors ?? {})) byCode[k] = Array.isArray(msgs) ? msgs[0] : msgs
      if (err?.status === 400 && (byCode.email || byCode.idNo)) {
        // The registration changed since the form opened: back to the start, answers kept.
        setIdentity(null)
        setPhase('identify')
        fail(err)
        return
      }
      const at = sections.findIndex((s) => s.questions.some((q) => byCode[q.code]))
      if (err?.status === 400 && at !== -1) {
        setServerErrors(byCode)
        setStep(at)
        pointAt(sections[at].questions.filter((q) => byCode[q.code]).map((q) => q.id))
        return
      }
      setProblem({
        message: err?.message || "We couldn't send your answers. Check your connection and tap Submit again — nothing is lost.",
        fields: {},
      })
    } finally {
      setBusy(false)
    }
  }

  // ---- screens -------------------------------------------------------------------------------

  if (phase === 'done') {
    return (
      <Shell eventName={form.eventName}>
        <State icon={done.icon} tone={done.tone} title={done.title}>{done.body}</State>
      </Shell>
    )
  }

  if (phase === 'identify') {
    return (
      <Shell eventName={form.eventName}>
        <form className="ev-card ev-intro" onSubmit={check} noValidate>
          <p className="ev-kicker">Post-convention evaluation</p>
          <h1 className="ev-h1">Tell us how the convention went</h1>
          <p className="ev-lead">It takes about 10 minutes. First, let&rsquo;s find your registration.</p>
          {notice && <p className="ev-notice" role="status"><i className="fas fa-floppy-disk" aria-hidden="true" /> {notice}</p>}

          <label className="ev-label" htmlFor="ev-email">Your email</label>
          <input
            id="ev-email"
            className="ev-input is-big"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(problem?.fields.email)}
          />
          {problem?.fields.email && <FieldError>{problem.fields.email}</FieldError>}
          <p className="ev-hint">The one you registered with, or your office&rsquo;s registration email.</p>

          <label className="ev-label" htmlFor="ev-idno">ID number on your convention ID</label>
          <input
            id="ev-idno"
            className="ev-input is-big is-code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ATOP-26-00F5C"
            value={idNo}
            onChange={(e) => setIdNo(e.target.value)}
            aria-invalid={Boolean(problem?.fields.idNo)}
          />
          {problem?.fields.idNo && <FieldError>{problem.fields.idNo}</FieldError>}
          <p className="ev-hint">Printed on your ID as <strong>ID NO</strong> — it starts with ATOP-26.</p>

          {problem?.message && <FieldError>{problem.message}</FieldError>}
          <button type="submit" className="ev-btn is-primary is-block" disabled={busy || !email.trim() || !idNo.trim()}>
            {busy ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Checking…</> : <>Start the form <i className="fas fa-arrow-right" aria-hidden="true" /></>}
          </button>
        </form>
      </Shell>
    )
  }

  const section = sections[step]
  const last = step === sections.length - 1
  return (
    <Shell eventName={form.eventName}>
      <div className="ev-who">
        <i className="fas fa-user-check" aria-hidden="true" />
        <span>
          Answering as <strong>{identity.name}</strong>
          <span className="ev-who-id"> · {identity.idNo}</span>
        </span>
        <button type="button" className="ev-link is-small" onClick={startOver}>Not you?</button>
      </div>

      <div className="ev-card">
        <EvaluationSection
          section={section}
          index={step}
          total={sections.length}
          answers={answers}
          onAnswer={onAnswer}
          missing={showMissing ? missingIn(section, answers) : []}
          serverErrors={serverErrors}
        />
        {problem?.message && <FieldError>{problem.message}</FieldError>}
      </div>

      <nav className="ev-bar" aria-label="Form pages">
        <div className="ev-bar-inner">
          <button type="button" className="ev-btn is-ghost" onClick={() => goTo(step - 1)} disabled={step === 0 || busy}>
            <i className="fas fa-arrow-left" aria-hidden="true" /> Back
          </button>
          {last ? (
            <button type="button" className="ev-btn is-primary" onClick={submit} disabled={busy}>
              {busy ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Sending…</> : <>Submit <i className="fas fa-paper-plane" aria-hidden="true" /></>}
            </button>
          ) : (
            <button type="button" className="ev-btn is-primary" onClick={next}>
              Next <i className="fas fa-arrow-right" aria-hidden="true" />
            </button>
          )}
        </div>
      </nav>
    </Shell>
  )
}

function FieldError({ children }) {
  return <p className="ev-error" role="alert"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {children}</p>
}

function State({ icon, title, tone, children }) {
  return (
    <div className="ev-card ev-state">
      <div className={`ev-state-icon${tone ? ` is-${tone}` : ''}`} aria-hidden="true"><i className={`fas ${icon}`} /></div>
      <h1 className="ev-state-title">{title}</h1>
      <div className="ev-state-body">{children}</div>
    </div>
  )
}

function Shell({ eventName, children }) {
  return (
    <div className="ev">
      <header className="ev-head">
        <img src="/Untitled.png" alt="ATOP" className="ev-logo" />
        <div className="ev-head-text">
          <span className="ev-event">{eventName || 'ATOP Convention'}</span>
          <span className="ev-sub">Evaluation form</span>
        </div>
      </header>
      <main className="ev-main">{children}</main>
      <style>{EVALUATION_CSS}</style>
    </div>
  )
}

const EVALUATION_CSS = `
  .ev { min-height: 100dvh; background: var(--off-white); color: var(--text-body); font-family: var(--font-body); }
  .ev-head {
    display: flex; align-items: center; gap: 12px; padding: 16px 16px 72px;
    background: linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 60%, var(--navy-light) 100%);
    color: var(--white);
  }
  .ev-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; background: var(--white); padding: 3px; }
  .ev-head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .ev-event { font-family: var(--font-heading); font-weight: 700; font-size: 0.92rem; line-height: 1.2; }
  .ev-sub { font-size: 0.76rem; color: rgba(255, 255, 255, 0.7); }
  .ev-main {
    max-width: 560px; margin: -56px auto 0; padding: 0 16px calc(104px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 12px;
  }

  .ev-card { background: var(--white); border-radius: 18px; padding: 20px 16px; box-shadow: var(--shadow-md); }
  .ev-loading { text-align: center; padding: 48px 16px; color: var(--gray-600); }
  .ev-intro { display: flex; flex-direction: column; border-top: 5px solid var(--gold); }
  .ev-kicker { margin: 0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold-dark); }
  .ev-h1 {
    margin: 4px 0 0; font-family: var(--font-heading); font-weight: 800; color: var(--navy);
    font-size: clamp(1.35rem, 6vw, 1.6rem); line-height: 1.2; outline: none;
  }
  .ev-lead { margin: 8px 0 4px; font-size: 0.98rem; line-height: 1.55; }
  .ev-notice {
    margin: 10px 0 0; padding: 12px; border-radius: 12px; background: var(--info-bg); color: var(--navy);
    font-size: 0.9rem; line-height: 1.5; display: flex; gap: 10px;
  }
  .ev-notice i { margin-top: 3px; color: var(--info); }

  .ev-label { margin: 18px 0 6px; font-weight: 700; color: var(--navy); font-size: 0.98rem; }
  .ev-hint { margin: 6px 0 0; font-size: 0.84rem; color: var(--gray-600); line-height: 1.45; }
  .ev-input, .ev-text {
    width: 100%; box-sizing: border-box; border: 2px solid var(--gray-200); border-radius: 12px;
    padding: 12px 14px; font: inherit; font-size: 16px; color: var(--navy); background: var(--white);
  }
  .ev-input:focus, .ev-text:focus { outline: none; border-color: var(--navy-light); box-shadow: 0 0 0 3px rgba(200, 168, 75, 0.35); }
  .ev-input[aria-invalid='true'] { border-color: var(--bad); }
  .ev-input.is-big { min-height: 54px; font-size: 1.08rem; }
  .ev-input.is-code { font-family: var(--font-heading); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .ev-input.is-code::placeholder { text-transform: none; }
  .ev-text { resize: vertical; min-height: 88px; line-height: 1.5; }
  .ev-q .ev-input, .ev-q .ev-text { margin-top: 8px; }

  .ev-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 0 20px;
    border-radius: 14px; border: 2px solid transparent; font-family: var(--font-heading); font-weight: 800; font-size: 1rem;
    cursor: pointer; transition: transform var(--transition-fast, 0.15s);
  }
  .ev-btn:active:not(:disabled) { transform: scale(0.98); }
  .ev-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ev-btn.is-primary { background: var(--navy); color: var(--white); }
  .ev-btn.is-ghost { background: var(--white); color: var(--navy); border-color: var(--gray-200); }
  .ev-btn.is-block { width: 100%; margin-top: 20px; }
  .ev-link {
    background: none; border: none; padding: 10px 4px; font: inherit; font-weight: 700; font-size: 0.92rem;
    color: var(--navy-light); text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
  }
  .ev-link:disabled { color: var(--gray-400); text-decoration: none; cursor: default; }
  .ev-link.is-small { padding: 4px; font-size: 0.82rem; margin-left: auto; flex-shrink: 0; }

  .ev-error {
    margin: 8px 0 0; display: flex; gap: 8px; align-items: flex-start; font-size: 0.9rem; font-weight: 600;
    color: var(--bad); line-height: 1.45;
  }
  .ev-error i { margin-top: 3px; }

  .ev-who {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px;
    background: var(--white); box-shadow: var(--shadow-sm); font-size: 0.88rem;
  }
  .ev-who > i { color: var(--ok); }
  .ev-who strong { color: var(--navy); }
  .ev-who-id { color: var(--gray-600); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .ev-progress { height: 8px; border-radius: 999px; background: var(--gray-100); overflow: hidden; }
  .ev-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--gold), var(--gold-dark)); transition: width 0.3s; }
  .ev-step { margin: 10px 0 0; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600); }
  .ev-schedule { margin: 6px 0 0; font-size: 0.86rem; color: var(--gray-600); }
  .ev-note { margin: 8px 0 0; font-size: 0.9rem; line-height: 1.5; color: var(--gray-600); font-style: italic; }
  .ev-legend {
    margin: 14px 0 0; padding: 12px; border-radius: 12px; background: var(--off-white); font-size: 0.9rem; line-height: 1.5;
  }

  .ev-questions { list-style: none; margin: 8px 0 0; padding: 0; }
  .ev-q { padding: 18px 0; border-bottom: 1px solid var(--gray-100); scroll-margin: 90px; }
  .ev-q:last-child { border-bottom: none; padding-bottom: 4px; }
  .ev-q.has-error { margin: 0 -10px; padding-left: 10px; padding-right: 10px; border-radius: 12px; background: var(--bad-bg); }
  .ev-prompt { margin: 0; font-weight: 600; color: var(--navy); font-size: 1rem; line-height: 1.45; }
  .ev-optional { font-weight: 400; color: var(--gray-400); font-size: 0.88rem; }

  .ev-rating { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 10px; }
  .ev-scale { display: grid; grid-template-columns: repeat(var(--half), 1fr); gap: 6px; margin-top: 10px; }
  @media (min-width: 520px) { .ev-scale { grid-template-columns: repeat(var(--n), 1fr); } }
  .ev-scale-ends { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; font-size: 0.8rem; color: var(--gray-600); }
  .ev-scale-ends .is-max { margin-left: auto; text-align: right; }
  .ev-choices { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }

  .ev-pick {
    min-height: 50px; min-width: 0; padding: 0 6px; border-radius: 12px; border: 2px solid var(--gray-200);
    background: var(--white); color: var(--navy); font-family: var(--font-heading); font-weight: 800; font-size: 1.1rem;
    cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.12s, border-color 0.12s;
  }
  .ev-pick:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
  .ev-pick.is-na { font-size: 0.86rem; color: var(--gray-600); }
  .ev-pick.is-wide { padding: 0 16px; font-family: var(--font-body); font-weight: 600; font-size: 0.95rem; }
  .ev-pick.is-on { background: var(--navy); border-color: var(--navy); color: var(--white); }
  .ev-pick.is-na.is-on { background: var(--gray-600); border-color: var(--gray-600); }

  .ev-bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
    background: rgba(255, 255, 255, 0.96); border-top: 1px solid var(--gray-200);
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); backdrop-filter: blur(6px);
  }
  .ev-bar-inner { max-width: 528px; margin: 0 auto; display: grid; grid-template-columns: 1fr 2fr; gap: 10px; }

  .ev-state { text-align: center; padding: 32px 20px; }
  .ev-state-icon {
    width: 68px; height: 68px; margin: 0 auto 14px; border-radius: 50%; display: grid; place-items: center;
    background: var(--gray-100); color: var(--navy-light); font-size: 1.7rem;
  }
  .ev-state-icon.is-ok { background: var(--ok-bg); color: var(--ok); }
  .ev-state-title { margin: 4px 0 0; font-family: var(--font-heading); font-size: 1.35rem; font-weight: 800; color: var(--navy); }
  .ev-state-body { margin: 10px auto 0; max-width: 34ch; font-size: 0.96rem; line-height: 1.55; display: flex; flex-direction: column; gap: 16px; align-items: center; }
  .ev-state-btn { min-width: 180px; }

  @media (prefers-reduced-motion: reduce) {
    .ev-progress span, .ev-pick, .ev-btn { transition: none; }
  }
`

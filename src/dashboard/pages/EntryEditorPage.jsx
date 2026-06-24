import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form'
import StatusBadge from '../components/StatusBadge'
import Readiness from '../components/Readiness'
import {
  isEditable,
  computeReadiness,
  submissionWindow,
  statusMeta,
  formatDate,
  EXEC_SUMMARY_MAX,
  NARRATIVE_MAX,
  SUBMISSION_KIND_LABELS,
  STATUS_FLOW,
  COVERAGE_OPTIONS,
  labelFor,
} from '@/lib/pearlAwards'

const TABS = [
  { key: 'bidbook', label: 'Bidbook', icon: 'fa-book-open', reqKeys: ['summary', 'narratives', 'documents'] },
  { key: 'declaration', label: 'Declaration', icon: 'fa-file-signature', reqKeys: ['declaration'] },
  { key: 'endorsement', label: 'LCE Endorsement', icon: 'fa-stamp', reqKeys: ['endorsement'] },
  { key: 'review', label: 'Review & Submit', icon: 'fa-paper-plane', reqKeys: [] },
]

export default function EntryEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('bidbook')

  const { loading, error, data, reload } = useAsync(async () => {
    const [entry, catalog] = await Promise.all([
      api.get(`/entries/${id}`, { auth: true }),
      api.get('/award-categories/'),
    ])
    const category = catalog.categories.find((c) => c.number === entry.categoryNumber) || null
    return { entry, catalog, category }
  }, [id])

  const [entry, setEntry] = useState(null)
  // Keep a local working copy of the entry so per-section saves update the
  // readiness/stepper without a full refetch.
  const workingEntry = entry || data?.entry
  const category = data?.category
  const catalog = data?.catalog

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t open this entry" />

  const readOnly = !isEditable(workingEntry.status)
  const readiness = computeReadiness(workingEntry, category)
  const doneByKey = Object.fromEntries(readiness.items.map((i) => [i.key, i.done]))

  const tabDone = (t) => t.reqKeys.length > 0 && t.reqKeys.every((k) => doneByKey[k] === true)

  return (
    <>
      <button type="button" className="dash-btn is-ghost is-sm" onClick={() => navigate('/dashboard/entries')} style={{ paddingLeft: 0, marginBottom: 10 }}>
        <i className="fas fa-arrow-left" aria-hidden="true" /> My entries
      </button>

      <header className="ed-head dash-card dash-card-pad">
        <div className="ed-head-main">
          <div className="ed-head-top">
            <span className="dash-badge tone-progress">Category #{workingEntry.categoryNumber}</span>
            <StatusBadge status={workingEntry.status} />
          </div>
          <h1 className="ed-title">{workingEntry.title}</h1>
          <p className="ed-sub">
            {category?.name} · {workingEntry.lguName} · {labelFor(COVERAGE_OPTIONS, workingEntry.coverage)}
          </p>
        </div>
        <div className="ed-head-side">
          <StatusStepper status={workingEntry.status} />
          <div className="ed-head-meter"><Readiness readiness={readiness} showList={false} /></div>
        </div>
      </header>

      {workingEntry.decisionReason && (
        <div className={`dash-banner tone-${workingEntry.status === 'Disqualified' ? 'error' : 'warn'}`} style={{ marginTop: 14 }}>
          <i className="fas fa-circle-info" aria-hidden="true" />
          <span><strong>Reviewer note.</strong> {workingEntry.decisionReason}</span>
        </div>
      )}

      {readOnly && workingEntry.status !== 'Disqualified' && (
        <div className="dash-banner tone-info" style={{ marginTop: 14 }}>
          <i className="fas fa-lock" aria-hidden="true" />
          <span>This entry is <strong>{statusMeta(workingEntry.status).label.toLowerCase()}</strong> and is read-only.</span>
        </div>
      )}

      <nav className="dash-tabs ed-tabs" style={{ marginTop: 18 }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`dash-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            <i className={`fas ${t.icon}`} aria-hidden="true" />
            {t.label}
            {t.reqKeys.length > 0 && <span className={`pip${tabDone(t) ? ' is-done' : ''}`} aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="ed-panel">
        <div hidden={tab !== 'bidbook'}>
          <BidbookSection entry={workingEntry} category={category} readOnly={readOnly} onSaved={setEntry} />
        </div>
        <div hidden={tab !== 'declaration'}>
          <DeclarationSection entry={workingEntry} readOnly={readOnly} onSaved={setEntry} />
        </div>
        <div hidden={tab !== 'endorsement'}>
          <EndorsementSection entry={workingEntry} readOnly={readOnly} onSaved={setEntry} />
        </div>
        <div hidden={tab !== 'review'}>
          <ReviewSection entry={workingEntry} catalog={catalog} readiness={readiness} readOnly={readOnly} onSaved={setEntry} goTo={setTab} />
        </div>
      </div>

      <style>{EDITOR_CSS}</style>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Status stepper                                                      */
/* ------------------------------------------------------------------ */
function StatusStepper({ status }) {
  // Off-path states collapse onto the nearest happy-path node.
  const idxByStatus = { Draft: 0, ReturnedForRevision: 0, Submitted: 1, UnderValidation: 2, Validated: 3, Disqualified: 2 }
  const current = idxByStatus[status] ?? 0
  return (
    <div className="dash-steps" aria-hidden="true">
      {STATUS_FLOW.map((s, i) => (
        <span key={s} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && <span className={`dash-step-line${i <= current ? ' is-done' : ''}`} />}
          <span className={`dash-step${i === current ? ' is-active' : i < current ? ' is-done' : ''}`}>
            <span className="dash-step-dot">{i < current ? <i className="fas fa-check" /> : i + 1}</span>
            {statusMeta(s).label}
          </span>
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bidbook                                                             */
/* ------------------------------------------------------------------ */
function BidbookSection({ entry, category, readOnly, onSaved }) {
  const criteria = useMemo(() => [...(category?.criteria || [])].sort((a, b) => a.order - b.order), [category])
  const submissions = useMemo(
    () => [...(category?.requiredSubmissions || [])].sort((a, b) => a.order - b.order),
    [category],
  )

  const [summary, setSummary] = useState(entry.bidbook?.executiveSummary || '')
  const [narratives, setNarratives] = useState(() => {
    const seed = {}
    ;(entry.bidbook?.narratives || []).forEach((n) => { seed[n.criterionId] = n.text })
    return seed
  })
  const [docs, setDocs] = useState(() => {
    const seed = {}
    ;(entry.bidbook?.supportingDocuments || []).forEach((d) => {
      seed[d.label] = { link: d.link || '', fileKey: d.fileKey || null, fileName: d.fileName || null, contentType: d.contentType || null }
    })
    return seed
  })
  const [uploading, setUploading] = useState(null) // label currently uploading
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banner, setBanner] = useState(null)

  const touch = () => { setSaved(false); setBanner(null) }

  // ---- supporting-document files ----
  const docOf = (label) => docs[label] || { link: '', fileKey: null, fileName: null, contentType: null }
  const savedDocByLabel = new Map((entry.bidbook?.supportingDocuments || []).map((d) => [d.label, d]))
  // A file can be viewed once it's saved to the entry (the URL endpoint reads the stored doc).
  const isSaved = (label) => {
    const saved = savedDocByLabel.get(label)
    return !!(saved?.fileKey && saved.fileKey === docOf(label).fileKey)
  }
  async function uploadFile(label, file) {
    if (!file) return
    setUploading(label); setBanner(null)
    try {
      const contentType = file.type || 'application/octet-stream'
      const pres = await api.post(`/entries/${entry.id}/documents/presign`, { label, fileName: file.name, contentType }, { auth: true })
      const res = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`)
      setDocs((d) => ({ ...d, [label]: { link: '', fileKey: pres.fileKey, fileName: file.name, contentType } }))
      touch()
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t upload that file. Please try again.')
    } finally {
      setUploading(null)
    }
  }
  function removeFile(label) {
    setDocs((d) => ({ ...d, [label]: { link: '', fileKey: null, fileName: null, contentType: null } }))
    touch()
  }
  function setLink(label, link) {
    setDocs((d) => ({ ...d, [label]: { ...(d[label] || { fileKey: null, fileName: null, contentType: null }), link } }))
    touch()
  }
  async function viewDoc(label) {
    try {
      const { url } = await api.get(`/entries/${entry.id}/documents/url?label=${encodeURIComponent(label)}`, { auth: true })
      window.open(url, '_blank', 'noopener')
    } catch {
      setBanner('Save your changes first, then you can view the file.')
    }
  }

  const summaryOver = summary.length > EXEC_SUMMARY_MAX
  const narrativeOver = Object.values(narratives).some((t) => (t || '').length > NARRATIVE_MAX)
  const blocked = summaryOver || narrativeOver

  async function save() {
    setSaving(true)
    setBanner(null)
    try {
      const payload = {
        executiveSummary: summary,
        narratives: criteria
          .filter((c) => (narratives[c.id] || '').trim())
          .map((c) => ({ criterionId: c.id, text: narratives[c.id].trim() })),
        supportingDocuments: submissions
          .map((s) => ({ label: s.label, d: docOf(s.label) }))
          .filter(({ d }) => (d.link || '').trim() || d.fileKey)
          .map(({ label, d }) => ({
            label,
            link: (d.link || '').trim() || null,
            fileKey: d.fileKey || null,
            fileName: d.fileName || null,
            contentType: d.contentType || null,
          })),
      }
      const updated = await api.put(`/entries/${entry.id}/bidbook`, payload, { auth: true })
      onSaved(updated)
      setSaved(true)
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t save the bidbook. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ed-stack">
      <SectionIntro
        icon="fa-book-open"
        title="Bidbook"
        desc="The heart of your entry: an executive summary, a narrative for each criterion, and your supporting documents."
      />

      <section className="dash-card dash-card-pad ed-block">
        <Field
          label="Executive summary"
          htmlFor="execSummary"
          hint="A concise overview of the program and its impact."
          counter={{ text: `${summary.length}/${EXEC_SUMMARY_MAX}`, over: summaryOver }}
        >
          <textarea
            id="execSummary"
            className={ctl('dash-textarea', summaryOver)}
            style={{ minHeight: 150 }}
            value={summary}
            disabled={readOnly}
            onChange={(e) => { setSummary(e.target.value); touch() }}
            placeholder="Summarize the initiative, its goals, and the results it achieved…"
          />
        </Field>
      </section>

      <section className="dash-card dash-card-pad ed-block">
        <div className="dash-card-title" style={{ marginBottom: 4 }}><i className="fas fa-list-check" aria-hidden="true" /> Criteria narratives</div>
        <p className="dash-help" style={{ marginBottom: 6 }}>Address each scoring criterion. Points show how heavily each is weighted.</p>
        {criteria.map((c) => {
          const text = narratives[c.id] || ''
          const over = text.length > NARRATIVE_MAX
          return (
            <div key={c.id} className="ed-criterion">
              <div className="ed-criterion-head">
                <span className="ed-criterion-name">{c.name}</span>
                <span className="dash-badge tone-progress">{c.points} pts</span>
              </div>
              {c.indicators && <p className="ed-criterion-ind">{c.indicators}</p>}
              <Field counter={{ text: `${text.length}/${NARRATIVE_MAX}`, over }}>
                <textarea
                  className={ctl('dash-textarea', over)}
                  value={text}
                  disabled={readOnly}
                  onChange={(e) => { setNarratives((n) => ({ ...n, [c.id]: e.target.value })); touch() }}
                  placeholder={`Describe how your program meets “${c.name}”…`}
                />
              </Field>
            </div>
          )
        })}
        {criteria.length === 0 && <p className="dash-help">No criteria found for this category.</p>}
      </section>

      <section className="dash-card dash-card-pad ed-block">
        <div className="dash-card-title" style={{ marginBottom: 4 }}><i className="fas fa-paperclip" aria-hidden="true" /> Supporting documents</div>
        <p className="dash-help" style={{ marginBottom: 6 }}>Upload a file or paste a shareable link for each item. Mandatory items are required to submit.</p>
        {submissions.map((s) => {
          const d = docOf(s.label)
          const busy = uploading === s.label
          return (
            <div key={s.label} className="ed-doc">
              <div className="ed-doc-head">
                <span className="ed-doc-label">{s.label}</span>
                <span className={`dash-badge ${s.mandatory ? 'tone-warn' : 'tone-neutral'}`}>
                  {s.mandatory ? 'Required' : 'Optional'}
                </span>
              </div>
              <div className="ed-doc-kind">{SUBMISSION_KIND_LABELS[s.kind] || s.kind}{s.specs ? ` · ${s.specs}` : ''}</div>

              {d.fileKey ? (
                <div className="ed-file">
                  <i className="fas fa-file-lines" aria-hidden="true" />
                  <span className="ed-file-name">{d.fileName || 'Uploaded file'}</span>
                  {isSaved(s.label) ? (
                    <button type="button" className="dash-btn is-ghost is-sm" onClick={() => viewDoc(s.label)}>
                      <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" /> View
                    </button>
                  ) : (
                    <span className="ed-file-note">uploaded · save to view</span>
                  )}
                  {!readOnly && (
                    <button type="button" className="dash-btn is-ghost is-sm" onClick={() => removeFile(s.label)}>
                      <i className="fas fa-xmark" aria-hidden="true" /> Remove
                    </button>
                  )}
                </div>
              ) : (
                <div className="ed-doc-upload">
                  {!readOnly && (
                    <label className={`dash-btn is-sm ed-upload-btn${busy ? ' is-busy' : ''}`}>
                      {busy
                        ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Uploading…</>
                        : <><i className="fas fa-upload" aria-hidden="true" /> Upload file</>}
                      <input type="file" hidden disabled={busy} onChange={(e) => uploadFile(s.label, e.target.files?.[0])} />
                    </label>
                  )}
                  <span className="ed-doc-or">or</span>
                  <input
                    className="dash-input ed-doc-link"
                    type="url"
                    value={d.link}
                    disabled={readOnly || busy}
                    onChange={(e) => setLink(s.label, e.target.value)}
                    placeholder="paste a shareable link…"
                  />
                </div>
              )}
            </div>
          )
        })}
        {submissions.length === 0 && <p className="dash-help">No documents are required for this category.</p>}
      </section>

      {!readOnly && (
        <SaveBar saving={saving} saved={saved} blocked={blocked} banner={banner} onSave={save}
          blockedMsg="Some fields are over their character limit." />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Declaration                                                         */
/* ------------------------------------------------------------------ */
const DECLARATION_STATEMENTS = [
  'The information and documents in this entry are true, accurate, and complete.',
  'The program described was implemented by the nominated LGU within the coverage year.',
  'We consent to ATOP verifying the submission and using it for the Pearl Awards.',
  'We agree to abide by the Pearl Awards rules and the decisions of the assessors.',
  'The named signatory is authorized to make this declaration on the LGU’s behalf.',
]

function DeclarationSection({ entry, readOnly, onSaved }) {
  const d = entry.declaration
  const [certified, setCertified] = useState(!!d?.certified)
  const [name, setName] = useState(d?.signatoryName || '')
  const [designation, setDesignation] = useState(d?.signatoryDesignation || '')
  const [signature, setSignature] = useState(d?.eSignature || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banner, setBanner] = useState(null)
  const [errors, setErrors] = useState({})

  const touch = () => { setSaved(false); setBanner(null) }

  async function save() {
    const e = {}
    if (!name.trim()) e.name = 'Signatory name is required.'
    if (!designation.trim()) e.designation = 'Designation is required.'
    if (!signature.trim()) e.signature = 'Type your name to sign.'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    setBanner(null)
    try {
      const res = await api.post(`/entries/${entry.id}/declaration`, {
        certified, signatoryName: name.trim(), signatoryDesignation: designation.trim(), eSignature: signature.trim(),
      }, { auth: true })
      onSaved({ ...entry, declaration: res })
      setSaved(true)
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t save the declaration. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ed-stack">
      <SectionIntro icon="fa-file-signature" title="Declaration"
        desc="The applicant certifies the entry. Read the statements, then sign." />

      <section className="dash-card dash-card-pad ed-block">
        <ul className="ed-statements">
          {DECLARATION_STATEMENTS.map((s, i) => (
            <li key={i}><i className="fas fa-circle-check" aria-hidden="true" /> {s}</li>
          ))}
        </ul>
        <label className="dash-check ed-certify">
          <input type="checkbox" checked={certified} disabled={readOnly} onChange={(e) => { setCertified(e.target.checked); touch() }} />
          <span>I certify, on behalf of the LGU, that all statements above are true and this submission complies with the Pearl Awards rules.</span>
        </label>

        <div className="dash-form-row" style={{ marginTop: 16 }}>
          <Field label="Signatory name" required error={errors.name}>
            <input className={ctl('dash-input', errors.name)} value={name} disabled={readOnly} onChange={(e) => { setName(e.target.value); touch() }} />
          </Field>
          <Field label="Designation" required error={errors.designation}>
            <input className={ctl('dash-input', errors.designation)} value={designation} disabled={readOnly} onChange={(e) => { setDesignation(e.target.value); touch() }} />
          </Field>
        </div>
        <Field label="E-signature" required error={errors.signature} hint="Type your full name to sign electronically.">
          <input className={ctl('dash-input ed-signature', errors.signature)} value={signature} disabled={readOnly} onChange={(e) => { setSignature(e.target.value); touch() }} placeholder="Your full name" />
        </Field>
        {d?.signedAt && <p className="dash-help" style={{ marginTop: 6 }}>Last signed {formatDate(d.signedAt, { dateStyle: 'medium', timeStyle: 'short' })}.</p>}
      </section>

      {!readOnly && <SaveBar saving={saving} saved={saved} banner={banner} onSave={save} saveLabel="Save declaration" />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* LCE Endorsement                                                     */
/* ------------------------------------------------------------------ */
function EndorsementSection({ entry, readOnly, onSaved }) {
  const l = entry.lceEndorsement
  const [endorsed, setEndorsed] = useState(!!l?.endorsed)
  const [name, setName] = useState(l?.lceName || '')
  const [designation, setDesignation] = useState(l?.lceDesignation || '')
  const [signature, setSignature] = useState(l?.eSignature || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banner, setBanner] = useState(null)
  const [errors, setErrors] = useState({})

  const touch = () => { setSaved(false); setBanner(null) }

  async function save() {
    const e = {}
    if (!name.trim()) e.name = 'LCE name is required.'
    if (!designation.trim()) e.designation = 'Designation is required.'
    if (!signature.trim()) e.signature = 'Type the LCE’s name to sign.'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    setBanner(null)
    try {
      const res = await api.post(`/entries/${entry.id}/lce-endorsement`, {
        endorsed, lceName: name.trim(), lceDesignation: designation.trim(), eSignature: signature.trim(),
      }, { auth: true })
      onSaved({ ...entry, lceEndorsement: res })
      setSaved(true)
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t save the endorsement. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ed-stack">
      <SectionIntro icon="fa-stamp" title="LCE endorsement"
        desc="The Local Chief Executive (Governor or Mayor) endorses this entry." />

      <section className="dash-card dash-card-pad ed-block">
        <label className="dash-check ed-certify" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={endorsed} disabled={readOnly} onChange={(e) => { setEndorsed(e.target.checked); touch() }} />
          <span>The Local Chief Executive endorses this entry and supports the LGU’s participation in the Pearl Awards.</span>
        </label>

        <div className="dash-form-row" style={{ marginTop: 16 }}>
          <Field label="LCE name" required error={errors.name}>
            <input className={ctl('dash-input', errors.name)} value={name} disabled={readOnly} onChange={(e) => { setName(e.target.value); touch() }} />
          </Field>
          <Field label="Designation" required error={errors.designation} hint="e.g. Provincial Governor">
            <input className={ctl('dash-input', errors.designation)} value={designation} disabled={readOnly} onChange={(e) => { setDesignation(e.target.value); touch() }} />
          </Field>
        </div>
        <Field label="E-signature" required error={errors.signature} hint="Type the LCE’s full name to sign electronically.">
          <input className={ctl('dash-input ed-signature', errors.signature)} value={signature} disabled={readOnly} onChange={(e) => { setSignature(e.target.value); touch() }} placeholder="LCE’s full name" />
        </Field>
        {l?.signedAt && <p className="dash-help" style={{ marginTop: 6 }}>Last signed {formatDate(l.signedAt, { dateStyle: 'medium', timeStyle: 'short' })}.</p>}
      </section>

      {!readOnly && <SaveBar saving={saving} saved={saved} banner={banner} onSave={save} saveLabel="Save endorsement" />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Review & Submit                                                     */
/* ------------------------------------------------------------------ */
function ReviewSection({ entry, catalog, readiness, readOnly, onSaved, goTo }) {
  const [submitting, setSubmitting] = useState(false)
  const [blockers, setBlockers] = useState(null)
  const [banner, setBanner] = useState(null)
  const win = submissionWindow(catalog)
  const windowOpen = win?.state === 'open'

  async function submit() {
    setSubmitting(true)
    setBlockers(null)
    setBanner(null)
    try {
      const res = await api.post(`/entries/${entry.id}/submit`, undefined, { auth: true })
      onSaved({ ...entry, status: res.status, submittedAt: res.submittedAt })
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.submission) {
        setBlockers(err.fieldErrors.submission)
      } else {
        setBanner(err instanceof ApiError ? err.message : 'We couldn’t submit the entry. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (readOnly) {
    const m = statusMeta(entry.status)
    const good = entry.status === 'Validated'
    const bad = entry.status === 'Disqualified'
    return (
      <div className="ed-stack">
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon" style={good ? { color: '#16A34A', background: '#F0FDF4', borderColor: '#BBF7D0' } : bad ? { color: '#B91C1C', background: '#FEF2F2', borderColor: '#FECACA' } : undefined}>
            <i className={`fas ${m.icon}`} aria-hidden="true" />
          </div>
          <h3>{m.label}</h3>
          <p>
            {entry.status === 'Submitted' && `Submitted ${formatDate(entry.submittedAt)}. It’s now with the secretariat for validation.`}
            {entry.status === 'UnderValidation' && 'Your entry is being validated by the review team.'}
            {good && 'Congratulations — your entry passed validation.'}
            {bad && 'This entry did not pass validation. See the reviewer note above.'}
          </p>
        </div>
      </div>
    )
  }

  const canSubmit = readiness.ready && windowOpen && !submitting

  return (
    <div className="ed-stack">
      <SectionIntro icon="fa-paper-plane" title="Review & submit"
        desc="A final check against the submission requirements. Submitting locks the entry for validation." />

      <section className="dash-card dash-card-pad ed-block">
        <Readiness readiness={readiness} />
      </section>

      {win && !windowOpen && (
        <div className="dash-banner tone-warn">
          <i className="fas fa-calendar-xmark" aria-hidden="true" />
          <span>
            {win.state === 'upcoming'
              ? `Submissions open ${formatDate(win.opens)}. You can prepare your entry now and submit once the window opens.`
              : `The submission window closed on ${formatDate(win.closes)}.`}
          </span>
        </div>
      )}

      {blockers && (
        <div className="dash-banner tone-error">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
          <span>
            <strong>The server blocked this submission:</strong>
            <ul className="ed-blockers">{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </span>
        </div>
      )}
      {banner && <div className="dash-banner tone-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{banner}</span></div>}

      {!readiness.ready && (
        <div className="dash-banner tone-info">
          <i className="fas fa-circle-info" aria-hidden="true" />
          <span>Finish the unchecked items above. Jump to the <button type="button" className="dash-inline-link ed-linkbtn" onClick={() => goTo('bidbook')}>Bidbook</button>, <button type="button" className="dash-inline-link ed-linkbtn" onClick={() => goTo('declaration')}>Declaration</button>, or <button type="button" className="dash-inline-link ed-linkbtn" onClick={() => goTo('endorsement')}>Endorsement</button>.</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="dash-btn is-primary" disabled={!canSubmit} onClick={submit}>
          {submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Submitting…</> : <>Submit entry <i className="fas fa-paper-plane" aria-hidden="true" /></>}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */
function SectionIntro({ icon, title, desc }) {
  return (
    <div className="ed-intro">
      <h2 className="ed-intro-title"><i className={`fas ${icon}`} aria-hidden="true" /> {title}</h2>
      <p className="ed-intro-desc">{desc}</p>
    </div>
  )
}

function SaveBar({ saving, saved, blocked, banner, onSave, saveLabel = 'Save bidbook', blockedMsg }) {
  return (
    <div className="ed-savebar">
      <div className="ed-savebar-status">
        {banner ? (
          <span className="dash-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {banner}</span>
        ) : blocked ? (
          <span className="dash-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {blockedMsg}</span>
        ) : saved ? (
          <span className="ed-saved"><i className="fas fa-circle-check" aria-hidden="true" /> Saved</span>
        ) : (
          <span className="dash-help">Changes are saved per section.</span>
        )}
      </div>
      <button type="button" className="dash-btn is-primary" disabled={saving || blocked} onClick={onSave}>
        {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : <><i className="fas fa-floppy-disk" aria-hidden="true" /> {saveLabel}</>}
      </button>
    </div>
  )
}

const EDITOR_CSS = `
  .ed-head { display: flex; gap: 24px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
  .ed-head-main { min-width: 0; }
  .ed-head-top { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
  .ed-title { font-family: var(--font-heading); font-size: clamp(1.3rem, 2.4vw, 1.75rem); font-weight: 800; color: var(--navy); line-height: 1.18; }
  .ed-sub { color: var(--gray-600); font-size: 0.9rem; margin-top: 6px; }
  .ed-head-side { display: flex; flex-direction: column; gap: 16px; min-width: 280px; flex: 1; max-width: 420px; }
  .ed-head-meter { width: 100%; }
  .ed-panel { margin-top: 22px; }
  .ed-stack { display: flex; flex-direction: column; gap: 18px; }
  .ed-intro { padding: 0 2px; }
  .ed-intro-title { font-family: var(--font-heading); font-size: 1.2rem; font-weight: 800; color: var(--navy); display: flex; align-items: center; gap: 10px; }
  .ed-intro-title i { color: var(--gold-dark); }
  .ed-intro-desc { color: var(--gray-600); font-size: 0.9rem; margin-top: 5px; line-height: 1.55; }
  .ed-block { display: flex; flex-direction: column; gap: 14px; }
  .ed-criterion { padding: 16px 0; border-top: 1px solid var(--gray-100); display: flex; flex-direction: column; gap: 10px; }
  .ed-criterion:first-of-type { border-top: none; }
  .ed-criterion-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ed-criterion-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.95rem; }
  .ed-criterion-ind { color: var(--gray-600); font-size: 0.82rem; line-height: 1.55; }
  .ed-doc { padding: 14px 0; border-top: 1px solid var(--gray-100); display: flex; flex-direction: column; gap: 8px; }
  .ed-doc:first-of-type { border-top: none; }
  .ed-doc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ed-doc-label { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; }
  .ed-doc-kind { font-size: 0.78rem; color: var(--gray-400); }
  .ed-doc-upload { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .ed-upload-btn { cursor: pointer; flex-shrink: 0; }
  .ed-upload-btn.is-busy { opacity: 0.7; pointer-events: none; }
  .ed-doc-or { color: var(--gray-400); font-size: 0.76rem; font-family: var(--font-heading); font-weight: 600; }
  .ed-doc-link { flex: 1; min-width: 180px; }
  .ed-file { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; background: var(--off-white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .ed-file > i { color: var(--gold-dark); font-size: 1rem; }
  .ed-file-name { font-family: var(--font-heading); font-weight: 600; color: var(--navy); font-size: 0.88rem; flex: 1; min-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ed-file-note { font-size: 0.74rem; color: var(--gray-400); font-family: var(--font-heading); font-weight: 600; }
  .ed-statements { display: flex; flex-direction: column; gap: 10px; margin-bottom: 6px; }
  .ed-statements li { display: flex; gap: 10px; align-items: flex-start; color: var(--text-body); font-size: 0.9rem; line-height: 1.5; }
  .ed-statements i { color: #16A34A; margin-top: 3px; }
  .ed-certify { margin-top: 12px; padding: 14px; background: var(--off-white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .ed-signature { font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 1.15rem; letter-spacing: 0.02em; }
  .ed-savebar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); position: sticky; bottom: 14px; }
  .ed-savebar-status { min-width: 0; }
  .ed-saved { color: #15803D; font-family: var(--font-heading); font-weight: 700; font-size: 0.84rem; display: inline-flex; align-items: center; gap: 7px; }
  .ed-blockers { margin: 8px 0 0 18px; list-style: disc; display: flex; flex-direction: column; gap: 4px; }
  .ed-linkbtn { background: none; border: none; padding: 0; cursor: pointer; color: inherit; font: inherit; }
  .dash-inline-link { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
  @media (max-width: 760px) {
    .ed-head-side { max-width: none; min-width: 0; width: 100%; }
    .ed-savebar { flex-direction: column; align-items: stretch; }
    .ed-savebar .dash-btn { width: 100%; }
  }
`

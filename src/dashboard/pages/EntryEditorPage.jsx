import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { useAutosave } from '../useAutosave'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form'
import StatusBadge from '../components/StatusBadge'
import Readiness from '../components/Readiness'
import CommentThread from '../components/CommentThread'
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
  MAX_UPLOAD_BYTES,
  EVIDENCE_MAX_FILES,
  uploadRulesFor,
  formatBytes,
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
  const win = submissionWindow(catalog)
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
            <EntryActions
              entry={workingEntry}
              win={win}
              onWithdrawn={(res) => setEntry({ ...workingEntry, status: res.status, submittedAt: res.submittedAt })}
              onDeleted={() => navigate('/dashboard/entries')}
            />
          </div>
          <h1 className="ed-title">{workingEntry.title}</h1>
          <p className="ed-sub">
            {category?.name} · {workingEntry.lguName} · {labelFor(COVERAGE_OPTIONS, workingEntry.coverage)}
          </p>
        </div>
        <div className="ed-head-side">
          <div className="ed-head-meter"><Readiness readiness={readiness} showList={false} /></div>
        </div>
        <div className="ed-head-timeline">
          <StatusStepper status={workingEntry.status} />
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
          <SectionNav next={TABS[1]} onGo={setTab} />
        </div>
        <div hidden={tab !== 'declaration'}>
          <DeclarationSection entry={workingEntry} readOnly={readOnly} onSaved={setEntry} />
          <SectionNav prev={TABS[0]} next={TABS[2]} onGo={setTab} />
        </div>
        <div hidden={tab !== 'endorsement'}>
          <EndorsementSection entry={workingEntry} readOnly={readOnly} onSaved={setEntry} />
          <SectionNav prev={TABS[1]} next={TABS[3]} onGo={setTab} />
        </div>
        <div hidden={tab !== 'review'}>
          <ReviewSection entry={workingEntry} catalog={catalog} readiness={readiness} readOnly={readOnly} onSaved={setEntry} goTo={setTab} />
          <SectionNav prev={TABS[2]} onGo={setTab} />
        </div>
      </div>

      {workingEntry.status !== 'Draft' && <CommentThread entryId={workingEntry.id} />}

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
  const [evidence, setEvidence] = useState(() => {
    const seed = {}
    ;(entry.bidbook?.evidence || []).forEach((e) => {
      ;(seed[e.criterionId] ||= []).push({ fileKey: e.fileKey, fileName: e.fileName, contentType: e.contentType })
    })
    return seed
  })
  const [uploading, setUploading] = useState(null) // label currently uploading
  const [uploadingEvidence, setUploadingEvidence] = useState(null) // criterionId currently uploading
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [banner, setBanner] = useState(null)

  const touch = () => { setDirty(true); setBanner(null) }

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
    if (file.size > MAX_UPLOAD_BYTES) {
      setBanner(`That file is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}. Upload a smaller file or paste a link instead.`)
      return
    }
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

  // ---- per-criterion evidence files (optional, up to EVIDENCE_MAX_FILES each) ----
  const evidenceOf = (criterionId) => evidence[criterionId] || []
  // A file is viewable once it's saved to the entry (the URL endpoint reads stored evidence).
  const savedEvidenceKeys = new Set((entry.bidbook?.evidence || []).map((e) => e.fileKey))
  async function uploadEvidence(criterionId, file) {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setBanner(`That file is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}. Upload a smaller file.`)
      return
    }
    if (evidenceOf(criterionId).length >= EVIDENCE_MAX_FILES) {
      setBanner(`You can attach up to ${EVIDENCE_MAX_FILES} evidence files per criterion.`)
      return
    }
    setUploadingEvidence(criterionId); setBanner(null)
    try {
      const contentType = file.type || 'application/octet-stream'
      const pres = await api.post(`/entries/${entry.id}/evidence/presign`, { criterionId, fileName: file.name, contentType }, { auth: true })
      const res = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`)
      setEvidence((ev) => ({ ...ev, [criterionId]: [...(ev[criterionId] || []), { fileKey: pres.fileKey, fileName: file.name, contentType }] }))
      touch()
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t upload that file. Please try again.')
    } finally {
      setUploadingEvidence(null)
    }
  }
  function removeEvidence(criterionId, fileKey) {
    setEvidence((ev) => ({ ...ev, [criterionId]: (ev[criterionId] || []).filter((f) => f.fileKey !== fileKey) }))
    touch()
  }
  async function viewEvidence(fileKey) {
    try {
      const { url } = await api.get(`/entries/${entry.id}/evidence/url?fileKey=${encodeURIComponent(fileKey)}`, { auth: true })
      window.open(url, '_blank', 'noopener')
    } catch {
      setBanner('Save your changes first, then you can view the file.')
    }
  }

  const summaryOver = summary.length > EXEC_SUMMARY_MAX
  const narrativeOver = Object.values(narratives).some((t) => (t || '').length > NARRATIVE_MAX)
  const blocked = summaryOver || narrativeOver

  function buildPayload() {
    return {
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
      evidence: Object.entries(evidence).flatMap(([criterionId, files]) =>
        files.map((f) => ({ criterionId, fileKey: f.fileKey, fileName: f.fileName || null, contentType: f.contentType || null }))),
    }
  }

  async function doSave(silent = false) {
    if (!silent) { setSaving(true); setBanner(null) }
    try {
      const updated = await api.put(`/entries/${entry.id}/bidbook`, buildPayload(), { auth: true })
      if (!silent) { onSaved(updated); setDirty(false) }
    } catch (err) {
      if (!silent) setBanner(err instanceof ApiError ? err.message : 'We couldn’t save the bidbook. Please try again.')
    } finally {
      if (!silent) setSaving(false)
    }
  }

  // Autosave (debounced) while there are unsaved, within-limit changes; also
  // warns on tab close and flushes when navigating away.
  useAutosave({
    signature: JSON.stringify([summary, narratives, docs, evidence]),
    dirty,
    canSave: !blocked,
    onSave: doSave,
  })

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
          const files = evidenceOf(c.id)
          const evBusy = uploadingEvidence === c.id
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

              {(!readOnly || files.length > 0) && (
                <div className="ed-evidence">
                  <div className="ed-evidence-head">
                    <span className="ed-evidence-title"><i className="fas fa-paperclip" aria-hidden="true" /> Supporting evidence</span>
                    <span className="ed-evidence-opt">optional · up to {EVIDENCE_MAX_FILES} files</span>
                  </div>
                  {files.length > 0 && (
                    <ul className="ed-evidence-list">
                      {files.map((f) => (
                        <li key={f.fileKey} className="ed-evidence-item">
                          <i className="fas fa-file-lines" aria-hidden="true" />
                          <span className="ed-evidence-name">{f.fileName || 'Uploaded file'}</span>
                          {savedEvidenceKeys.has(f.fileKey) ? (
                            <button type="button" className="dash-btn is-ghost is-sm" onClick={() => viewEvidence(f.fileKey)}>
                              <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" /> View
                            </button>
                          ) : (
                            <span className="ed-file-note">uploaded · save to view</span>
                          )}
                          {!readOnly && (
                            <button type="button" className="dash-btn is-ghost is-sm" onClick={() => removeEvidence(c.id, f.fileKey)}>
                              <i className="fas fa-xmark" aria-hidden="true" /> Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!readOnly && files.length < EVIDENCE_MAX_FILES && (
                    <label className={`dash-btn is-ghost is-sm ed-upload-btn${evBusy ? ' is-busy' : ''}`}>
                      {evBusy
                        ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Uploading…</>
                        : <><i className="fas fa-upload" aria-hidden="true" /> Add file</>}
                      <input type="file" hidden disabled={evBusy} onChange={(e) => { uploadEvidence(c.id, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              )}
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
          const rules = uploadRulesFor(s.kind)
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
                  {!readOnly && rules.allowUpload && (
                    <>
                      <label className={`dash-btn is-sm ed-upload-btn${busy ? ' is-busy' : ''}`}>
                        {busy
                          ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Uploading…</>
                          : <><i className="fas fa-upload" aria-hidden="true" /> Upload file</>}
                        <input type="file" hidden accept={rules.accept} disabled={busy} onChange={(e) => uploadFile(s.label, e.target.files?.[0])} />
                      </label>
                      <span className="ed-doc-or">or</span>
                    </>
                  )}
                  <input
                    className="dash-input ed-doc-link"
                    type="url"
                    value={d.link}
                    disabled={readOnly || busy}
                    onChange={(e) => setLink(s.label, e.target.value)}
                    placeholder={rules.linkPlaceholder}
                  />
                </div>
              )}
            </div>
          )
        })}
        {submissions.length === 0 && <p className="dash-help">No documents are required for this category.</p>}
      </section>

      {!readOnly && (
        <SaveBar saving={saving} dirty={dirty} blocked={blocked} banner={banner} onSave={() => doSave(false)}
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
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [banner, setBanner] = useState(null)

  async function doSave(silent = false) {
    if (!silent) { setSaving(true); setBanner(null) }
    try {
      const res = await api.post(`/entries/${entry.id}/declaration`, { certified }, { auth: true })
      if (!silent) { onSaved({ ...entry, declaration: res }); setDirty(false) }
    } catch (err) {
      if (!silent) setBanner(err instanceof ApiError ? err.message : 'We couldn’t save the declaration. Please try again.')
    } finally {
      if (!silent) setSaving(false)
    }
  }

  useAutosave({ signature: JSON.stringify([certified]), dirty, canSave: true, onSave: doSave })

  return (
    <div className="ed-stack">
      <SectionIntro icon="fa-file-signature" title="Declaration"
        desc="The applicant certifies the entry. Read the statements, then check the box to certify — that is your signature." />

      <section className="dash-card dash-card-pad ed-block">
        <ul className="ed-statements">
          {DECLARATION_STATEMENTS.map((s, i) => (
            <li key={i}><i className="fas fa-circle-check" aria-hidden="true" /> {s}</li>
          ))}
        </ul>
        <label className="dash-check ed-certify">
          <input type="checkbox" checked={certified} disabled={readOnly} onChange={(e) => { setCertified(e.target.checked); setDirty(true); setBanner(null) }} />
          <span>I certify, on behalf of the LGU, that all statements above are true and this submission complies with the Pearl Awards rules.</span>
        </label>
        {d?.signedAt && certified && (
          <p className="dash-help" style={{ marginTop: 12 }}>Certified {formatDate(d.signedAt, { dateStyle: 'medium', timeStyle: 'short' })}.</p>
        )}
      </section>

      {!readOnly && <SaveBar saving={saving} dirty={dirty} banner={banner} onSave={() => doSave(false)} saveLabel="Save declaration" />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* LCE Endorsement                                                     */
/* ------------------------------------------------------------------ */
function EndorsementSection({ entry, readOnly, onSaved }) {
  const l = entry.lceEndorsement
  const [endorsed, setEndorsed] = useState(!!l?.endorsed)
  const [file, setFile] = useState(l?.fileKey ? { fileKey: l.fileKey, fileName: l.fileName, contentType: l.contentType } : null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [banner, setBanner] = useState(null)
  const [errors, setErrors] = useState({})

  const touch = () => { setDirty(true); setBanner(null) }
  const valid = !!(endorsed && file?.fileKey)

  async function onPick(e) {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      setBanner(`That file is ${formatBytes(f.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}. Upload a smaller file.`)
      return
    }
    setUploading(true); setBanner(null); setErrors({})
    try {
      const contentType = f.type || 'application/octet-stream'
      const pres = await api.post(`/entries/${entry.id}/endorsement/presign`, { fileName: f.name, contentType }, { auth: true })
      const res = await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: f })
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`)
      setFile({ fileKey: pres.fileKey, fileName: f.name, contentType }); touch()
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'We couldn’t upload that file. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function viewDoc() {
    try {
      const { url } = await api.get(`/entries/${entry.id}/endorsement/url`, { auth: true })
      window.open(url, '_blank', 'noopener')
    } catch {
      setBanner('Save your changes first, then you can view the document.')
    }
  }

  async function doSave(silent = false) {
    if (!valid) {
      if (!silent) setErrors({
        endorse: endorsed ? undefined : 'Tick the endorsement to confirm.',
        file: file?.fileKey ? undefined : 'Upload the signed endorsement document.',
      })
      return
    }
    if (!silent) { setSaving(true); setBanner(null); setErrors({}) }
    try {
      const res = await api.post(`/entries/${entry.id}/lce-endorsement`, {
        endorsed, fileKey: file.fileKey, fileName: file.fileName, contentType: file.contentType,
      }, { auth: true })
      if (!silent) { onSaved({ ...entry, lceEndorsement: res }); setDirty(false) }
    } catch (err) {
      if (!silent) setBanner(err instanceof ApiError ? err.message : 'We couldn’t save the endorsement. Please try again.')
    } finally {
      if (!silent) setSaving(false)
    }
  }

  useAutosave({ signature: JSON.stringify([endorsed, file?.fileKey]), dirty, canSave: valid, onSave: doSave })

  return (
    <div className="ed-stack">
      <SectionIntro icon="fa-stamp" title="LCE endorsement"
        desc="The Local Chief Executive (Governor or Mayor) endorses this entry. Upload the signed endorsement as proof of their signature." />

      <section className="dash-card dash-card-pad ed-block">
        <label className="dash-check ed-certify" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={endorsed} disabled={readOnly} onChange={(e) => { setEndorsed(e.target.checked); touch() }} />
          <span>The Local Chief Executive endorses this entry and supports the LGU’s participation in the Pearl Awards.</span>
        </label>
        {errors.endorse && <p className="dash-error" style={{ marginTop: 6 }}><i className="fas fa-circle-exclamation" aria-hidden="true" /> {errors.endorse}</p>}

        <div style={{ marginTop: 18 }}>
          <Field label="Signed endorsement document" required error={errors.file} hint="The LCE-signed endorsement letter — PDF or a clear photo.">
            {file?.fileKey ? (
              <div className="ed-endorse-file">
                <i className="fas fa-file-circle-check" aria-hidden="true" />
                <span className="ed-endorse-name">{file.fileName || 'Endorsement document'}</span>
                <button type="button" className="dash-btn is-sm" onClick={viewDoc}>View</button>
                {!readOnly && (
                  <label className="dash-btn is-sm" style={{ cursor: 'pointer' }}>
                    Replace<input type="file" accept=".pdf,image/*" hidden disabled={uploading} onChange={onPick} />
                  </label>
                )}
              </div>
            ) : !readOnly ? (
              <label className="dash-btn" style={{ cursor: 'pointer', width: 'fit-content' }}>
                {uploading ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Uploading…</> : <><i className="fas fa-upload" aria-hidden="true" /> Upload document</>}
                <input type="file" accept=".pdf,image/*" hidden disabled={uploading} onChange={onPick} />
              </label>
            ) : (
              <p className="dash-help">No endorsement document uploaded.</p>
            )}
          </Field>
        </div>

        {l?.signedAt && valid && <p className="dash-help" style={{ marginTop: 12 }}>Endorsement recorded {formatDate(l.signedAt, { dateStyle: 'medium', timeStyle: 'short' })}.</p>}
      </section>

      {!readOnly && <SaveBar saving={saving} dirty={dirty} banner={banner} onSave={() => doSave(false)} saveLabel="Save endorsement" />}
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

// Bottom-of-section navigation through the editor tabs, so applicants can move
// forward without hunting for the tab strip up top.
function SectionNav({ prev, next, onGo }) {
  return (
    <div className="ed-nav">
      {prev ? (
        <button type="button" className="dash-btn" onClick={() => { onGo(prev.key); window.scrollTo(0, 0); }}>
          <i className="fas fa-arrow-left" aria-hidden="true" /> {prev.label}
        </button>
      ) : <span />}
      {next && (
        <button type="button" className="dash-btn is-primary" onClick={() => { onGo(next.key); window.scrollTo(0, 0); }}>
          Next: {next.label} <i className="fas fa-arrow-right" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// Owner self-service, tucked into a header overflow menu: withdraw a submission back to
// Draft (before a reviewer takes it, while the window is open) or delete an entry that's
// still in the owner's hands. Rare, lifecycle-level actions — kept out of the editing flow.
function EntryActions({ entry, win, onWithdrawn, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'withdraw' | 'delete'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef(null)

  const canWithdraw = entry.status === 'Submitted' && win?.state === 'open'
  const canDelete = isEditable(entry.status)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (!canWithdraw && !canDelete) return null

  async function withdraw() {
    setBusy(true); setError(null)
    try {
      const res = await api.post(`/entries/${entry.id}/withdraw`, undefined, { auth: true })
      setConfirm(null)
      onWithdrawn(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t withdraw this entry. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true); setError(null)
    try {
      await api.delete(`/entries/${entry.id}`, { auth: true })
      onDeleted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t delete this entry. Please try again.')
      setBusy(false)
    }
  }

  function choose(which) { setOpen(false); setError(null); setConfirm(which) }

  return (
    <div className="ed-actions" ref={ref}>
      <button
        type="button"
        className="ed-actions-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Entry actions"
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fas fa-ellipsis-vertical" aria-hidden="true" />
      </button>
      {open && (
        <div className="ed-actions-menu" role="menu">
          {canWithdraw && (
            <button type="button" role="menuitem" className="ed-actions-item" onClick={() => choose('withdraw')}>
              <i className="fas fa-rotate-left" aria-hidden="true" /> Withdraw to draft
            </button>
          )}
          {canDelete && (
            <button type="button" role="menuitem" className="ed-actions-item is-danger" onClick={() => choose('delete')}>
              <i className="fas fa-trash-can" aria-hidden="true" /> Delete entry
            </button>
          )}
        </div>
      )}

      {confirm === 'withdraw' && (
        <ConfirmDialog
          title="Withdraw this submission?"
          body="It returns to Draft and leaves the review queue. You can edit and resubmit while submissions are open."
          confirmLabel="Withdraw"
          busy={busy}
          error={error}
          onConfirm={withdraw}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          danger
          title="Delete this entry?"
          body="This permanently deletes the entry and its bidbook, declaration, and endorsement. This can’t be undone."
          confirmLabel="Delete entry"
          busy={busy}
          error={error}
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function ConfirmDialog({ title, body, confirmLabel, danger, busy, error, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  return (
    <div className="ed-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={() => { if (!busy) onCancel() }}>
      <div className="ed-modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="ed-modal-title">{title}</h3>
        <p className="ed-modal-body">{body}</p>
        {error && (
          <div className="dash-banner tone-error" style={{ marginBottom: 14 }}>
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{error}</span>
          </div>
        )}
        <div className="ed-modal-actions">
          <button type="button" className="dash-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={`dash-btn ${danger ? 'is-danger' : 'is-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Working…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Autosave persists in the background (useAutosave), so this is just status —
// not a primary action. Quiet states (saving / saved) collapse to a small corner
// pill that doesn't cover content; only a real problem expands to a visible alert
// with a manual retry.
function SaveBar({ saving, dirty, blocked, banner, onSave, saveLabel = 'Save now', blockedMsg }) {
  const problem = !!banner || blocked

  if (!problem) {
    return (
      <div className="ed-savestatus" aria-live="polite">
        {saving || dirty ? (
          <span className="ed-ss is-busy"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</span>
        ) : (
          <span className="ed-ss is-ok"><i className="fas fa-circle-check" aria-hidden="true" /> Saved</span>
        )}
      </div>
    )
  }

  return (
    <div className="ed-savealert" role="alert">
      <span className="ed-savealert-msg"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {banner || blockedMsg}</span>
      {banner && (
        <button type="button" className="dash-btn is-sm" disabled={saving} onClick={onSave}>
          {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : <><i className="fas fa-floppy-disk" aria-hidden="true" /> {saveLabel}</>}
        </button>
      )}
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
  /* Full-width row so the 4-step status timeline never has to wrap. */
  .ed-head-timeline { flex-basis: 100%; width: 100%; }
  .ed-panel { margin-top: 22px; padding-bottom: 60px; }
  .ed-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 24px; }

  /* Owner actions (withdraw / delete) — header overflow menu */
  .ed-actions { position: relative; margin-left: auto; }
  .ed-actions-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid transparent; background: transparent; color: var(--gray-600); cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
  .ed-actions-btn:hover, .ed-actions-btn[aria-expanded="true"] { background: var(--gray-100); color: var(--navy); border-color: var(--gray-200); }
  .ed-actions-menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 20; min-width: 188px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 6px; display: flex; flex-direction: column; gap: 2px; }
  .ed-actions-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 10px; border: none; background: transparent; border-radius: var(--radius-sm); font: inherit; font-size: 0.88rem; color: var(--navy); cursor: pointer; }
  .ed-actions-item i { width: 16px; text-align: center; color: var(--gray-400); }
  .ed-actions-item:hover { background: var(--gray-100); }
  .ed-actions-item.is-danger { color: #B91C1C; }
  .ed-actions-item.is-danger i { color: currentColor; }
  .ed-actions-item.is-danger:hover { background: #FEF2F2; }

  .ed-modal { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(15,25,46,0.55); backdrop-filter: blur(2px); animation: ed-modal-in 0.16s ease-out; }
  .ed-modal-card { width: 100%; max-width: 440px; background: var(--white); border-radius: var(--radius-md); box-shadow: 0 30px 70px rgba(15,25,46,0.4); padding: 26px; }
  .ed-modal-title { font-family: var(--font-heading); font-size: 1.2rem; font-weight: 800; color: var(--navy); margin-bottom: 10px; }
  .ed-modal-body { color: var(--gray-600); font-size: 0.9rem; line-height: 1.6; margin-bottom: 22px; }
  .ed-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
  @keyframes ed-modal-in { from { opacity: 0; } to { opacity: 1; } }
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
  .ed-evidence { padding: 12px; background: var(--off-white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 10px; }
  .ed-evidence-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .ed-evidence-title { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.82rem; display: flex; align-items: center; gap: 7px; }
  .ed-evidence-title i { color: var(--gold-dark); }
  .ed-evidence-opt { font-size: 0.74rem; color: var(--gray-400); white-space: nowrap; }
  .ed-evidence-list { display: flex; flex-direction: column; gap: 6px; }
  .ed-evidence-item { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
  .ed-evidence-item > i { color: var(--gold-dark); }
  .ed-evidence-name { font-family: var(--font-heading); font-weight: 600; color: var(--navy); font-size: 0.85rem; flex: 1; min-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  .ed-endorse-file { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); background: var(--off-white); }
  .ed-endorse-file > i { color: #16A34A; font-size: 1.1rem; flex-shrink: 0; }
  .ed-endorse-name { flex: 1; min-width: 120px; font-family: var(--font-heading); font-weight: 700; font-size: 0.86rem; color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Quiet save status — a small corner pill that follows scroll without covering content. */
  .ed-savestatus { position: sticky; bottom: 14px; display: flex; justify-content: flex-end; margin-top: 6px; pointer-events: none; }
  .ed-ss { pointer-events: auto; display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 999px; background: var(--white); border: 1px solid var(--gray-200); box-shadow: var(--shadow-sm); font-family: var(--font-heading); font-weight: 700; font-size: 0.76rem; }
  .ed-ss.is-ok { color: #15803D; }
  .ed-ss.is-busy { color: var(--gray-600); }
  /* A save problem expands to a visible (sticky) alert with a manual retry. */
  .ed-savealert { position: sticky; bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding: 12px 16px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--radius-md); box-shadow: var(--shadow-md); }
  .ed-savealert-msg { display: inline-flex; align-items: center; gap: 8px; min-width: 0; color: #B91C1C; font-family: var(--font-body); font-size: 0.88rem; line-height: 1.4; }
  .ed-savealert-msg i { color: #DC2626; flex-shrink: 0; }
  .ed-blockers { margin: 8px 0 0 18px; list-style: disc; display: flex; flex-direction: column; gap: 4px; }
  .ed-linkbtn { background: none; border: none; padding: 0; cursor: pointer; color: inherit; font: inherit; }
  .dash-inline-link { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
  @media (max-width: 760px) {
    .ed-head-side { max-width: none; min-width: 0; width: 100%; }
    .ed-savealert { flex-direction: column; align-items: stretch; }
    .ed-savealert .dash-btn { width: 100%; }
  }
`

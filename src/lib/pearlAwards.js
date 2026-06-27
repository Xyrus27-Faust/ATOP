// Domain vocabulary for the Pearl Awards applicant flow. Mirrors the backend
// enums (Atop.Modules.PearlAwards) so the UI can label values and send back the
// exact strings the API parses. JSON from the API is camelCase.

// ---- Entry lifecycle ------------------------------------------------------

// status key -> { label, tone }. `tone` drives the badge colour (see dash CSS).
export const ENTRY_STATUS = {
  Draft: { label: 'Draft', tone: 'neutral', icon: 'fa-pen-ruler' },
  Submitted: { label: 'Submitted', tone: 'info', icon: 'fa-paper-plane' },
  UnderValidation: { label: 'Under validation', tone: 'progress', icon: 'fa-magnifying-glass' },
  ReturnedForRevision: { label: 'Returned for revision', tone: 'warn', icon: 'fa-rotate-left' },
  Validated: { label: 'Validated', tone: 'success', icon: 'fa-circle-check' },
  Disqualified: { label: 'Disqualified', tone: 'danger', icon: 'fa-circle-xmark' },
}

export function statusMeta(status) {
  return ENTRY_STATUS[status] || { label: status, tone: 'neutral', icon: 'fa-circle' }
}

// Applicants may only edit an entry in these states.
export const EDITABLE_STATUSES = ['Draft', 'ReturnedForRevision']
export const isEditable = (status) => EDITABLE_STATUSES.includes(status)

// The happy-path lifecycle, for the status stepper. Off-path states
// (ReturnedForRevision, Disqualified) are surfaced separately.
export const STATUS_FLOW = ['Draft', 'Submitted', 'UnderValidation', 'Validated']

// ---- Entry vocabulary -----------------------------------------------------

export const COVERAGE_OPTIONS = [
  { value: 'CompletedInCoverageYear', label: 'Completed within the coverage year' },
  { value: 'ContinuingThroughCoverageYear', label: 'Continuing — a major portion fell in the coverage year' },
]

export const LGU_LEVELS = [
  { value: 'Province', label: 'Province' },
  { value: 'HUC', label: 'Highly Urbanized City' },
  { value: 'ComponentCity', label: 'Component City' },
  { value: 'Municipality', label: 'Municipality' },
]

export const REGIONS = [
  { value: 'Ncr', label: 'NCR — National Capital Region' },
  { value: 'Car', label: 'CAR — Cordillera Administrative Region' },
  { value: 'Region1', label: 'Region I — Ilocos Region' },
  { value: 'Region2', label: 'Region II — Cagayan Valley' },
  { value: 'Region3', label: 'Region III — Central Luzon' },
  { value: 'Region4A', label: 'Region IV-A — CALABARZON' },
  { value: 'Region4B', label: 'Region IV-B — MIMAROPA' },
  { value: 'Region5', label: 'Region V — Bicol Region' },
  { value: 'Region6', label: 'Region VI — Western Visayas' },
  { value: 'Region7', label: 'Region VII — Central Visayas' },
  { value: 'Region8', label: 'Region VIII — Eastern Visayas' },
  { value: 'Region9', label: 'Region IX — Zamboanga Peninsula' },
  { value: 'Region10', label: 'Region X — Northern Mindanao' },
  { value: 'Region11', label: 'Region XI — Davao Region' },
  { value: 'Region12', label: 'Region XII — SOCCSKSARGEN' },
  { value: 'Region13', label: 'Region XIII — Caraga' },
  { value: 'Barmm', label: 'BARMM — Bangsamoro' },
]

export const labelFor = (options, value) => options.find((o) => o.value === value)?.label || value

export const ENTRANT_TYPE_LABELS = {
  Lgu: 'Local Government Unit',
  OfficersOrganization: 'Tourism Officers’ Organization',
  Individual: 'Individual',
}

export const NOMINATOR_RULE_LABELS = {
  AnyTourismOfficer: 'Any tourism officer may nominate',
  ThirdPartyOnly: 'Third-party nomination required',
}

export const SUBMISSION_KIND_LABELS = {
  PdfUpload: 'PDF document',
  PhotoUpload: 'Photo',
  VideoLink: 'Video link',
  Reference: 'Reference / link',
}

// Field limits enforced by the backend (Bidbook / NarrativeItem).
export const EXEC_SUMMARY_MAX = 1800
export const NARRATIVE_MAX = 1200

// Max size for an uploaded supporting-document file. Videos stay as external
// links (e.g. YouTube) — hosting/serving video is too costly.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

// What a required-submission slot accepts, driven by its `kind`.
export function uploadRulesFor(kind) {
  switch (kind) {
    case 'VideoLink':
      return { allowUpload: false, accept: undefined, linkPlaceholder: 'Paste the YouTube / video link…' }
    case 'PhotoUpload':
      return { allowUpload: true, accept: 'image/*', linkPlaceholder: 'or paste a shareable link…' }
    case 'PdfUpload':
      return { allowUpload: true, accept: '.pdf,application/pdf', linkPlaceholder: 'or paste a shareable link…' }
    default: // Reference
      return { allowUpload: true, accept: undefined, linkPlaceholder: 'Paste a link or upload a file…' }
  }
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// ---- Submission window ----------------------------------------------------

export function submissionWindow(catalog, now = new Date()) {
  if (!catalog) return null
  const opens = new Date(catalog.submissionOpensAt)
  const closes = new Date(catalog.submissionClosesAt)
  let state = 'open'
  if (now < opens) state = 'upcoming'
  else if (now >= closes) state = 'closed'
  const day = 24 * 60 * 60 * 1000
  const daysToClose = Math.ceil((closes - now) / day)
  return { opens, closes, state, daysToClose }
}

// ---- Readiness (mirrors Entry.ValidateForSubmission) ----------------------
// Computes the per-requirement checklist the applicant must satisfy before an
// entry can be submitted. Used by the Overview and the editor's Review tab —
// the dashboard's signature element. `category` may be null while loading.

export function computeReadiness(entry, category) {
  const bidbook = entry?.bidbook || { executiveSummary: '', narratives: [], supportingDocuments: [] }
  const items = []

  items.push({ key: 'title', label: 'Entry title', done: !!entry?.title?.trim() })

  const summary = (bidbook.executiveSummary || '').trim()
  items.push({
    key: 'summary',
    label: 'Executive summary',
    done: summary.length > 0 && summary.length <= EXEC_SUMMARY_MAX,
    detail: summary.length > EXEC_SUMMARY_MAX ? `${summary.length}/${EXEC_SUMMARY_MAX} — over limit` : undefined,
  })

  if (category) {
    const textByCriterion = new Map((bidbook.narratives || []).map((n) => [n.criterionId, (n.text || '').trim()]))
    const total = category.criteria.length
    const filled = category.criteria.filter((c) => {
      const t = textByCriterion.get(c.id) || ''
      return t.length > 0 && t.length <= NARRATIVE_MAX
    }).length
    items.push({
      key: 'narratives',
      label: 'Criteria narratives',
      done: total > 0 && filled === total,
      detail: `${filled} of ${total} written`,
    })

    const docByLabel = new Map((bidbook.supportingDocuments || []).map((d) => [d.label, d]))
    const mandatory = category.requiredSubmissions.filter((r) => r.mandatory)
    const provided = mandatory.filter((r) => {
      const d = docByLabel.get(r.label)
      return d && (!!d.link?.trim() || !!d.fileKey)
    }).length
    items.push({
      key: 'documents',
      label: 'Required documents',
      done: provided === mandatory.length,
      detail: mandatory.length ? `${provided} of ${mandatory.length} attached` : 'None required',
    })

    if (category.nominatorRule === 'ThirdPartyOnly') {
      items.push({
        key: 'nominator',
        label: 'Third-party nominator',
        done: !!entry?.nominator?.isThirdParty,
        detail: entry?.nominator?.isThirdParty ? undefined : 'This category requires a third-party nominator',
      })
    }
  }

  const d = entry?.declaration
  items.push({
    key: 'declaration',
    label: 'Declaration certified',
    done: !!(d && d.certified),
  })

  const e = entry?.lceEndorsement
  items.push({
    key: 'endorsement',
    label: 'LCE endorsement',
    done: !!(e && e.endorsed && e.fileKey),
  })

  const completed = items.filter((i) => i.done).length
  return { items, completed, total: items.length, ready: completed === items.length }
}

// ---- Date formatting ------------------------------------------------------

export function formatDate(value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, opts)
  } catch {
    return '—'
  }
}

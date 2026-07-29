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
  Finalist: { label: 'Finalist', tone: 'success', icon: 'fa-trophy' },
  Eliminated: { label: 'Eliminated', tone: 'neutral', icon: 'fa-circle-minus' },
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
  { value: 'Region18', label: 'Region XVIII — Negros Island Region' },
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

// Word limits are the real cap, enforced by the backend at submit (Bidbook / NarrativeItem). They're
// soft on save; a generous char backstop (mirrors the backend abuse cap) bounds a single draft.
export const EXEC_SUMMARY_MAX_WORDS = 300
export const NARRATIVE_MAX_WORDS = 200
export const EXEC_SUMMARY_MAX_CHARS = 20000
export const NARRATIVE_MAX_CHARS = 20000

// Whitespace-token word count — the same rule the backend uses (runs of non-whitespace).
export const countWords = (t) => {
  const s = (t || '').trim()
  return s ? s.split(/\s+/).length : 0
}

// Max size for an uploaded supporting-document file. Videos stay as external
// links (e.g. YouTube) — hosting/serving video is too costly.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

// Optional per-criterion evidence files (mirrors CriterionEvidence.MaxPerCriterion).
export const EVIDENCE_MAX_FILES = 3

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

// ---- Video embeds ---------------------------------------------------------
// Reviewers preview submitted video links (almost always YouTube) inline. We
// only build a player URL for providers we recognise; everything else stays a
// plain link. `looksLikeVideo` lets the UI flag a link that is *meant* to be a
// video but can't be embedded, so it can say so instead of failing silently.

const YT_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be'])
const VIDEO_HOSTS = new Set([...YT_HOSTS, 'vimeo.com', 'player.vimeo.com', 'dailymotion.com', 'dai.ly', 'facebook.com', 'fb.watch'])

function parseUrl(link) {
  if (!link || typeof link !== 'string') return null
  try { return new URL(link.trim()) } catch { return null }
}

const bareHost = (url) => url.hostname.replace(/^www\./, '').toLowerCase()

function youTubeId(url, host) {
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

// Returns { provider, embedUrl } for an embeddable video link, otherwise null.
export function videoEmbed(link) {
  const url = parseUrl(link)
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) return null
  const host = bareHost(url)

  if (YT_HOSTS.has(host)) {
    const id = youTubeId(url, host)
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      const t = url.searchParams.get('start') || url.searchParams.get('t')
      const start = t && /^\d+$/.test(t) ? `?start=${t}` : ''
      return { provider: 'YouTube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}${start}` }
    }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = (url.pathname.match(/\/(?:video\/)?(\d+)/) || [])[1]
    if (id) return { provider: 'Vimeo', embedUrl: `https://player.vimeo.com/video/${id}` }
  }
  return null
}

// True when a link is meant to be a video but may not be previewable inline —
// a known video host or a direct video file we have no inline player for.
export function looksLikeVideo(link) {
  const url = parseUrl(link)
  if (!url) return false
  return VIDEO_HOSTS.has(bareHost(url)) || /\.(mp4|mov|webm|m4v|avi|mkv)(?:[?#]|$)/i.test(url.pathname)
}

// ---- Submission window ----------------------------------------------------

/**
 * The window an entry is actually held to. Pass the entry's `status` to get its own deadline.
 *
 * Mirrors `Entry.ClosesAt` on the server: an entry **returned for revision** may be given until a
 * later grace deadline, so a nominator asked to fix something isn't cut off while fixing it.
 * Everything else — including a draft that was never submitted — closes on the original date.
 * Omitting `status` gives the general window, which is what the public and overview pages want.
 */
export function submissionWindow(catalog, now = new Date(), status = null) {
  if (!catalog) return null
  const opens = new Date(catalog.submissionOpensAt)
  const extended = status === 'ReturnedForRevision' && !!catalog.resubmissionClosesAt
  const closes = new Date(extended ? catalog.resubmissionClosesAt : catalog.submissionClosesAt)
  let state = 'open'
  if (now < opens) state = 'upcoming'
  else if (now >= closes) state = 'closed'
  const day = 24 * 60 * 60 * 1000
  const daysToClose = Math.ceil((closes - now) / day)
  return { opens, closes, state, daysToClose, extended }
}

// ---- Readiness (mirrors Entry.ValidateForSubmission) ----------------------
// Computes the per-requirement checklist the applicant must satisfy before an
// entry can be submitted. Used by the Overview and the editor's Review tab —
// the dashboard's signature element. `category` may be null while loading.

export function computeReadiness(entry, category) {
  const bidbook = entry?.bidbook || { executiveSummary: '', narratives: [], supportingDocuments: [] }
  const items = []

  items.push({ key: 'title', label: 'Entry title', done: !!entry?.title?.trim() })

  const summaryWords = countWords(bidbook.executiveSummary)
  items.push({
    key: 'summary',
    label: 'Executive summary',
    done: summaryWords > 0 && summaryWords <= EXEC_SUMMARY_MAX_WORDS,
    detail: summaryWords > EXEC_SUMMARY_MAX_WORDS ? `${summaryWords}/${EXEC_SUMMARY_MAX_WORDS} words — over limit` : undefined,
  })

  if (category) {
    const textByCriterion = new Map((bidbook.narratives || []).map((n) => [n.criterionId, n.text || '']))
    const total = category.criteria.length
    const filled = category.criteria.filter((c) => {
      const w = countWords(textByCriterion.get(c.id) || '')
      return w > 0 && w <= NARRATIVE_MAX_WORDS
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

// ---- Criterion rating scale (pre-finals scoring) ---------------------------
// The Guidelines Manual: "Assessors shall rate each criterion using a scale of 0 to 5, with a
// minimum decimal increment of 0.2." So the scale has 26 stops, not six whole numbers.

export const RATING_MIN = 0
export const RATING_MAX = 5
export const RATING_STEP = 0.2

// Ratings land on a 0.2 grid. Do the arithmetic in fifths (integers) — 0.1 + 0.2 !== 0.3 in binary
// floating point, so accumulating by 0.2 would drift and print values like 3.4000000000000004.
export const toRatingStep = (n) => Math.round(Math.min(RATING_MAX, Math.max(RATING_MIN, n)) * 5) / 5
export const formatRating = (n) => (n == null ? '—' : Number(n).toFixed(1))

// The manual's descriptor bands (p. 5), verbatim. `from` is the band's lowest rating; a rating
// belongs to the highest band whose `from` it reaches. 0 is its own band — "no relevant evidence".
export const RATING_BANDS = [
  { from: 4.2, label: 'Excellent', meaning: 'Complete, well-documented, highly relevant, innovative, measurable, and clearly superior.' },
  { from: 3.2, label: 'Very Good', meaning: 'Strong and mostly complete, with clear evidence and only minor gaps.' },
  { from: 2.2, label: 'Good', meaning: 'Meets the basic requirements but with moderate gaps in evidence, scale, or results.' },
  { from: 1.2, label: 'Fair', meaning: 'Partially meets the criterion but lacks clarity, depth, documentation, or measurable impact.' },
  { from: 0.2, label: 'Weak', meaning: 'Minimal evidence or weak connection to the criterion.' },
  { from: 0, label: 'Not demonstrated', meaning: 'No relevant evidence provided.' },
]

export function ratingBand(rating) {
  if (rating == null) return null
  return RATING_BANDS.find((b) => rating >= b.from) || RATING_BANDS[RATING_BANDS.length - 1]
}

// The band's display range, e.g. "4.2–5.0" (and plain "0" for the bottom band).
export function bandRange(band) {
  const i = RATING_BANDS.indexOf(band)
  if (i === -1 || band.from === 0) return '0'
  const upper = i === 0 ? RATING_MAX : RATING_BANDS[i - 1].from - RATING_STEP
  return `${band.from.toFixed(1)}–${upper.toFixed(1)}`
}

// ---- Finals adjudication (M4b) --------------------------------------------
// Adjudicators rank a bracket's finalists 1..N (1 = best). Lowest average rank wins:
// 1st → Grand Winner, 2nd → First Runner-Up, 3rd → Second Runner-Up; the rest are
// still recognised finalists. Mirrors the backend's FinalsPlacement enum.

export const FINALS_PLACEMENT = {
  GrandWinner: { label: 'Grand Winner', short: 'Grand Winner', tone: 'success', icon: 'fa-trophy' },
  FirstRunnerUp: { label: 'First Runner-Up', short: '1st Runner-Up', tone: 'info', icon: 'fa-medal' },
  SecondRunnerUp: { label: 'Second Runner-Up', short: '2nd Runner-Up', tone: 'info', icon: 'fa-medal' },
  Finalist: { label: 'Finalist', short: 'Finalist', tone: 'neutral', icon: 'fa-star' },
}

export function placementMeta(placement) {
  return FINALS_PLACEMENT[placement] || { label: placement || '—', short: '—', tone: 'neutral', icon: 'fa-circle' }
}

// NOTE: there is deliberately no position→placement helper. A position on ONE adjudicator's ballot
// is not a placement: placements come from the tally, which averages every adjudicator's positions.
// Labelling a ballot row "Grand Winner" told adjudicators their order decided the award. It doesn't.
// Placements are only ever read from the server (`placementMeta(row.placement)`), never inferred.

// A finals bracket is a (category × LGU level) contest; level-less categories collapse to one
// bracket keyed 'All'.
export function bracketLabel(bracket) {
  return bracket === 'All' ? 'All entrants' : labelFor(LGU_LEVELS, bracket)
}

// The adjudicator's own progress on a bracket's ballot.
export const BALLOT_STATUS = {
  NotStarted: { label: 'To rank', tone: 'neutral', icon: 'fa-circle-dot' },
  Pending: { label: 'In progress', tone: 'progress', icon: 'fa-pen' },
  Submitted: { label: 'Ranked', tone: 'success', icon: 'fa-circle-check' },
}
export const ballotMeta = (s) => BALLOT_STATUS[s] || BALLOT_STATUS.NotStarted

// ---- Date formatting ------------------------------------------------------

export function formatDate(value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, opts)
  } catch {
    return '—'
  }
}

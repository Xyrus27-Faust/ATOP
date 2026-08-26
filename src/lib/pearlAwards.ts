// Domain vocabulary for the Pearl Awards applicant flow. Mirrors the backend
// enums (Atop.Modules.PearlAwards) so the UI can label values and send back the
// exact strings the API parses. JSON from the API is camelCase.

import type {
  Entry,
  AwardCategory,
  ReadinessResult,
  ReadinessItem,
  FinalsPlacement,
  BallotStatusKey,
} from '@/types'

// ---- Entry lifecycle ------------------------------------------------------

export interface StatusMeta {
  label: string
  tone: string
  icon: string
}

// status key -> { label, tone }. `tone` drives the badge colour (see dash CSS).
export const ENTRY_STATUS: Record<string, StatusMeta> = {
  Draft: { label: 'Draft', tone: 'neutral', icon: 'fa-pen-ruler' },
  Submitted: { label: 'Submitted', tone: 'info', icon: 'fa-paper-plane' },
  UnderValidation: { label: 'Under validation', tone: 'progress', icon: 'fa-magnifying-glass' },
  ReturnedForRevision: { label: 'Returned for revision', tone: 'warn', icon: 'fa-rotate-left' },
  Validated: { label: 'Validated', tone: 'success', icon: 'fa-circle-check' },
  Disqualified: { label: 'Disqualified', tone: 'danger', icon: 'fa-circle-xmark' },
  Finalist: { label: 'Finalist', tone: 'success', icon: 'fa-trophy' },
  Eliminated: { label: 'Eliminated', tone: 'neutral', icon: 'fa-circle-minus' },
}

export function statusMeta(status: string): StatusMeta {
  return ENTRY_STATUS[status] || { label: status, tone: 'neutral', icon: 'fa-circle' }
}

// Applicants may only edit an entry in these states.
export const EDITABLE_STATUSES = ['Draft', 'ReturnedForRevision']
export const isEditable = (status: string): boolean => EDITABLE_STATUSES.includes(status)

// The happy-path lifecycle, for the status stepper. Off-path states
// (ReturnedForRevision, Disqualified) are surfaced separately.
export const STATUS_FLOW = ['Draft', 'Submitted', 'UnderValidation', 'Validated']

// ---- Entry vocabulary -----------------------------------------------------

export interface Option<T = string> {
  value: T
  label: string
}

export const COVERAGE_OPTIONS: Option[] = [
  { value: 'CompletedInCoverageYear', label: 'Completed within the coverage year' },
  { value: 'ContinuingThroughCoverageYear', label: 'Continuing \u2014 a major portion fell in the coverage year' },
]

export const LGU_LEVELS: Option[] = [
  { value: 'Province', label: 'Province' },
  { value: 'HUC', label: 'Highly Urbanized City' },
  { value: 'ComponentCity', label: 'Component City' },
  { value: 'Municipality', label: 'Municipality' },
]

export const REGIONS: Option[] = [
  { value: 'Ncr', label: 'NCR \u2014 National Capital Region' },
  { value: 'Car', label: 'CAR \u2014 Cordillera Administrative Region' },
  { value: 'Region1', label: 'Region I \u2014 Ilocos Region' },
  { value: 'Region2', label: 'Region II \u2014 Cagayan Valley' },
  { value: 'Region3', label: 'Region III \u2014 Central Luzon' },
  { value: 'Region4A', label: 'Region IV-A \u2014 CALABARZON' },
  { value: 'Region4B', label: 'Region IV-B \u2014 MIMAROPA' },
  { value: 'Region5', label: 'Region V \u2014 Bicol Region' },
  { value: 'Region6', label: 'Region VI \u2014 Western Visayas' },
  { value: 'Region7', label: 'Region VII \u2014 Central Visayas' },
  { value: 'Region8', label: 'Region VIII \u2014 Eastern Visayas' },
  { value: 'Region9', label: 'Region IX \u2014 Zamboanga Peninsula' },
  { value: 'Region10', label: 'Region X \u2014 Northern Mindanao' },
  { value: 'Region11', label: 'Region XI \u2014 Davao Region' },
  { value: 'Region12', label: 'Region XII \u2014 SOCCSKSARGEN' },
  { value: 'Region13', label: 'Region XIII \u2014 Caraga' },
  { value: 'Region18', label: 'Region XVIII \u2014 Negros Island Region' },
  { value: 'Barmm', label: 'BARMM \u2014 Bangsamoro' },
]

export const labelFor = (options: Option[], value: string): string =>
  options.find((o) => o.value === value)?.label || value

export const ENTRANT_TYPE_LABELS: Record<string, string> = {
  Lgu: 'Local Government Unit',
  OfficersOrganization: "Tourism Officers' Organization",
  Individual: 'Individual',
}

export const NOMINATOR_RULE_LABELS: Record<string, string> = {
  AnyTourismOfficer: 'Any tourism officer may nominate',
  ThirdPartyOnly: 'Third-party nomination required',
}

export const SUBMISSION_KIND_LABELS: Record<string, string> = {
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

// Whitespace-token word count - the same rule the backend uses (runs of non-whitespace).
export const countWords = (t: string): number => {
  const s = (t || '').trim()
  return s ? s.split(/\s+/).length : 0
}

// Max size for an uploaded supporting-document file. Videos stay as external
// links (e.g. YouTube) - hosting/serving video is too costly.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

// Optional per-criterion evidence files (mirrors CriterionEvidence.MaxPerCriterion).
export const EVIDENCE_MAX_FILES = 3

export interface UploadRules {
  allowUpload: boolean
  accept: string | undefined
  linkPlaceholder: string
}

// What a required-submission slot accepts, driven by its `kind`.
export function uploadRulesFor(kind: string): UploadRules {
  switch (kind) {
    case 'VideoLink':
      return { allowUpload: false, accept: undefined, linkPlaceholder: 'Paste the YouTube / video link\u2026' }
    case 'PhotoUpload':
      return { allowUpload: true, accept: 'image/*', linkPlaceholder: 'or paste a shareable link\u2026' }
    case 'PdfUpload':
      return { allowUpload: true, accept: '.pdf,application/pdf', linkPlaceholder: 'or paste a shareable link\u2026' }
    default: // Reference
      return { allowUpload: true, accept: undefined, linkPlaceholder: 'Paste a link or upload a file\u2026' }
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// ---- Video embeds ---------------------------------------------------------

const YT_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be'])
const VIDEO_HOSTS = new Set([...YT_HOSTS, 'vimeo.com', 'player.vimeo.com', 'dailymotion.com', 'dai.ly', 'facebook.com', 'fb.watch'])

function parseUrl(link: string): URL | null {
  if (!link || typeof link !== 'string') return null
  try { return new URL(link.trim()) } catch { return null }
}

const bareHost = (url: URL): string => url.hostname.replace(/^www\./, '').toLowerCase()

function youTubeId(url: URL, host: string): string | null {
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

export interface VideoEmbed {
  provider: string
  embedUrl: string
}

// Returns { provider, embedUrl } for an embeddable video link, otherwise null.
export function videoEmbed(link: string): VideoEmbed | null {
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

// True when a link is meant to be a video but may not be previewable inline -
// a known video host or a direct video file we have no inline player for.
export function looksLikeVideo(link: string): boolean {
  const url = parseUrl(link)
  if (!url) return false
  return VIDEO_HOSTS.has(bareHost(url)) || /\.(mp4|mov|webm|m4v|avi|mkv)(?:[?#]|$)/i.test(url.pathname)
}

// ---- Submission window ----------------------------------------------------

export interface SubmissionWindow {
  opens: Date
  closes: Date
  state: 'open' | 'upcoming' | 'closed'
  daysToClose: number
  extended: boolean
}

export function submissionWindow(catalog: { submissionOpensAt: string; submissionClosesAt: string; resubmissionClosesAt?: string | null } | null, now: Date = new Date(), status: string | null = null): SubmissionWindow | null {
  if (!catalog) return null
  const opens = new Date(catalog.submissionOpensAt)
  const extended = status === 'ReturnedForRevision' && !!catalog.resubmissionClosesAt
  const closes = new Date(extended ? catalog.resubmissionClosesAt! : catalog.submissionClosesAt)
  let state: 'open' | 'upcoming' | 'closed' = 'open'
  if (now < opens) state = 'upcoming'
  else if (now >= closes) state = 'closed'
  const day = 24 * 60 * 60 * 1000
  const daysToClose = Math.ceil((closes.getTime() - now.getTime()) / day)
  return { opens, closes, state, daysToClose, extended }
}

// ---- Readiness (mirrors Entry.ValidateForSubmission) ----------------------

export function computeReadiness(entry: Partial<Entry> | null | undefined, category: AwardCategory | null | undefined): ReadinessResult {
  const bidbook = entry?.bidbook || { executiveSummary: '', narratives: [], supportingDocuments: [] }
  const items: ReadinessItem[] = []

  items.push({ key: 'title', label: 'Entry title', done: !!entry?.title?.trim() })

  const summaryWords = countWords(bidbook.executiveSummary)
  items.push({
    key: 'summary',
    label: 'Executive summary',
    done: summaryWords > 0 && summaryWords <= EXEC_SUMMARY_MAX_WORDS,
    detail: summaryWords > EXEC_SUMMARY_MAX_WORDS ? `${summaryWords}/${EXEC_SUMMARY_MAX_WORDS} words \u2014 over limit` : undefined,
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

export const RATING_MIN = 0
export const RATING_MAX = 5
export const RATING_STEP = 0.2

export const toRatingStep = (n: number): number => Math.round(Math.min(RATING_MAX, Math.max(RATING_MIN, n)) * 5) / 5
export const formatRating = (n: number | null | undefined): string => (n == null ? '\u2014' : Number(n).toFixed(1))

export interface RatingBand {
  from: number
  label: string
  meaning: string
}

export const RATING_BANDS: RatingBand[] = [
  { from: 4.2, label: 'Excellent', meaning: 'Complete, well-documented, highly relevant, innovative, measurable, and clearly superior.' },
  { from: 3.2, label: 'Very Good', meaning: 'Strong and mostly complete, with clear evidence and only minor gaps.' },
  { from: 2.2, label: 'Good', meaning: 'Meets the basic requirements but with moderate gaps in evidence, scale, or results.' },
  { from: 1.2, label: 'Fair', meaning: 'Partially meets the criterion but lacks clarity, depth, documentation, or measurable impact.' },
  { from: 0.2, label: 'Weak', meaning: 'Minimal evidence or weak connection to the criterion.' },
  { from: 0, label: 'Not demonstrated', meaning: 'No relevant evidence provided.' },
]

export function ratingBand(rating: number | null | undefined): RatingBand | null {
  if (rating == null) return null
  return RATING_BANDS.find((b) => rating >= b.from) || RATING_BANDS[RATING_BANDS.length - 1]
}

export const weightedScore = (rating: number | null | undefined, points: number | null | undefined): number | null =>
  rating == null || points == null ? null : (Math.round(rating * 5) * points) / (RATING_MAX * 5)

export const formatWeighted = (n: number | null | undefined): string =>
  n == null ? '\u2014' : Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(1)

export function weightedTotal(criteria: Array<{ criterionId: string; points: number }>, scoresByCriterionId: Record<string, number | null | undefined> | null | undefined): { earned: number; max: number } {
  return (criteria || []).reduce(
    (acc, c) => {
      const w = weightedScore(scoresByCriterionId?.[c.criterionId], c.points)
      return { earned: acc.earned + (w ?? 0), max: acc.max + (c.points || 0) }
    },
    { earned: 0, max: 0 },
  )
}

export function bandRange(band: RatingBand): string {
  const i = RATING_BANDS.indexOf(band)
  if (i === -1 || band.from === 0) return '0'
  const upper = i === 0 ? RATING_MAX : RATING_BANDS[i - 1].from - RATING_STEP
  return `${band.from.toFixed(1)}\u2013${upper.toFixed(1)}`
}

// ---- Finals adjudication (M4b) --------------------------------------------

export interface FinalsPlacementMeta {
  label: string
  short: string
  tone: string
  icon: string
}

export const FINALS_PLACEMENT: Record<string, FinalsPlacementMeta> = {
  GrandWinner: { label: 'Grand Winner', short: 'Grand Winner', tone: 'success', icon: 'fa-trophy' },
  FirstRunnerUp: { label: 'First Runner-Up', short: '1st Runner-Up', tone: 'info', icon: 'fa-medal' },
  SecondRunnerUp: { label: 'Second Runner-Up', short: '2nd Runner-Up', tone: 'info', icon: 'fa-medal' },
  Finalist: { label: 'Finalist', short: 'Finalist', tone: 'neutral', icon: 'fa-star' },
}

export function placementMeta(placement: string | null | undefined): FinalsPlacementMeta {
  return (placement && FINALS_PLACEMENT[placement]) || { label: placement || '\u2014', short: '\u2014', tone: 'neutral', icon: 'fa-circle' }
}

export function bracketLabel(bracket: string): string {
  return bracket === 'All' ? 'All entrants' : labelFor(LGU_LEVELS, bracket)
}

const BRACKET_ORDER = LGU_LEVELS.map((l) => l.value)
export const bracketRank = (bracket: string): number => {
  const i = BRACKET_ORDER.indexOf(bracket)
  return i === -1 ? BRACKET_ORDER.length : i
}

export interface BallotStatusMeta {
  label: string
  tone: string
  icon: string
}

export const BALLOT_STATUS: Record<string, BallotStatusMeta> = {
  NotStarted: { label: 'To rank', tone: 'neutral', icon: 'fa-circle-dot' },
  Pending: { label: 'In progress', tone: 'progress', icon: 'fa-pen' },
  Submitted: { label: 'Ranked', tone: 'success', icon: 'fa-circle-check' },
}
export const ballotMeta = (s: string): BallotStatusMeta => BALLOT_STATUS[s] || BALLOT_STATUS.NotStarted

// ---- Date formatting ------------------------------------------------------

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  if (!value) return '\u2014'
  try {
    return new Date(value).toLocaleDateString(undefined, opts)
  } catch {
    return '\u2014'
  }
}

// Central shared type definitions for the ATOP frontend.
// These mirror the backend's domain models (Atop.Modules.PearlAwards).

// ---- Auth / Identity -------------------------------------------------------

export type UserRole =
  | 'Admin'
  | 'Secretariat'
  | 'Validator'
  | 'Twg'
  | '3PIC'
  | 'Adjudicator'
  | 'Applicant'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  designation?: string | null
  office?: string | null
  roles: UserRole[]
  isEmailVerified: boolean
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
}

// ---- Entry lifecycle -------------------------------------------------------

export type EntryStatus =
  | 'Draft'
  | 'Submitted'
  | 'UnderValidation'
  | 'ReturnedForRevision'
  | 'Validated'
  | 'Disqualified'
  | 'Finalist'
  | 'Eliminated'

export interface NarrativeItem {
  criterionId: string
  text: string
  evidenceFiles?: EvidenceFile[]
}

export interface EvidenceFile {
  fileKey: string
  fileName: string
  fileSizeBytes?: number
}

export interface SupportingDocument {
  label: string
  link?: string
  fileKey?: string
  fileName?: string
  fileSizeBytes?: number
}

export interface Bidbook {
  executiveSummary: string
  narratives: NarrativeItem[]
  supportingDocuments: SupportingDocument[]
}

export interface Nominator {
  name: string
  position?: string
  organization?: string
  isThirdParty: boolean
}

export interface Declaration {
  certified: boolean
  signedAt?: string
}

export interface LceEndorsement {
  endorsed: boolean
  signedAt?: string
  fileKey?: string
  fileName?: string
}

export interface Entry {
  id: string
  title: string
  status: EntryStatus
  categoryNumber: number
  lguName: string
  lguLevel: string
  lguRegion: string
  coverage: string
  nominator?: Nominator | null
  bidbook: Bidbook
  declaration?: Declaration | null
  lceEndorsement?: LceEndorsement | null
  submittedAt?: string | null
  preFinalsRank?: number | null
  preFinalsMean?: number | null
  preFinalsCopelanda?: number | null
  scoringFinalizedAt?: string | null
  finalsPlacement?: FinalsPlacement | null
  finalsAverageRank?: number | null
  finalsFinalizedAt?: string | null
}

// ---- Award categories / catalog -------------------------------------------

export interface RequiredSubmission {
  label: string
  kind: 'PdfUpload' | 'PhotoUpload' | 'VideoLink' | 'Reference'
  mandatory: boolean
}

export type NominatorRule = 'AnyTourismOfficer' | 'ThirdPartyOnly'
export type EntrantType = 'Lgu' | 'OfficersOrganization' | 'Individual'

export interface Criterion {
  id: string
  name: string
  points: number
  indicators?: string
}

export interface AwardCategory {
  number: number
  name: string
  description?: string
  entrantType: EntrantType
  eligibleLguLevels?: string[]
  nominatorRule: NominatorRule
  requiredSubmissions: RequiredSubmission[]
  criteria: Criterion[]
  isFavorite?: boolean
}

export interface AwardEdition {
  id: string
  year: number
  submissionOpensAt: string
  submissionClosesAt: string
  resubmissionClosesAt?: string | null
  maxFinalists: number
  finalistThreshold: number
  maxScore: number
}

// ---- Scoring (pre-finals) --------------------------------------------------

export type AssessmentStatus = 'Pending' | 'Submitted'

export interface CriterionScore {
  criterionId: string
  criterionName: string
  criterionPoints: number
  rating: number | null
  points?: number
}

export interface Assessment {
  id: string
  entryId: string
  assessorUserId: string
  status: AssessmentStatus
  submittedAt?: string | null
  criterionScores: CriterionScore[]
}

export interface ScoringResult {
  entryId: string
  entryTitle: string
  lguName: string
  lguLevel: string
  meanTotal?: number | null
  copeland?: number | null
  rank?: number | null
  assessments: Assessment[]
}

// ---- Finals ----------------------------------------------------------------

export type FinalsPlacement = 'GrandWinner' | 'FirstRunnerUp' | 'SecondRunnerUp' | 'Finalist'
export type BallotStatusKey = 'NotStarted' | 'Pending' | 'Submitted'

export interface FinalsEntry {
  id: string
  title: string
  lguName: string
  lguLevel: string
  placement?: FinalsPlacement | null
  averageRank?: number | null
  myRank?: number | null
}

// ---- Comments / Notifications ---------------------------------------------

export interface Comment {
  id: string
  body: string
  authorName: string
  byReviewer: boolean
  createdAt: string
}

export interface Notification {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  icon?: string
}

// ---- Readiness ------------------------------------------------------------

export interface ReadinessItem {
  key: string
  label: string
  done: boolean
  detail?: string
}

export interface ReadinessResult {
  items: ReadinessItem[]
  completed: number
  total: number
  ready: boolean
}

// ---- Nav ------------------------------------------------------------------

export interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
}

export interface NavGroup {
  label: string | null
  items: NavItem[]
}

// ---- API ------------------------------------------------------------------

export interface ApiErrorBody {
  status: number
  message: string
  fieldErrors: Record<string, string[]> | null
  raw: unknown
}

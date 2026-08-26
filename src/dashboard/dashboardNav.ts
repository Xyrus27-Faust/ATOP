// Role-driven dashboard navigation. Applicants compose and submit entries;
// reviewers (Secretariat / Validator / Admin) work the review queue. A user with
// both kinds of role sees both sets.

import type { NavItem, NavGroup, UserRole } from '@/types'

export const ROLE_LABELS: Record<string, string> = {
  Applicant: 'Applicant',
  Secretariat: 'Secretariat',
  Validator: 'Validator',
  Twg: 'Technical Working Group',
  '3PIC': 'Third-Party Independent Committee',
  Adjudicator: 'Adjudicator',
  Admin: 'Administrator',
}

// Roles that may review submitted entries (mirrors the backend's reviewer roles).
export const REVIEWER_ROLES: string[] = ['Admin', 'Secretariat', 'Validator']
export const isReviewer = (roles: string[] | undefined = []): boolean => roles.some((r) => REVIEWER_ROLES.includes(r))

// Roles that score entries in the pre-finals stage (mirrors the backend's /scoring roles).
// 3PIC are the assessors; Admins can view/oversee and override.
export const ASSESSOR_ROLES: string[] = ['Admin', '3PIC']
export const isAssessor = (roles: string[] | undefined = []): boolean => roles.some((r) => ASSESSOR_ROLES.includes(r))
// A 3PIC assessor with no applicant/reviewer role belongs in the scoring workspace.
export const isPureAssessor = (roles: string[] | undefined = []): boolean =>
  roles.includes('3PIC') && !roles.includes('Applicant') && !isReviewer(roles)

// Roles that rank finalists in the finals stage (mirrors the backend's /finals roles).
// Adjudicators are the finals panel - deliberately separate from the 3PIC assessors who score
// pre-finals; Admins can view/oversee and override.
export const ADJUDICATOR_ROLES: string[] = ['Admin', 'Adjudicator']
export const isAdjudicator = (roles: string[] | undefined = []): boolean => roles.some((r) => ADJUDICATOR_ROLES.includes(r))
// An adjudicator with no other working role belongs in the finals workspace.
export const isPureAdjudicator = (roles: string[] | undefined = []): boolean =>
  roles.includes('Adjudicator') &&
  !roles.includes('Applicant') &&
  !roles.includes('3PIC') &&
  !isReviewer(roles)

// A reviewer with no applicant role belongs in the review workspace - they have
// no entries of their own, so the applicant pages (overview, my entries, the
// submission editor) are empty or unusable for them.
export const isPureReviewer = (roles: string[] | undefined = []): boolean => isReviewer(roles) && !roles.includes('Applicant')

export const isAdmin = (roles: string[] | undefined = []): boolean => roles.includes('Admin')

// Highest-privilege role wins for the badge shown in the shell.
const ROLE_PRECEDENCE: string[] = ['Admin', 'Secretariat', 'Validator', 'Twg', '3PIC', 'Adjudicator', 'Applicant']

export function primaryRole(roles: string[] = []): string {
  for (const role of ROLE_PRECEDENCE) if (roles.includes(role)) return role
  return roles[0] || 'Applicant'
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

// Compact labels for the tight role chip (sidebar + topbar), where the full names are too long.
// The full name is kept for the chip's hover tooltip and everywhere else via roleLabel().
const ROLE_SHORT: Record<string, string> = { Twg: 'TWG', '3PIC': '3PIC' }
export function roleChipLabel(role: string): string {
  return ROLE_SHORT[role] || roleLabel(role)
}

const OVERVIEW: NavItem = { to: '/dashboard', end: true, label: 'Overview', icon: 'fa-gauge-high' }
const MY_ENTRIES: NavItem = { to: '/dashboard/entries', label: 'My Entries', icon: 'fa-folder-open' }
const SUMMARY: NavItem = { to: '/dashboard/summary', label: 'Summary', icon: 'fa-chart-pie' }
const REVIEW: NavItem = { to: '/dashboard/review', label: 'Review Queue', icon: 'fa-clipboard-check' }
// Admins get the same list reframed as oversight - every entry, incl. drafts.
const SUBMISSIONS: NavItem = { to: '/dashboard/review', label: 'Submissions', icon: 'fa-layer-group' }
// 3PIC scoring workspace, and the admin management of it.
const SCORING: NavItem = { to: '/dashboard/scoring', label: 'Scoring', icon: 'fa-star-half-stroke' }
const ASSESSORS: NavItem = { to: '/dashboard/admin/assessors', label: 'Assessors', icon: 'fa-user-check' }
const RESULTS: NavItem = { to: '/dashboard/admin/scoring', label: 'Scoring Results', icon: 'fa-ranking-star' }
// Finals adjudication workspace, and the admin management of it.
const FINALS: NavItem = { to: '/dashboard/finals', label: 'Finals', icon: 'fa-gavel' }
const ADJUDICATORS: NavItem = { to: '/dashboard/admin/adjudicators', label: 'Adjudicators', icon: 'fa-user-tie' }
const WINNERS: NavItem = { to: '/dashboard/admin/finals', label: 'Finals Results', icon: 'fa-trophy' }
const ACCESS: NavItem = { to: '/dashboard/admin/access', label: 'Manage Validators', icon: 'fa-user-shield' }
// Award categories now live on the public marketing page (ungated). The dashboard
// nav links out to it rather than hosting its own copy.
const AWARDS: NavItem = { to: '/awards', label: 'Award Categories', icon: 'fa-award' }
const PROFILE: NavItem = { to: '/dashboard/profile', label: 'Profile', icon: 'fa-id-badge' }

// Sidebar nav grouped into role-based sections: [{ label, items }]. A user with several roles gets
// several sections; the trailing section (label null) is the always-present general links. The shell
// only renders section headers when there's more than one role section, so single-role users stay flat.
// Pre-finals scoring (3PIC) is gated by a build flag so it can ship dark to prod (hidden until UAT).
// Enabled by default; disabled only when VITE_FEATURE_SCORING is explicitly 'false'.
export const SCORING_ENABLED: boolean = import.meta.env.VITE_FEATURE_SCORING !== 'false'
// Finals adjudication (M4b) is gated the same way, so it can ship dark ahead of the finals round.
export const FINALS_ENABLED: boolean = import.meta.env.VITE_FEATURE_FINALS !== 'false'

export function navForRoles(roles: string[] = []): NavGroup[] {
  const reviewer = isReviewer(roles)
  const assessor = isAssessor(roles)
  const adjudicator = isAdjudicator(roles)
  const admin = isAdmin(roles)
  // Default to the applicant view only for users with no back-office role.
  const applicant = roles.includes('Applicant') || (!reviewer && !assessor && !adjudicator)

  const groups: NavGroup[] = []
  if (applicant) groups.push({ label: 'Applicant', items: [OVERVIEW, MY_ENTRIES] })
  if (reviewer) groups.push({ label: 'Review', items: [SUMMARY, admin ? SUBMISSIONS : REVIEW] })
  if (SCORING_ENABLED && roles.includes('3PIC')) groups.push({ label: 'Scoring', items: [SCORING] })
  if (FINALS_ENABLED && roles.includes('Adjudicator')) groups.push({ label: 'Finals', items: [FINALS] })

  if (admin) {
    const adminItems: NavItem[] = [ACCESS]
    if (SCORING_ENABLED) adminItems.push(ASSESSORS, RESULTS)
    if (FINALS_ENABLED) adminItems.push(ADJUDICATORS, WINNERS)
    groups.push({ label: 'Administration', items: adminItems })
  }
  groups.push({ label: null, items: [AWARDS, PROFILE] })
  return groups
}

// Applicant-only routes: the entry list and the focused submission editor. A
// pure reviewer should never be parked on one of these.
export function isApplicantOnlyPath(path = ''): boolean {
  return path === '/dashboard/entries' || path.startsWith('/entries')
}

// Where a freshly signed-in user belongs. Pure reviewers land in the review
// queue; everyone else gets the applicant overview.
export function roleHome(roles: string[] | undefined = []): string {
  if (isPureReviewer(roles)) return '/dashboard/review'
  if (isPureAssessor(roles)) return '/dashboard/scoring'
  if (isPureAdjudicator(roles)) return '/dashboard/finals'
  return '/dashboard'
}

// Whether a role set may view a path. Used to vet a remembered post-login `from`
// target so a stale deep link can't drop a reviewer on an applicant-only page.
export function canAccessPath(path: string, roles: string[] = []): boolean {
  return !(isPureReviewer(roles) && isApplicantOnlyPath(path))
}

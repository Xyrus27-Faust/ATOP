// Role-driven dashboard navigation. Applicants compose and submit entries;
// reviewers (Secretariat / Validator / Admin) work the review queue. A user with
// both kinds of role sees both sets.

export const ROLE_LABELS = {
  Applicant: 'Applicant',
  Secretariat: 'Secretariat',
  Validator: 'Validator',
  Twg: 'Technical Working Group',
  '3PIC': 'Third-Party Independent Committee',
  Judge: 'Judge',
  Admin: 'Administrator',
}

// Roles that may review submitted entries (mirrors the backend's reviewer roles).
export const REVIEWER_ROLES = ['Admin', 'Secretariat', 'Validator']
export const isReviewer = (roles = []) => roles.some((r) => REVIEWER_ROLES.includes(r))

// Roles that score entries in the pre-finals stage (mirrors the backend's /scoring roles).
// 3PIC are the assessors; Admins can view/oversee and override.
export const ASSESSOR_ROLES = ['Admin', '3PIC']
export const isAssessor = (roles = []) => roles.some((r) => ASSESSOR_ROLES.includes(r))
// A 3PIC assessor with no applicant/reviewer role belongs in the scoring workspace.
export const isPureAssessor = (roles = []) =>
  roles.includes('3PIC') && !roles.includes('Applicant') && !isReviewer(roles)

// A reviewer with no applicant role belongs in the review workspace — they have
// no entries of their own, so the applicant pages (overview, my entries, the
// submission editor) are empty or unusable for them.
export const isPureReviewer = (roles = []) => isReviewer(roles) && !roles.includes('Applicant')

export const isAdmin = (roles = []) => roles.includes('Admin')

// Highest-privilege role wins for the badge shown in the shell.
const ROLE_PRECEDENCE = ['Admin', 'Secretariat', 'Validator', 'Twg', '3PIC', 'Judge', 'Applicant']

export function primaryRole(roles = []) {
  for (const role of ROLE_PRECEDENCE) if (roles.includes(role)) return role
  return roles[0] || 'Applicant'
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

// Compact labels for the tight role chip (sidebar + topbar), where the full names are too long.
// The full name is kept for the chip's hover tooltip and everywhere else via roleLabel().
const ROLE_SHORT = { Twg: 'TWG', '3PIC': '3PIC' }
export function roleChipLabel(role) {
  return ROLE_SHORT[role] || roleLabel(role)
}

const OVERVIEW = { to: '/dashboard', end: true, label: 'Overview', icon: 'fa-gauge-high' }
const MY_ENTRIES = { to: '/dashboard/entries', label: 'My Entries', icon: 'fa-folder-open' }
const SUMMARY = { to: '/dashboard/summary', label: 'Summary', icon: 'fa-chart-pie' }
const REVIEW = { to: '/dashboard/review', label: 'Review Queue', icon: 'fa-clipboard-check' }
// Admins get the same list reframed as oversight — every entry, incl. drafts.
const SUBMISSIONS = { to: '/dashboard/review', label: 'Submissions', icon: 'fa-layer-group' }
// 3PIC scoring workspace, and the admin management of it.
const SCORING = { to: '/dashboard/scoring', label: 'Scoring', icon: 'fa-star-half-stroke' }
const ASSESSORS = { to: '/dashboard/admin/assessors', label: 'Assessors', icon: 'fa-user-check' }
const RESULTS = { to: '/dashboard/admin/scoring', label: 'Scoring Results', icon: 'fa-ranking-star' }
const ACCESS = { to: '/dashboard/admin/access', label: 'Manage Validators', icon: 'fa-user-shield' }
// Award categories now live on the public marketing page (ungated). The dashboard
// nav links out to it rather than hosting its own copy.
const AWARDS = { to: '/awards', label: 'Award Categories', icon: 'fa-award' }
const PROFILE = { to: '/dashboard/profile', label: 'Profile', icon: 'fa-id-badge' }

// Sidebar nav grouped into role-based sections: [{ label, items }]. A user with several roles gets
// several sections; the trailing section (label null) is the always-present general links. The shell
// only renders section headers when there's more than one role section, so single-role users stay flat.
export function navForRoles(roles = []) {
  const reviewer = isReviewer(roles)
  const assessor = isAssessor(roles)
  const admin = isAdmin(roles)
  // Default to the applicant view only for users with no back-office role.
  const applicant = roles.includes('Applicant') || (!reviewer && !assessor)

  const groups = []
  if (applicant) groups.push({ label: 'Applicant', items: [OVERVIEW, MY_ENTRIES] })
  if (reviewer) groups.push({ label: 'Review', items: [SUMMARY, admin ? SUBMISSIONS : REVIEW] })
  if (roles.includes('3PIC')) groups.push({ label: 'Scoring', items: [SCORING] }) // the assessor's own queue
  if (admin) groups.push({ label: 'Administration', items: [ACCESS, ASSESSORS, RESULTS] })
  groups.push({ label: null, items: [AWARDS, PROFILE] })
  return groups
}

// Applicant-only routes: the entry list and the focused submission editor. A
// pure reviewer should never be parked on one of these.
export function isApplicantOnlyPath(path = '') {
  return path === '/dashboard/entries' || path.startsWith('/entries')
}

// Where a freshly signed-in user belongs. Pure reviewers land in the review
// queue; everyone else gets the applicant overview.
export function roleHome(roles = []) {
  if (isPureReviewer(roles)) return '/dashboard/review'
  if (isPureAssessor(roles)) return '/dashboard/scoring'
  return '/dashboard'
}

// Whether a role set may view a path. Used to vet a remembered post-login `from`
// target so a stale deep link can't drop a reviewer on an applicant-only page.
export function canAccessPath(path, roles = []) {
  return !(isPureReviewer(roles) && isApplicantOnlyPath(path))
}

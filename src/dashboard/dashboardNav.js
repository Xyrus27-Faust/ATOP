// Role-driven dashboard navigation. Applicants compose and submit entries;
// reviewers (Secretariat / Validator / Admin) work the review queue. A user with
// both kinds of role sees both sets.

export const ROLE_LABELS = {
  Applicant: 'Applicant',
  Secretariat: 'Secretariat',
  Validator: 'Validator',
  Twg: 'Technical Working Group',
  '3PIC': 'Three-Pillar Committee',
  Judge: 'Judge',
  Admin: 'Administrator',
}

// Roles that may review submitted entries (mirrors the backend's reviewer roles).
export const REVIEWER_ROLES = ['Admin', 'Secretariat', 'Validator']
export const isReviewer = (roles = []) => roles.some((r) => REVIEWER_ROLES.includes(r))

// A reviewer with no applicant role belongs in the review workspace — they have
// no entries of their own, so the applicant pages (overview, my entries, the
// submission editor) are empty or unusable for them.
export const isPureReviewer = (roles = []) => isReviewer(roles) && !roles.includes('Applicant')

// Highest-privilege role wins for the badge shown in the shell.
const ROLE_PRECEDENCE = ['Admin', 'Secretariat', 'Validator', 'Twg', '3PIC', 'Judge', 'Applicant']

export function primaryRole(roles = []) {
  for (const role of ROLE_PRECEDENCE) if (roles.includes(role)) return role
  return roles[0] || 'Applicant'
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

const OVERVIEW = { to: '/dashboard', end: true, label: 'Overview', icon: 'fa-gauge-high' }
const MY_ENTRIES = { to: '/dashboard/entries', label: 'My Entries', icon: 'fa-folder-open' }
const REVIEW = { to: '/dashboard/review', label: 'Review Queue', icon: 'fa-clipboard-check' }
// Award categories now live on the public marketing page (ungated). The dashboard
// nav links out to it rather than hosting its own copy.
const AWARDS = { to: '/awards', label: 'Award Categories', icon: 'fa-award' }
const PROFILE = { to: '/dashboard/profile', label: 'Profile', icon: 'fa-id-badge' }

export function navForRoles(roles = []) {
  const reviewer = isReviewer(roles)
  const applicant = roles.includes('Applicant') || !reviewer // default to the applicant view
  const nav = []
  if (applicant) nav.push(OVERVIEW, MY_ENTRIES)
  if (reviewer) nav.push(REVIEW)
  nav.push(AWARDS, PROFILE)
  return nav
}

// Applicant-only routes: the entry list and the focused submission editor. A
// pure reviewer should never be parked on one of these.
export function isApplicantOnlyPath(path = '') {
  return path === '/dashboard/entries' || path.startsWith('/entries')
}

// Where a freshly signed-in user belongs. Pure reviewers land in the review
// queue; everyone else gets the applicant overview.
export function roleHome(roles = []) {
  return isPureReviewer(roles) ? '/dashboard/review' : '/dashboard'
}

// Whether a role set may view a path. Used to vet a remembered post-login `from`
// target so a stale deep link can't drop a reviewer on an applicant-only page.
export function canAccessPath(path, roles = []) {
  return !(isPureReviewer(roles) && isApplicantOnlyPath(path))
}

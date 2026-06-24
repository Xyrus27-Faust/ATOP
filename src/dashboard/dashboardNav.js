// Role-driven dashboard navigation. The Applicant experience is wired today;
// every member has the Applicant role by default. As staff/curation modules
// land, give those roles their own nav sets here — the shell already adapts.

export const ROLE_LABELS = {
  Applicant: 'Applicant',
  Secretariat: 'Secretariat',
  Validator: 'Validator',
  Twg: 'Technical Working Group',
  '3PIC': 'Three-Pillar Committee',
  Judge: 'Judge',
  Admin: 'Administrator',
}

// Highest-privilege role wins for the badge shown in the shell.
const ROLE_PRECEDENCE = ['Admin', 'Secretariat', 'Validator', 'Twg', '3PIC', 'Judge', 'Applicant']

export function primaryRole(roles = []) {
  for (const role of ROLE_PRECEDENCE) if (roles.includes(role)) return role
  return roles[0] || 'Applicant'
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

const APPLICANT_NAV = [
  { to: '/dashboard', end: true, label: 'Overview', icon: 'fa-gauge-high' },
  { to: '/dashboard/entries', label: 'My Entries', icon: 'fa-folder-open' },
  { to: '/dashboard/awards', label: 'Award Categories', icon: 'fa-award' },
  { to: '/dashboard/profile', label: 'Profile', icon: 'fa-id-badge' },
]

// The nav items for a user's roles. Applicant is the base experience everyone
// shares; this is where role-specific sections get composed in later.
export function navForRoles() {
  return APPLICANT_NAV
}

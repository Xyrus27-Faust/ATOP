// Client-side validators. These give fast, friendly feedback; the backend
// remains the source of truth (e.g. it deliberately hides whether an email is
// already registered, so we never promise "email taken").

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PASSWORD_MIN_LENGTH = 8 // matches the backend Identity policy

// Plain-language summary of the backend ASP.NET Identity password policy
// (RequiredLength=8 + the default requirements, all enabled).
export const PASSWORD_HINT =
  '8+ characters with an uppercase and lowercase letter, a number, and a symbol.'

export function validateEmail(email) {
  if (!email || !email.trim()) return 'Enter your email address.'
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.'
  return null
}

// Mirrors the backend policy so users get specific feedback before submitting:
// length >= 8 plus an uppercase, a lowercase, a digit, and a non-alphanumeric char.
export function validatePassword(password) {
  if (!password) return 'Enter a password.'
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Add a lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Add a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Add a symbol (e.g. ! ? @).'
  return null
}

export function validateRequired(value, label) {
  if (!value || !value.trim()) return `Enter your ${label}.`
  return null
}

export function validatePasswordConfirm(password, confirm) {
  if (!confirm) return 'Re-enter your password.'
  if (password !== confirm) return "Passwords don't match."
  return null
}

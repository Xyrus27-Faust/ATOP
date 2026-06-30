import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { api, ApiError } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Field, ctl } from '../components/form'
import { roleLabel } from '../dashboardNav'

// Roles a user can request from their profile. Adding a "scorer" later is one entry here plus the
// matching role in the backend allowlist (RoleRequestEndpoints.AssignableRoles).
const REQUESTABLE_ROLES = [
  { role: 'Validator', label: 'Validator', icon: 'fa-shield-halved', blurb: 'Review & validate submitted entries across all award categories.' },
]

function initials(user) {
  const a = user?.firstName?.[0]
  const b = user?.lastName?.[0]
  if (a || b) return `${a || ''}${b || ''}`.toUpperCase()
  return (user?.fullName || user?.email || '?').trim().slice(0, 2).toUpperCase()
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    designation: user?.designation || '',
    office: user?.office || '',
  })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [saving, setSaving] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setBanner(null) }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'First name is required.'
    if (!form.lastName.trim()) e.lastName = 'Last name is required.'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    setBanner(null)
    try {
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        designation: form.designation.trim() || null,
        office: form.office.trim() || null,
      })
      setBanner({ tone: 'success', message: 'Your profile has been updated.' })
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const mapped = {}
        const extra = []
        for (const [k, msgs] of Object.entries(err.fieldErrors)) {
          if (k === 'firstName' || k === 'lastName') mapped[k] = msgs[0]
          else extra.push(...msgs)
        }
        setErrors(mapped)
        setBanner({ tone: 'error', message: extra.length ? extra.join(' ') : 'Please fix the highlighted fields.' })
      } else {
        setBanner({ tone: 'error', message: err instanceof ApiError ? err.message : 'We couldn’t save your profile. Please try again.' })
      }
    } finally {
      setSaving(false)
    }
  }

  const tokenRoles = user?.roles || []

  // The live grant is the source of truth — not the request history. /auth/me returns the user's
  // CURRENT DB roles, so a revoke flips a role back to "requestable" and a fresh grant shows up
  // right away; the token (tokenRoles) only tells us whether it's usable yet or needs a re-login.
  // A failed fetch just means no extra badges — it never blocks the profile form.
  const { loading: reqLoading, data: access, reload: reloadRequests } = useAsync(async () => {
    const [me, reqs] = await Promise.all([
      api.get('/auth/me', { auth: true }).catch(() => null),
      api.get('/role-requests/mine', { auth: true }).catch(() => []),
    ])
    return { liveRoles: Array.isArray(me?.roles) ? me.roles : null, requests: reqs || [] }
  }, [])
  const liveRoles = access?.liveRoles ?? tokenRoles
  const requests = access?.requests || []

  const held = (role) => liveRoles.includes(role)
  const isPending = (role) => requests.some((r) => r.role === role && r.status === 'Pending')
  const wasDenied = (role) => {
    const decided = requests.filter((r) => r.role === role && (r.status === 'Approved' || r.status === 'Denied'))
    return decided.length > 0 && decided.reduce((a, b) => (new Date(b.requestedAt) > new Date(a.requestedAt) ? b : a)).status === 'Denied'
  }

  // Solid chips = granted AND already in the token (usable now). Granted-but-token-stale roles show
  // a "sign in again" badge instead; revoked roles simply drop out and become requestable again.
  const chipRoles = liveRoles.filter((r) => tokenRoles.includes(r))
  const reloginRoles = REQUESTABLE_ROLES.filter((r) => held(r.role) && !tokenRoles.includes(r.role))
  const pendingRoles = REQUESTABLE_ROLES.filter((r) => !held(r.role) && isPending(r.role))
  const declinedRoles = REQUESTABLE_ROLES.filter((r) => !held(r.role) && !isPending(r.role) && wasDenied(r.role))
  const requestable = REQUESTABLE_ROLES.filter((r) => !held(r.role) && !isPending(r.role))

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Account</span>
          <h1 className="dash-h1">Profile</h1>
          <p className="dash-sub">Keep your name and office details current — they appear on the entries you nominate.</p>
        </div>
      </div>

      <div className="pf-grid">
        <aside className="dash-card dash-card-pad pf-identity">
          <span className="pf-avatar" aria-hidden="true">{initials(user)}</span>
          <h2 className="pf-name">{user?.fullName || `${form.firstName} ${form.lastName}`.trim()}</h2>
          <span className="pf-email">{user?.email}</span>

          <div className="pf-roles">
            {chipRoles.map((r) => (
              <span key={r} className="dash-badge tone-progress">{roleLabel(r)}</span>
            ))}
            {/* Pending / approved-but-not-yet-active requests, shown as outlined badges below. */}
            {!reqLoading && pendingRoles.map((r) => (
              <span key={`p-${r.role}`} className="pf-req-badge is-pending" title="Awaiting an administrator's approval">
                <i className="fas fa-hourglass-half" aria-hidden="true" /> {r.label} · pending
              </span>
            ))}
            {!reqLoading && reloginRoles.map((r) => (
              <span key={`a-${r.role}`} className="pf-req-badge is-approved" title="Granted — sign out and back in to use it">
                <i className="fas fa-circle-check" aria-hidden="true" /> {r.label} · sign in again
              </span>
            ))}
            {!reqLoading && declinedRoles.map((r) => (
              <span key={`d-${r.role}`} className="pf-req-badge is-declined" title="Your request was declined — you can request again below">
                <i className="fas fa-circle-xmark" aria-hidden="true" /> {r.label} · declined
              </span>
            ))}
          </div>

          {!reqLoading && requestable.length > 0 && (
            <button type="button" className="dash-btn is-ghost is-sm pf-request-btn" onClick={() => setRequestOpen(true)}>
              <i className="fas fa-plus" aria-hidden="true" /> Request a role
            </button>
          )}
        </aside>

        <form className="dash-card dash-card-pad pf-form" onSubmit={handleSubmit} noValidate>
          {banner && (
            <div className={`dash-banner tone-${banner.tone}`}>
              <i className={`fas ${banner.tone === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} aria-hidden="true" />
              <span>{banner.message}</span>
            </div>
          )}

          <div className="dash-form-row">
            <Field label="First name" htmlFor="firstName" required error={errors.firstName}>
              <input id="firstName" className={ctl('dash-input', errors.firstName)} value={form.firstName} onChange={set('firstName')} autoComplete="given-name" />
            </Field>
            <Field label="Last name" htmlFor="lastName" required error={errors.lastName}>
              <input id="lastName" className={ctl('dash-input', errors.lastName)} value={form.lastName} onChange={set('lastName')} autoComplete="family-name" />
            </Field>
          </div>

          <Field label="Designation" htmlFor="designation" hint="Your title or role (optional).">
            <input id="designation" className="dash-input" value={form.designation} onChange={set('designation')} placeholder="e.g. Tourism Officer" />
          </Field>

          <Field label="Office" htmlFor="office" hint="The office or LGU you represent (optional).">
            <input id="office" className="dash-input" value={form.office} onChange={set('office')} placeholder="e.g. Provincial Tourism Office" />
          </Field>

          <Field label="Email" htmlFor="email" hint="Your sign-in email can’t be changed here.">
            <input id="email" className="dash-input" value={user?.email || ''} disabled />
          </Field>

          <div className="pf-actions">
            <button type="submit" className="dash-btn is-primary" disabled={saving}>
              {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : <><i className="fas fa-floppy-disk" aria-hidden="true" /> Save changes</>}
            </button>
          </div>
        </form>
      </div>

      {requestOpen && (
        <RequestRoleModal
          roles={requestable}
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => { setRequestOpen(false); reloadRequests() }}
        />
      )}

      <style>{`
        .pf-grid { display: grid; grid-template-columns: 280px 1fr; gap: 20px; align-items: start; }
        .pf-identity { text-align: center; }
        .pf-avatar {
          width: 84px; height: 84px; margin: 4px auto 16px; border-radius: 50%; display: grid; place-items: center;
          font-family: var(--font-heading); font-size: 1.6rem; font-weight: 800; color: var(--navy);
          background: linear-gradient(135deg, var(--gold-light), var(--gold)); box-shadow: 0 8px 22px rgba(200,168,75,0.4);
        }
        .pf-name { font-family: var(--font-heading); font-size: 1.2rem; font-weight: 800; color: var(--navy); line-height: 1.25; }
        .pf-email { display: block; color: var(--gray-600); font-size: 0.85rem; margin-top: 4px; word-break: break-all; }
        .pf-roles { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 16px; }
        .pf-req-badge { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-heading); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; border: 1px dashed var(--gray-300); }
        .pf-req-badge.is-pending { color: var(--gray-600); background: var(--off-white); }
        .pf-req-badge.is-approved { color: var(--success, #16a34a); border-color: var(--success, #16a34a); background: rgba(22,163,74,0.06); }
        .pf-req-badge.is-declined { color: var(--danger, #dc2626); border-color: var(--danger, #dc2626); background: rgba(220,38,38,0.05); }
        .pf-request-btn { margin-top: 16px; }
        .pf-form { display: flex; flex-direction: column; gap: 16px; }
        .pf-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
        @media (max-width: 760px) {
          .pf-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  )
}

// Pick a role to request. Lists only roles the user can still request (not held, not pending). An
// admin approves it; the grant is additive, so the user keeps submitting their own entries.
function RequestRoleModal({ roles, onClose, onSubmitted }) {
  const [selected, setSelected] = useState(roles[0]?.role || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/role-requests/', { role: selected }, { auth: true })
      onSubmitted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit your request. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="pf-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pf-modal" role="dialog" aria-modal="true" aria-label="Request a role">
        <div className="pf-modal-head">
          <h3>Request a role</h3>
          <button type="button" className="pf-modal-close" onClick={onClose} aria-label="Close"><i className="fas fa-xmark" aria-hidden="true" /></button>
        </div>
        <div className="pf-modal-body">
          <p className="pf-modal-note">Choose the access you’d like. An admin approves it; you’ll keep submitting your own entries.</p>
          {error && (
            <div className="dash-banner tone-error" style={{ marginBottom: 12 }}>
              <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
            </div>
          )}
          <div className="pf-role-options">
            {roles.map((r) => (
              <label key={r.role} className={`pf-role-opt${selected === r.role ? ' is-on' : ''}`}>
                <input type="radio" name="role" value={r.role} checked={selected === r.role} onChange={() => setSelected(r.role)} />
                <span className="pf-role-opt-text">
                  <span className="pf-role-opt-name"><i className={`fas ${r.icon}`} aria-hidden="true" /> {r.label}</span>
                  <span className="pf-role-opt-blurb">{r.blurb}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="pf-modal-actions">
            <button type="button" className="dash-btn is-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="button" className="dash-btn is-primary" onClick={submit} disabled={submitting || !selected}>
              {submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Submitting…</> : 'Submit request'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .pf-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(15,25,46,0.45); display: grid; place-items: center; padding: 20px; animation: pfFade 0.15s ease-out; }
        .pf-modal { width: 100%; max-width: 460px; background: var(--white); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg, 0 24px 60px rgba(15,25,46,0.3)); overflow: hidden; }
        .pf-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--gray-200); }
        .pf-modal-head h3 { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); }
        .pf-modal-close { display: grid; place-items: center; width: 32px; height: 32px; border: none; background: none; color: var(--gray-600); cursor: pointer; border-radius: 8px; }
        .pf-modal-close:hover { background: var(--gray-100); color: var(--navy); }
        .pf-modal-body { padding: 20px; }
        .pf-modal-note { color: var(--gray-600); font-size: 0.86rem; line-height: 1.6; margin-bottom: 14px; }
        .pf-role-options { display: flex; flex-direction: column; gap: 10px; }
        .pf-role-opt { display: flex; align-items: flex-start; gap: 11px; padding: 13px 14px; border: 1px solid var(--gray-200); border-radius: var(--radius-md); cursor: pointer; transition: var(--transition-fast); }
        .pf-role-opt:hover { border-color: var(--gold); }
        .pf-role-opt.is-on { border-color: var(--gold); background: rgba(200,168,75,0.07); }
        .pf-role-opt input { margin-top: 3px; width: 16px; height: 16px; accent-color: var(--gold-dark); cursor: pointer; flex-shrink: 0; }
        .pf-role-opt-text { display: flex; flex-direction: column; gap: 3px; }
        .pf-role-opt-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; }
        .pf-role-opt-blurb { color: var(--gray-600); font-size: 0.82rem; line-height: 1.5; }
        .pf-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        @keyframes pfFade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}

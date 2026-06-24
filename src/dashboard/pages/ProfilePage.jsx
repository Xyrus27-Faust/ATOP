import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/apiClient'
import { Field, ctl } from '../components/form'
import { roleLabel } from '../dashboardNav'

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

  const roles = user?.roles || []

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
            {roles.map((r) => (
              <span key={r} className="dash-badge tone-progress">{roleLabel(r)}</span>
            ))}
          </div>
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
        .pf-form { display: flex; flex-direction: column; gap: 16px; }
        .pf-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
        @media (max-width: 760px) {
          .pf-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  )
}

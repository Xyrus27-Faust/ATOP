import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { createCheckpoint, eventDays, formatDay, CHECKPOINT_KIND, LABEL_MAX, MEAL_NAMES } from '@/lib/checkin'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form.jsx'

const KINDS = Object.keys(CHECKPOINT_KIND)

// A starting name per kind, so the common case is two taps; a meal's name comes from the chips below.
const SUGGESTED_LABEL = { Entry: 'Entry', Meal: '' }

/**
 * Add one door or one meal on one day. A page, not a modal: the secretariat sets these up on a phone
 * at the venue as often as at a desk, and a full page keeps the keyboard from covering the form.
 */
export default function NewCheckpointPage() {
  const navigate = useNavigate()
  const { loading, error, data: event, reload } = useAsync(async () => (await api.get('/events/'))[0] || null, [])

  const [form, setForm] = useState({ day: '', kind: 'Entry', label: 'Entry', sortOrder: '' })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!event) {
    return (
      <div className="dash-card dash-empty">
        <h3>No published convention</h3>
        <p>Publish an event before setting up its checkpoints.</p>
      </div>
    )
  }

  const days = eventDays(event.startsAt, event.endsAt)
  const day = form.day || days[0]

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const pickName = (name) => {
    setForm((f) => ({ ...f, label: name }))
    setErrors((x) => ({ ...x, label: undefined }))
  }

  const pickKind = (kind) => {
    setForm((f) => ({
      ...f,
      kind,
      // Only swap the name if they haven't typed their own.
      label: Object.values(SUGGESTED_LABEL).includes(f.label) ? SUGGESTED_LABEL[kind] : f.label,
    }))
    setErrors((x) => ({ ...x, kind: undefined }))
  }

  async function submit(e) {
    e.preventDefault()
    const label = form.label.trim()
    if (!label) {
      setErrors({ label: 'Give it a name, e.g. “Lunch” or “Dinner”.' })
      return
    }
    setSaving(true)
    setBanner(null)
    try {
      await createCheckpoint(event.id, {
        day,
        kind: form.kind,
        label,
        sortOrder: form.sortOrder === '' ? null : Number(form.sortOrder),
      })
      navigate('/dashboard/admin/checkpoints')
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const mapped = {}
        for (const [k, msgs] of Object.entries(err.fieldErrors)) mapped[k] = msgs[0]
        setErrors(mapped)
      } else if (err instanceof ApiError && err.status === 409) {
        setErrors({ label: err.message })
      } else {
        setBanner(err.message || 'We couldn’t add the checkpoint. Please try again.')
      }
      setSaving(false)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <Link to="/dashboard/admin/checkpoints" className="dash-btn is-ghost is-sm ckn-back">
            <i className="fas fa-arrow-left" aria-hidden="true" /> Checkpoints
          </Link>
          <h1 className="dash-h1">New checkpoint</h1>
          <p className="dash-sub">One door or one meal, on one day. Marshals will see it in their list as soon as it&rsquo;s saved.</p>
        </div>
      </div>

      {banner && (
        <div className="dash-banner tone-error" style={{ marginBottom: 18 }}>
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{banner}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="dash-card dash-card-pad ckn-form">
        <Field label="Day" htmlFor="day" required error={errors.day}>
          <select id="day" className={ctl('dash-select', errors.day)} value={day} onChange={set('day')}>
            {days.map((d) => <option key={d} value={d}>{formatDay(d)}</option>)}
          </select>
        </Field>

        <Field label="Kind" required error={errors.kind}>
          <div className="ckn-kinds" role="radiogroup" aria-label="Kind">
            {KINDS.map((k) => {
              const meta = CHECKPOINT_KIND[k]
              const on = form.kind === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`ckn-kind${on ? ' is-on' : ''}`}
                  onClick={() => pickKind(k)}
                >
                  <i className={`fas ${meta.icon}`} aria-hidden="true" />
                  <strong>{meta.label}</strong>
                  <span>{meta.blurb}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          label="Name"
          htmlFor="label"
          required
          error={errors.label}
          hint={form.kind === 'Meal'
            ? 'Tap one, or type your own — e.g. “Merienda”. The marshal sees this at the top of the scanner.'
            : 'What the marshal sees at the top of the scanner.'}
          counter={{ text: `${form.label.length}/${LABEL_MAX}`, over: form.label.length > LABEL_MAX }}
        >
          <input
            id="label"
            className={ctl('dash-input', errors.label)}
            maxLength={LABEL_MAX}
            value={form.label}
            onChange={set('label')}
            placeholder={form.kind === 'Meal' ? 'e.g. Lunch' : 'e.g. Entry'}
          />
          {form.kind === 'Meal' && (
            <div className="ckn-names" role="group" aria-label="Common meal names">
              {MEAL_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`ckn-name${form.label === name ? ' is-on' : ''}`}
                  aria-pressed={form.label === name}
                  onClick={() => pickName(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Position in the list" htmlFor="sortOrder" error={errors.sortOrder} hint="Optional. Lower numbers show first within the day.">
          <input
            id="sortOrder"
            type="number"
            inputMode="numeric"
            className={ctl('dash-input', errors.sortOrder)}
            value={form.sortOrder}
            onChange={set('sortOrder')}
            placeholder="0"
          />
        </Field>

        <div className="ckn-foot">
          <Link to="/dashboard/admin/checkpoints" className="dash-btn is-ghost">Cancel</Link>
          <button type="submit" className="dash-btn is-primary" disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</>
              : <><i className="fas fa-check" aria-hidden="true" /> Add checkpoint</>}
          </button>
        </div>
      </form>
      <style>{CKN_CSS}</style>
    </>
  )
}

const CKN_CSS = `
  .dash-btn.ckn-back { display: flex; width: fit-content; margin-bottom: 12px; }
  .ckn-form { display: flex; flex-direction: column; gap: 18px; max-width: 640px; }
  .ckn-form .dash-input, .ckn-form .dash-select { font-size: 16px; min-height: 48px; }
  .ckn-kinds { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .ckn-kind {
    display: grid; grid-template-columns: 28px 1fr; column-gap: 12px; row-gap: 2px; align-items: center;
    min-height: 64px; padding: 12px 14px; text-align: left; cursor: pointer;
    background: var(--white); border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm);
    transition: var(--transition-fast);
  }
  .ckn-kind i { grid-row: span 2; font-size: 1.2rem; color: var(--gray-400); text-align: center; }
  .ckn-kind strong { font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
  .ckn-kind span { font-family: var(--font-body); font-size: 0.82rem; color: var(--gray-600); line-height: 1.45; }
  .ckn-kind:hover { border-color: var(--gold); }
  .ckn-kind.is-on { border-color: var(--gold); background: rgba(200,168,75,0.08); box-shadow: 0 0 0 3px rgba(200,168,75,0.18); }
  .ckn-kind.is-on i { color: var(--gold-dark); }
  .ckn-names { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .ckn-name {
    min-height: 40px; padding: 0 16px; cursor: pointer; border-radius: 999px;
    background: var(--white); border: 1.5px solid var(--gray-200); color: var(--navy);
    font-family: var(--font-heading); font-weight: 700; font-size: 0.85rem; transition: var(--transition-fast);
  }
  .ckn-name:hover { border-color: var(--gold); }
  .ckn-name.is-on { border-color: var(--gold); background: rgba(200,168,75,0.12); color: var(--gold-dark); }
  .ckn-foot { display: flex; flex-direction: column-reverse; gap: 10px; }
  .ckn-foot .dash-btn { justify-content: center; min-height: 48px; }

  @media (min-width: 640px) {
    .ckn-kinds { grid-template-columns: 1fr 1fr; }
    .ckn-foot { flex-direction: row; justify-content: flex-end; }
  }
`

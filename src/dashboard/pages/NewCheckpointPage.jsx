import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '@/lib/apiClient'
import { fetchCurrentEvent } from '@/lib/eventInfo'
import {
  createCheckpoint, listTourPackages, eventDays, scanningToday, formatDay, CHECKPOINT_KIND, LABEL_MAX, MEAL_NAMES,
} from '@/lib/checkin'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form.jsx'

const KINDS = Object.keys(CHECKPOINT_KIND)

// A starting name per kind, so the common case is two taps; a meal's name comes from the chips below,
// and a bus is named after the batch it boards.
const SUGGESTED_LABEL = { Entry: 'Entry', Meal: '', Tour: '' }

// "Heritage Tour — Bus A", cut to fit the label column.
const batchLabel = (pkg, batch) => `${pkg.name} — ${batch.label}`.slice(0, LABEL_MAX)

/**
 * Add one session, one meal or one tour bus on one day. A page, not a modal: the secretariat sets
 * these up on a phone at the venue as often as at a desk, and a full page keeps the keyboard from
 * covering the form.
 */
export default function NewCheckpointPage() {
  const navigate = useNavigate()
  const { loading, error, data, reload } = useAsync(async () => {
    const event = await fetchCurrentEvent()
    // The batches come with the page rather than on picking Tour, so the picker never spins mid-form.
    return { event, packages: event ? await listTourPackages(event.slug) : [] }
  }, [])
  const event = data?.event
  const packages = data?.packages || []

  const [form, setForm] = useState({ day: '', kind: 'Entry', label: 'Entry', sortOrder: '', tourBatchId: '' })
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

  // Any day from today on. The convention's own days are quick picks, and the first one still ahead
  // is the default; past the convention, today is.
  const today = scanningToday()
  const days = eventDays(event.startsAt, event.endsAt).filter((d) => d >= today)
  const day = form.day || days[0] || today
  const outside = day && !eventDays(event.startsAt, event.endsAt).includes(day)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const pickName = (name) => {
    setForm((f) => ({ ...f, label: name }))
    setErrors((x) => ({ ...x, label: undefined }))
  }

  // Every name this form filled in itself, so a name the secretariat typed is never overwritten.
  const suggested = (label) =>
    Object.values(SUGGESTED_LABEL).includes(label)
    || packages.some((p) => p.batches.some((b) => batchLabel(p, b) === label))

  const pickKind = (kind) => {
    setForm((f) => ({
      ...f,
      kind,
      label: suggested(f.label) ? SUGGESTED_LABEL[kind] : f.label,
      tourBatchId: kind === 'Tour' ? f.tourBatchId : '',
    }))
    setErrors((x) => ({ ...x, kind: undefined, tourBatchId: undefined }))
  }

  // A batch carries its own name and, once ATOP has dated it, its day.
  const pickBatch = (e) => {
    const id = e.target.value
    const pkg = packages.find((p) => p.batches.some((b) => b.id === id))
    const batch = pkg?.batches.find((b) => b.id === id)
    setForm((f) => ({
      ...f,
      tourBatchId: id,
      label: batch && suggested(f.label) ? batchLabel(pkg, batch) : f.label,
      day: batch?.tourDate && batch.tourDate >= today ? batch.tourDate : f.day,
    }))
    setErrors((x) => ({ ...x, tourBatchId: undefined, label: undefined, day: undefined }))
  }

  async function submit(e) {
    e.preventDefault()
    const label = form.label.trim()
    if (!day || day < today) {
      setErrors({ day: 'Pick today or a later day.' })
      return
    }
    if (form.kind === 'Tour' && !form.tourBatchId) {
      setErrors({ tourBatchId: 'Pick the tour batch this bus is for.' })
      return
    }
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
        tourBatchId: form.kind === 'Tour' ? form.tourBatchId : null,
      })
      navigate('/dashboard/admin/checkin')
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const mapped = {}
        for (const [k, msgs] of Object.entries(err.fieldErrors)) mapped[k] = msgs[0]
        setErrors(mapped)
      } else if (err instanceof ApiError && err.status === 409) {
        // The label index, or — on a bus — two tabs adding the same batch at once. Either way the
        // name is what to change.
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
          <Link to="/dashboard/admin/checkin" className="dash-btn is-ghost is-sm ckn-back">
            <i className="fas fa-arrow-left" aria-hidden="true" /> Checkpoints
          </Link>
          <h1 className="dash-h1">New checkpoint</h1>
          <p className="dash-sub">One session, meal or tour bus, on one day. Marshals will see it in their list as soon as it&rsquo;s saved.</p>
        </div>
      </div>

      {banner && (
        <div className="dash-banner tone-error" style={{ marginBottom: 18 }}>
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{banner}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="dash-card dash-card-pad ckn-form">
        <Field
          label="Day"
          htmlFor="day"
          required
          error={errors.day}
          hint={outside
            ? `Not a convention day. Marshals will only see this on ${formatDay(day)}.`
            : 'Tap a convention day, or pick any date from today on.'}
        >
          <input
            id="day"
            type="date"
            className={ctl('dash-input', errors.day)}
            min={today}
            value={day}
            onChange={set('day')}
          />
          <div className="ckn-names" role="group" aria-label="Quick picks">
            {[...new Set([today, ...days])].map((d) => (
              <button
                key={d}
                type="button"
                className={`ckn-name${day === d ? ' is-on' : ''}`}
                aria-pressed={day === d}
                onClick={() => { setForm((f) => ({ ...f, day: d })); setErrors((x) => ({ ...x, day: undefined })) }}
              >
                {d === today ? 'Today' : formatDay(d)}
              </button>
            ))}
          </div>
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

        {form.kind === 'Tour' && (
          <Field
            label="Tour batch"
            htmlFor="tourBatchId"
            required
            error={errors.tourBatchId}
            hint="One checkpoint per batch. Delegates booked on another batch are told which bus is theirs."
          >
            {packages.length === 0 ? (
              <p className="dash-help">This convention has no tours set up.</p>
            ) : (
              <select
                id="tourBatchId"
                className={ctl('dash-select', errors.tourBatchId)}
                value={form.tourBatchId}
                onChange={pickBatch}
              >
                <option value="">Choose a batch…</option>
                {packages.map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    {p.batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {[b.label, b.session, b.tourDate && formatDay(b.tourDate)].filter(Boolean).join(' · ')}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>
        )}

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
            placeholder={{ Meal: 'e.g. Lunch', Tour: 'e.g. Heritage Tour — Bus A' }[form.kind] || 'e.g. Oct 21 AM'}
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
          <Link to="/dashboard/admin/checkin" className="dash-btn is-ghost">Cancel</Link>
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
    .ckn-kinds { grid-template-columns: 1fr 1fr 1fr; }
    .ckn-foot { flex-direction: row; justify-content: flex-end; }
  }
`

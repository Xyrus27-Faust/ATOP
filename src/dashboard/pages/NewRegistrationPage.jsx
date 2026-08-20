import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { validateEmail } from '@/lib/validation'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form'
import DelegateFields, { emptyDelegate, validateDelegate, toDelegatePayload } from '../components/DelegateFields'
import {
  REGISTRANT_TYPES,
  PARTICIPANT_TYPE_LABELS,
  minimumDownpayment,
  MIN_DOWNPAYMENT_RATE,
  formatPeso,
  modeMeta,
} from '@/lib/events'

const STEPS = [
  { key: 'who', label: 'Who’s registering' },
  { key: 'delegates', label: 'Delegates' },
  { key: 'review', label: 'Review & pay' },
]

// Which step a given (client or server) error key belongs to. Server keys come
// back as `delegates[0].email`, `contact.name`, `amount`, etc.
function stepForKey(key) {
  if (key.startsWith('delegates')) return 1
  if (key === 'amount' || key === 'checkout') return 2
  return 0
}

/**
 * Book a delegation. One registration covers everyone travelling under the same
 * payer, so the delegate list is a repeater rather than a separate flow — an LGU
 * sending three people in person and two online fills this in once and pays once.
 *
 * The rate picker (not a separate mode toggle) drives each delegate's attendance
 * mode, so the price and the mode can never disagree.
 */
export default function NewRegistrationPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { loading, error, data, reload } = useAsync(() => api.get('/events/'), [])

  const [step, setStep] = useState(0)
  // The contact defaults to the signed-in user — they're usually the one going.
  // Seeded lazily at first render rather than patched in by an effect.
  const [form, setForm] = useState(() => ({
    registrantType: '',
    lguRegion: '',
    lguProvince: '',
    lguCode: '',
    organizationName: '',
    'contact.name': [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    'contact.designation': '',
    'contact.office': '',
    'contact.email': user?.email ?? '',
    'contact.mobile': '',
    'contact.landline': '',
    notes: '',
  }))
  // Two ways to pay, and nothing else to decide: the whole thing, or a downpayment
  // of at least a quarter that reserves the slots with the balance due later.
  const [payment, setPayment] = useState('full')
  const [downpayment, setDownpayment] = useState('')
  const [delegates, setDelegates] = useState([emptyDelegate()])
  const [ratesSeeded, setRatesSeeded] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // LGU cascade (PSGC): regions load once, provinces and cities on selection.
  const [regions, setRegions] = useState([])
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])

  useEffect(() => {
    let active = true
    api.get('/lgus/regions').then((r) => { if (active) setRegions(r) }).catch(() => {})
    return () => { active = false }
  }, [])

  const event = data?.[0]
  const rates = useMemo(() => event?.rates ?? [], [event])
  const rateByCode = useMemo(() => new Map(rates.map((r) => [r.code, r])), [rates])

  const soleRate = rates.length === 1 ? rates[0] : null

  // With one rate on sale there is nothing for anyone to pick, so fill it in once the
  // event has loaded. An effect, not render-time state, so React isn't asked to update
  // during a render pass.
  useEffect(() => {
    if (!soleRate || ratesSeeded) return
    setDelegates((list) => list.map((d) => (d.rateCode ? d : { ...d, rateCode: soleRate.code })))
    setRatesSeeded(true)
  }, [soleRate, ratesSeeded])

  const total = delegates.reduce((sum, d) => sum + Number(rateByCode.get(d.rateCode)?.amount ?? 0), 0)
  const inPersonCount = delegates.filter((d) => rateByCode.get(d.rateCode)?.attendanceMode === 'InPerson').length
  const virtualCount = delegates.filter((d) => rateByCode.get(d.rateCode)?.attendanceMode === 'Virtual').length

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  if (!event || !event.registrationOpen) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-calendar-xmark" aria-hidden="true" /></div>
        <h3>Registration is closed</h3>
        <p>{event?.registrationClosedReason || 'There is no convention open for registration right now.'}</p>
        <button className="dash-btn" onClick={() => navigate('/dashboard/convention')}>Back to the convention</button>
      </div>
    )
  }

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((p) => ({ ...p, [key]: undefined }))
  }

  const setDelegate = (index, key, value) => {
    setDelegates((list) => list.map((d, i) => (i === index ? { ...d, [key]: value } : d)))
    setErrors((p) => ({ ...p, [`delegates[${index}].${key}`]: undefined }))
  }

  // Each cascade selection narrows and resets everything below it.
  const onRegionChange = (e) => {
    const region = e.target.value
    setForm((f) => ({ ...f, lguRegion: region, lguProvince: '', lguCode: '' }))
    setProvinces([])
    setCities([])
    setErrors((p) => ({ ...p, lguRegion: undefined, lguProvince: undefined, lguCode: undefined }))
    if (region) api.get(`/lgus/provinces?region=${region}`).then(setProvinces).catch(() => {})
  }

  const onProvinceChange = (e) => {
    const province = e.target.value
    setForm((f) => ({ ...f, lguProvince: province, lguCode: '' }))
    setCities([])
    setErrors((p) => ({ ...p, lguProvince: undefined, lguCode: undefined }))
    if (province) api.get(`/lgus/cities?province=${encodeURIComponent(province)}`).then(setCities).catch(() => {})
  }

  // A real province can itself be the LGU; synthetic grouping rows can't.
  const selectedProvince = provinces.find((p) => p.code === form.lguProvince)
  const cityOptions = [
    ...(selectedProvince?.selectable
      ? [{ code: selectedProvince.code, name: `— Whole province (${selectedProvince.name}) —` }]
      : []),
    ...cities,
  ]

  function validateStep(index) {
    const e = {}

    if (index === 0) {
      if (!form.registrantType) e.registrantType = 'Choose who is registering.'
      if (form.registrantType === 'LguDelegation') {
        if (!form.lguRegion) e.lguRegion = 'Select a region.'
        if (!form.lguProvince) e.lguProvince = 'Select a province.'
        if (!form.lguCode) e.lguCode = 'Select your city or municipality.'
      }
      if (form.registrantType === 'Organization' && !form.organizationName.trim())
        e.organizationName = 'Organization name is required.'

      if (!form['contact.name'].trim()) e['contact.name'] = 'Contact name is required.'
      if (!form['contact.designation'].trim()) e['contact.designation'] = 'Designation is required.'
      const contactEmailErr = validateEmail(form['contact.email'])
      if (contactEmailErr) e['contact.email'] = contactEmailErr
      if (!form['contact.mobile'].trim()) e['contact.mobile'] = 'Mobile number is required.'
    }

    if (index === 1) {
      if (delegates.length === 0) e.delegates = 'Add at least one delegate.'
      delegates.forEach((d, i) => {
        Object.assign(e, validateDelegate(d, `delegates[${i}].`, validateEmail))
      })
    }

    if (index === 2 && payment === 'downpayment') {
      const floor = minimumDownpayment(total)
      const amount = Number(downpayment)
      if (!downpayment.trim() || Number.isNaN(amount)) {
        e.amount = 'Enter how much you are paying now.'
      } else if (amount < floor) {
        e.amount = `A downpayment must be at least ${formatPeso(floor)}.`
      } else if (amount > total) {
        e.amount = `That is more than the ${formatPeso(total)} total. Choose “pay in full” instead.`
      }
    }

    setErrors((prev) => ({ ...prev, ...e }))
    return Object.keys(e).length === 0
  }

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(STEPS.length - 1, s + 1)) }
  const back = () => setStep((s) => Math.max(0, s - 1))

  async function submit() {
    // Re-validate every step: a user can reach the end and then edit backwards.
    for (let i = 0; i < STEPS.length; i++) {
      if (!validateStep(i)) { setStep(i); return }
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const created = await api.post(
        `/events/${event.slug}/registrations`,
        {
          registrantType: form.registrantType,
          lguCode: form.registrantType === 'LguDelegation' ? form.lguCode : null,
          organizationName: form.organizationName.trim() || null,
          contact: {
            name: form['contact.name'].trim(),
            designation: form['contact.designation'].trim(),
            office: form['contact.office'].trim() || null,
            email: form['contact.email'].trim(),
            mobile: form['contact.mobile'].trim(),
            landline: form['contact.landline'].trim() || null,
          },
          notes: form.notes.trim() || null,
          delegates: delegates.map(toDelegatePayload),
        },
        { auth: true },
      )

      // Straight on to the gateway with the amount they chose on this very step — going via a
      // second page would ask them to decide the same thing twice.
      const origin = globalThis.location?.origin ?? ''
      const back = `${origin}/convention/registrations/${created.id}`
      try {
        const invoice = await api.post(
          `/registrations/${created.id}/checkout`,
          {
            amount: payment === 'downpayment' ? Number(downpayment) : null,
            successRedirectUrl: back,
            failureRedirectUrl: back,
          },
          { auth: true },
        )
        if (invoice.checkoutUrl) {
          globalThis.location.assign(invoice.checkoutUrl)
          return
        }
      } catch {
        // The booking is saved either way — never lose it because the gateway hiccuped.
        // Its own page explains what happened and offers Pay again.
      }
      navigate(`/convention/registrations/${created.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        // Server keys match our client keys, so they land on the right inputs.
        const mapped = Object.fromEntries(
          Object.entries(err.fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]),
        )
        setErrors(mapped)
        const firstStep = Math.min(...Object.keys(mapped).map(stepForKey))
        setStep(Number.isFinite(firstStep) ? firstStep : 0)
      } else {
        setSubmitError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">{event.name}</span>
          <h1 className="dash-h1">Register delegates</h1>
          <p className="dash-sub">
            One registration covers your whole delegation — mix in-person and online delegates, and pay once.
          </p>
        </div>
      </div>

      <div className="dash-steps nr-steps">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`dash-step${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}>
            <span className="dash-step-dot">{i < step ? <i className="fas fa-check" aria-hidden="true" /> : i + 1}</span>
            <span className="nr-step-label">{s.label}</span>
            {i < STEPS.length - 1 && <span className={`dash-step-line${i < step ? ' is-done' : ''}`} />}
          </div>
        ))}
      </div>

      {/* ---- Step 1: who's registering ---- */}
      {step === 0 && (
        <div className="dash-card dash-card-pad nr-card">
          <h2 className="dash-card-title">Who’s registering</h2>

          <Field label="Registering as" required error={errors.registrantType}>
            <div className="nr-types">
              {REGISTRANT_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  className={`nr-type${form.registrantType === t.value ? ' is-active' : ''}`}
                  onClick={() => set('registrantType', t.value)}
                >
                  <i className={`fas ${t.icon}`} aria-hidden="true" />
                  <span className="nr-type-label">{t.label}</span>
                  <span className="nr-type-hint">{t.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          {form.registrantType === 'LguDelegation' && (
            <>
              <p className="dash-help nr-cascade-hint">
                Pick your LGU from the official PSGC list — the same one used for Pearl Awards entries.
              </p>
              <div className="dash-form-row">
                <Field label="Region" htmlFor="lguRegion" required error={errors.lguRegion}>
                  <select id="lguRegion" className={ctl('dash-select', errors.lguRegion)} value={form.lguRegion} onChange={onRegionChange}>
                    <option value="">Select region…</option>
                    {/* /lgus/regions returns { region, name } — not { value, label }. */}
                    {regions.map((r) => <option key={r.region} value={r.region}>{r.name}</option>)}
                  </select>
                </Field>
                <Field label="Province" htmlFor="lguProvince" required error={errors.lguProvince}>
                  <select id="lguProvince" className={ctl('dash-select', errors.lguProvince)} value={form.lguProvince} onChange={onProvinceChange} disabled={!form.lguRegion}>
                    <option value="">{form.lguRegion ? 'Select province…' : 'Choose a region first'}</option>
                    {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="City / Municipality" htmlFor="lguCode" required error={errors.lguCode}>
                  <select id="lguCode" className={ctl('dash-select', errors.lguCode)} value={form.lguCode} onChange={(e) => set('lguCode', e.target.value)} disabled={!form.lguProvince}>
                    <option value="">{form.lguProvince ? 'Select city/municipality…' : 'Choose a province first'}</option>
                    {cityOptions.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </Field>
              </div>
            </>
          )}

          {form.registrantType === 'Organization' && (
            <Field label="Organization name" htmlFor="orgName" required error={errors.organizationName}>
              <input id="orgName" className={ctl('dash-input', errors.organizationName)} value={form.organizationName} onChange={(e) => set('organizationName', e.target.value)} />
            </Field>
          )}

          <h3 className="nr-h3">Contact person</h3>
          <p className="dash-help">Every confirmation, receipt, and delegate code goes to this person.</p>

          <div className="dash-form-row">
            <Field label="Full name" htmlFor="cName" required error={errors['contact.name']}>
              <input id="cName" className={ctl('dash-input', errors['contact.name'])} value={form['contact.name']} onChange={(e) => set('contact.name', e.target.value)} />
            </Field>
            <Field label="Designation" htmlFor="cDesig" required error={errors['contact.designation']}>
              <input id="cDesig" className={ctl('dash-input', errors['contact.designation'])} value={form['contact.designation']} onChange={(e) => set('contact.designation', e.target.value)} />
            </Field>
          </div>
          <div className="dash-form-row">
            <Field label="Office" htmlFor="cOffice" error={errors['contact.office']}>
              <input id="cOffice" className="dash-input" value={form['contact.office']} onChange={(e) => set('contact.office', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="cEmail" required error={errors['contact.email']}>
              <input id="cEmail" type="email" className={ctl('dash-input', errors['contact.email'])} value={form['contact.email']} onChange={(e) => set('contact.email', e.target.value)} />
            </Field>
          </div>
          <div className="dash-form-row">
            <Field label="Mobile" htmlFor="cMobile" required error={errors['contact.mobile']}>
              <input id="cMobile" className={ctl('dash-input', errors['contact.mobile'])} value={form['contact.mobile']} onChange={(e) => set('contact.mobile', e.target.value)} />
            </Field>
            <Field label="Landline" htmlFor="cLandline" hint="Optional — often the surest way to reach an LGU office.">
              <input id="cLandline" className="dash-input" value={form['contact.landline']} onChange={(e) => set('contact.landline', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {/* ---- Step 2: delegates ---- */}
      {step === 1 && (
        <>
          {errors.delegates && (
            <div className="dash-banner nr-banner-error">
              <i className="fas fa-circle-exclamation" aria-hidden="true" /> {errors.delegates}
            </div>
          )}

          {delegates.map((d, i) => {
            const rate = rateByCode.get(d.rateCode)
            const meta = rate ? modeMeta(rate.attendanceMode) : null

            return (
              <div key={i} className="dash-card dash-card-pad nr-card nr-delegate">
                <div className="nr-del-head">
                  <h2 className="dash-card-title">
                    Delegate {i + 1}
                    {meta && (
                      <span className={`dash-badge tone-${meta.tone} nr-del-mode`}>
                        <i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.label}
                      </span>
                    )}
                  </h2>
                  {delegates.length > 1 && (
                    <button
                      type="button"
                      className="nr-del-remove"
                      onClick={() => setDelegates((list) => list.filter((_, idx) => idx !== i))}
                    >
                      <i className="fas fa-trash-can" aria-hidden="true" /> Remove
                    </button>
                  )}
                </div>

                <DelegateFields
                  value={d}
                  rates={rates}
                  errors={errors}
                  errorPrefix={`delegates[${i}].`}
                  idPrefix={`d${i}`}
                  onChange={(field, val) => setDelegate(i, field, val)}
                />
              </div>
            )
          })}

          <button type="button" className="dash-btn nr-add" onClick={() => setDelegates((list) => [...list, emptyDelegate(soleRate?.code ?? '')])}>
            <i className="fas fa-plus" aria-hidden="true" /> Add another delegate
          </button>
        </>
      )}

      {/* ---- Step 3: review & pay ---- */}
      {step === 2 && (
        <>
          <div className="dash-card dash-card-pad nr-card">
            <h2 className="dash-card-title">Review</h2>
            <p className="dash-help">
              Check this over before paying. Once you pay, the booking is locked — the Secretariat can
              still swap a delegate for you right up to the day before the convention.
            </p>

            <dl className="nr-review">
              <div>
                <dt>Registering as</dt>
                <dd>{REGISTRANT_TYPES.find((t) => t.value === form.registrantType)?.label || '—'}</dd>
              </div>
              {form.registrantType === 'LguDelegation' && (
                <div>
                  <dt>LGU</dt>
                  <dd>{cityOptions.find((c) => c.code === form.lguCode)?.name || form.lguCode || '—'}</dd>
                </div>
              )}
              {form.registrantType === 'Organization' && (
                <div><dt>Organization</dt><dd>{form.organizationName || '—'}</dd></div>
              )}
              <div>
                <dt>Contact</dt>
                <dd>
                  {form['contact.name']} · {form['contact.designation']}
                  <span className="nr-review-sub">{form['contact.email']} · {form['contact.mobile']}</span>
                </dd>
              </div>
              {form.notes.trim() && <div><dt>Notes</dt><dd>{form.notes.trim()}</dd></div>}
            </dl>

            <table className="nr-review-table">
              <thead>
                <tr>
                  <th>Delegate</th>
                  <th>Classification</th>
                  <th className="nr-review-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {delegates.map((d, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{[d.firstName, d.lastName].filter(Boolean).join(' ') || `Delegate ${i + 1}`}</strong>
                      <span className="nr-review-sub">{d.designation}{d.email ? ` · ${d.email}` : ''}</span>
                    </td>
                    <td>{PARTICIPANT_TYPE_LABELS[d.participantType] || d.participantType}</td>
                    <td className="nr-review-num">{formatPeso(rateByCode.get(d.rateCode)?.amount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="nr-review-num"><strong>{formatPeso(total)}</strong></td>
                </tr>
              </tfoot>
            </table>

            <button type="button" className="nr-review-edit" onClick={() => setStep(1)}>
              <i className="fas fa-pen" aria-hidden="true" /> Edit delegates
            </button>
          </div>

          <div className="dash-card dash-card-pad nr-card">
            <h2 className="dash-card-title">How much are you paying now?</h2>

            <div className="nr-pay">
              <button
                type="button"
                className={`nr-pay-opt${payment === 'full' ? ' is-active' : ''}`}
                onClick={() => { setPayment('full'); setErrors((p) => ({ ...p, amount: undefined })) }}
              >
                <span className="nr-pay-top"><i className="fas fa-circle-check" aria-hidden="true" /> Pay in full</span>
                <span className="nr-pay-amount">{formatPeso(total)}</span>
                <span className="nr-pay-hint">Confirms every delegate on the spot.</span>
              </button>

              <button
                type="button"
                className={`nr-pay-opt${payment === 'downpayment' ? ' is-active' : ''}`}
                onClick={() => setPayment('downpayment')}
              >
                <span className="nr-pay-top"><i className="fas fa-hourglass-half" aria-hidden="true" /> Downpayment</span>
                <span className="nr-pay-amount">from {formatPeso(minimumDownpayment(total))}</span>
                <span className="nr-pay-hint">
                  At least {Math.round(MIN_DOWNPAYMENT_RATE * 100)}% now, the balance before the convention.
                </span>
              </button>
            </div>

            {payment === 'downpayment' && (
              <Field
                label="Amount to pay now"
                htmlFor="dpAmount"
                required
                error={errors.amount}
                hint={`At least ${formatPeso(minimumDownpayment(total))}. The balance of ${formatPeso(Math.max(0, total - (Number(downpayment) || 0)))} stays open on your booking.`}
              >
                <input
                  id="dpAmount"
                  type="number"
                  inputMode="decimal"
                  min={minimumDownpayment(total)}
                  max={total}
                  step="0.01"
                  className={ctl('dash-input', errors.amount)}
                  value={downpayment}
                  onChange={(e) => { setDownpayment(e.target.value); setErrors((p) => ({ ...p, amount: undefined })) }}
                />
              </Field>
            )}

            <p className="dash-help nr-pay-note">
              Payment is online through Xendit — GCash, Maya, card, bank transfer or over the counter.
              Your booking is confirmed when the payment clears, not when you return from the payment page.
            </p>

            {submitError && (
              <div className="dash-banner nr-banner-error">
                <i className="fas fa-circle-exclamation" aria-hidden="true" /> {submitError.message}
              </div>
            )}
          </div>
        </>
      )}

      {/* Running total — visible on every step, because the number is the decision. */}
      <div className="dash-card nr-total">
        <div className="nr-total-counts">
          {inPersonCount > 0 && <span><i className="fas fa-location-dot" aria-hidden="true" /> {inPersonCount} in person</span>}
          {virtualCount > 0 && <span><i className="fas fa-video" aria-hidden="true" /> {virtualCount} online</span>}
          {inPersonCount === 0 && virtualCount === 0 && <span className="nr-total-empty">No registration types chosen yet</span>}
        </div>
        <div className="nr-total-amount">
          <span className="nr-total-caption">Total payable</span>
          <strong>{formatPeso(total)}</strong>
        </div>
      </div>

      <div className="nr-actions">
        <button type="button" className="dash-btn" onClick={step === 0 ? () => navigate('/dashboard/convention') : back}>
          <i className="fas fa-arrow-left" aria-hidden="true" /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="dash-btn is-primary" onClick={next}>
            Continue <i className="fas fa-arrow-right" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="dash-btn is-primary" onClick={submit} disabled={submitting}>
            {submitting
              ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Taking you to payment…</>
              : <><i className="fas fa-credit-card" aria-hidden="true" /> Register and pay {formatPeso(
                  payment === 'downpayment' ? (Number(downpayment) || minimumDownpayment(total)) : total)}</>}
          </button>
        )}
      </div>

      <style>{`
        .nr-review { display: grid; gap: 14px; margin: 0 0 20px; }
        .nr-review > div { display: grid; grid-template-columns: 160px 1fr; gap: 12px; align-items: baseline; }
        .nr-review dt {
          font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600);
        }
        .nr-review dd { margin: 0; color: var(--navy); }
        .nr-review-sub { display: block; color: var(--gray-600); font-size: 0.86rem; margin-top: 2px; }

        .nr-review-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .nr-review-table th {
          text-align: left; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-600);
          padding: 8px 10px; border-bottom: 1px solid var(--gray-200);
        }
        .nr-review-table td { padding: 10px; border-bottom: 1px solid var(--gray-100); vertical-align: top; }
        .nr-review-table tfoot td { border-bottom: none; border-top: 2px solid var(--gray-200); font-family: var(--font-heading); }
        .nr-review-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .nr-review-edit {
          background: none; border: none; padding: 0; cursor: pointer;
          font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gold-dark);
        }
        .nr-review-edit:hover { text-decoration: underline; }

        .nr-pay { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .nr-pay-opt {
          display: flex; flex-direction: column; gap: 4px; text-align: left; cursor: pointer;
          padding: 14px 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
          background: var(--white); transition: var(--transition-fast);
        }
        .nr-pay-opt:hover { border-color: var(--gold); }
        .nr-pay-opt.is-active { border-color: var(--navy); box-shadow: inset 0 0 0 1px var(--navy); background: var(--off-white); }
        .nr-pay-top { font-family: var(--font-heading); font-weight: 700; font-size: 0.82rem; color: var(--navy); }
        .nr-pay-amount { font-family: var(--font-heading); font-weight: 800; font-size: 1.3rem; color: var(--navy); font-variant-numeric: tabular-nums; }
        .nr-pay-hint { font-size: 0.82rem; color: var(--gray-600); }
        .nr-pay-note { margin-top: 4px; }

        /* The shared stepper sizes to its content (fixed 34px connectors), which leaves it
           hugging the left of a wide card. Let each step share the width and the connector
           absorb the slack instead. Scoped to this page so the entry wizard is unaffected. */
        .dash-steps.nr-steps { width: 100%; margin-bottom: 20px; }
        .dash-steps.nr-steps .dash-step { flex: 1 1 0; min-width: 0; }
        .dash-steps.nr-steps .dash-step:last-child { flex: 0 0 auto; }
        .dash-steps.nr-steps .dash-step-line { flex: 1 1 auto; width: auto; min-width: 24px; }
        .nr-step-label { overflow: hidden; text-overflow: ellipsis; }

        /* Vertical rhythm. .dash-field and .dash-form-row carry no outer margin, so stacked
           controls sit flush against each other; this form is long enough that it reads as a
           wall without it. Fields *inside* a row are spaced by the row's own grid gap. */
        .nr-card .dash-field, .nr-card .dash-form-row { margin-bottom: 20px; }
        .nr-card .dash-form-row .dash-field { margin-bottom: 0; }
        /* Standalone checkboxes are part of the same rhythm — without this the official-receipt
           tick sits flush against the Notes field below it. Direct children only, so the
           per-delegate consent block keeps its own tighter spacing. */
        .nr-card > .dash-check { display: flex; margin-bottom: 20px; }
        .nr-card .dash-field:last-child, .nr-card .dash-form-row:last-child { margin-bottom: 0; }

        .nr-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
        .nr-type {
          display: flex; flex-direction: column; gap: 4px; text-align: left; cursor: pointer;
          padding: 14px 16px; border-radius: 10px; border: 1px solid var(--gray-200);
          background: var(--white); transition: var(--transition-fast);
        }
        .nr-type:hover { border-color: var(--gold); }
        .nr-type.is-active { border-color: var(--navy); box-shadow: inset 0 0 0 1px var(--navy); }
        .nr-type > i { color: var(--gold); font-size: 1.05rem; }
        .nr-type-label { font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
        .nr-type-hint { font-size: 0.78rem; color: var(--gray-600); }

        .nr-cascade-hint { margin: 4px 0 14px; }
        .nr-h3 { font-family: var(--font-heading); font-size: 0.95rem; font-weight: 800; color: var(--navy); margin: 30px 0 4px; }
        .nr-card .dash-card-title { margin-bottom: 16px; }
        /* Direct children only — .dash-help is also the hint inside a Field's footer, and the
           footer is a flex container, so a blanket rule would pad every hint too. */
        .nr-card > .dash-help { margin-bottom: 18px; }

        .nr-delegate { margin-bottom: 14px; }
        .nr-del-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .nr-del-mode { margin-left: 10px; vertical-align: middle; }
        .nr-del-remove {
          border: none; background: none; cursor: pointer; color: #B91C1C;
          font-size: 0.8rem; font-weight: 700; padding: 4px 6px; border-radius: 6px;
        }
        .nr-del-remove:hover { background: #FEF2F2; }

        .nr-add { margin-bottom: 18px; }

        .nr-banner-error {
          display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
          padding: 12px 16px; border-radius: 10px;
          background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; font-size: 0.86rem;
        }

        /* Compound selector on purpose: DashboardLayout injects DASH_CSS *after* the routed
           page, so a bare .nr-total loses the background to .dash-card on equal specificity. */
        .dash-card.nr-total {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 16px 20px; margin: 18px 0;
          background: var(--navy); color: var(--white); border-color: var(--navy);
        }
        .nr-total-counts { display: flex; gap: 18px; flex-wrap: wrap; font-size: 0.86rem; opacity: 0.9; }
        .nr-total-empty { opacity: 0.7; font-style: italic; }
        .nr-total-amount { display: flex; flex-direction: column; align-items: flex-end; }
        .nr-total-caption { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; }
        .nr-total-amount strong { font-family: var(--font-heading); font-size: 1.6rem; font-weight: 800; }

        .nr-actions { display: flex; justify-content: space-between; gap: 12px; }

        @media (max-width: 640px) {
          .nr-total { flex-direction: column; align-items: flex-start; }
          .nr-total-amount { align-items: flex-start; }
        }
      `}</style>
    </>
  )
}

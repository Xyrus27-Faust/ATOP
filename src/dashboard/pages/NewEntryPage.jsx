import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { validateEmail } from '@/lib/validation'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form'
import {
  COVERAGE_OPTIONS,
  LGU_LEVELS,
  REGIONS,
  ENTRANT_TYPE_LABELS,
  NOMINATOR_RULE_LABELS,
} from '@/lib/pearlAwards'

const EMPTY = {
  categoryNumber: '',
  title: '',
  coverage: '',
  'lgu.name': '',
  'lgu.level': '',
  'lgu.region': '',
  'nominator.firstName': '',
  'nominator.lastName': '',
  'nominator.designation': '',
  'nominator.office': '',
  'nominator.email': '',
  'nominator.mobile': '',
  'nominator.officialAddress': '',
  'nominator.alternateContact': '',
  'nominator.officialLguEmail': '',
  'nominator.isThirdParty': false,
}

const STEPS = [
  { key: 'category', label: 'Category' },
  { key: 'lgu', label: 'Your LGU' },
  { key: 'nominator', label: 'Nominator' },
]

// Which step a given (client or server) error key belongs to.
function stepForKey(key) {
  if (key.startsWith('lgu.')) return 1
  if (key.startsWith('nominator')) return 2
  return 0
}

export default function NewEntryPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { loading, error, data, reload } = useAsync(() => api.get('/award-categories/'), [])

  // A category may be pre-selected via ?category=N (e.g. "Start an entry" on a
  // category page). Seed the form so the wizard opens on that category. The
  // nominator defaults to the signed-in user's profile — editable if they're
  // nominating on someone else's behalf.
  const presetCategory = params.get('category')
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    categoryNumber: presetCategory ?? '',
    'nominator.firstName': user?.firstName ?? '',
    'nominator.lastName': user?.lastName ?? '',
    'nominator.email': user?.email ?? '',
    'nominator.designation': user?.designation ?? '',
    'nominator.office': user?.office ?? '',
  }))
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)

  // For a preset third-party-only category, default the nominator toggle on
  // (mirrors onCategoryChange for a manual pick). Runs once when the catalog lands.
  const presetApplied = useRef(false)
  useEffect(() => {
    if (presetApplied.current || !data || !presetCategory) return
    presetApplied.current = true
    const cat = data.categories.find((c) => c.number === Number(presetCategory))
    if (cat?.nominatorRule === 'ThirdPartyOnly') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, 'nominator.isThirdParty': true }))
    }
  }, [data, presetCategory])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const catalog = data
  const category = catalog.categories.find((c) => c.number === Number(form.categoryNumber))
  const levelOptions =
    category && category.eligibleLguLevels?.length
      ? LGU_LEVELS.filter((l) => category.eligibleLguLevels.includes(l.value))
      : LGU_LEVELS

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function onCategoryChange(e) {
    const number = e.target.value
    const cat = catalog.categories.find((c) => c.number === Number(number))
    setForm((f) => ({
      ...f,
      categoryNumber: number,
      'lgu.level': '', // eligible levels differ per category
      'nominator.isThirdParty': cat?.nominatorRule === 'ThirdPartyOnly' ? true : f['nominator.isThirdParty'],
    }))
    setErrors((p) => ({ ...p, categoryNumber: undefined }))
  }

  function errorsForStep(i) {
    const e = {}
    if (i === 0) {
      if (!form.categoryNumber) e.categoryNumber = 'Choose a category.'
      if (!form.title.trim()) e.title = 'Give your entry a title.'
      if (!form.coverage) e.coverage = 'Select how the program maps to the coverage year.'
    } else if (i === 1) {
      if (!form['lgu.name'].trim()) e['lgu.name'] = 'LGU name is required.'
      if (!form['lgu.level']) e['lgu.level'] = 'Select an LGU level.'
      if (!form['lgu.region']) e['lgu.region'] = 'Select a region.'
    } else if (i === 2) {
      if (!form['nominator.firstName'].trim()) e['nominator.firstName'] = 'First name is required.'
      if (!form['nominator.lastName'].trim()) e['nominator.lastName'] = 'Last name is required.'
      if (!form['nominator.designation'].trim()) e['nominator.designation'] = 'Designation is required.'
      if (!form['nominator.office'].trim()) e['nominator.office'] = 'Office is required.'
      const emailErr = validateEmail(form['nominator.email'])
      if (emailErr) e['nominator.email'] = emailErr
      if (!form['nominator.mobile'].trim()) e['nominator.mobile'] = 'Mobile number is required.'
      if (!form['nominator.officialAddress'].trim()) e['nominator.officialAddress'] = 'Official address is required.'
      const lguEmailErr = validateEmail(form['nominator.officialLguEmail'])
      if (lguEmailErr) e['nominator.officialLguEmail'] = lguEmailErr
      if (category?.nominatorRule === 'ThirdPartyOnly' && !form['nominator.isThirdParty'])
        e['nominator.isThirdParty'] = 'This category requires a third-party nominator.'
    }
    return e
  }

  function goToStep(i) {
    setBanner(null)
    setStep(i)
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setBanner(null)

    // Advance through the steps; only submit on the last one.
    if (step < STEPS.length - 1) {
      const e = errorsForStep(step)
      setErrors(e)
      if (Object.keys(e).length === 0) setStep(step + 1)
      return
    }

    const allErrors = { ...errorsForStep(0), ...errorsForStep(1), ...errorsForStep(2) }
    if (Object.keys(allErrors).length) {
      setErrors(allErrors)
      setStep(Math.min(...Object.keys(allErrors).map(stepForKey)))
      setBanner({ tone: 'error', message: 'Please fix the highlighted fields before continuing.' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        categoryNumber: Number(form.categoryNumber),
        title: form.title.trim(),
        coverage: form.coverage,
        lgu: { name: form['lgu.name'].trim(), level: form['lgu.level'], region: form['lgu.region'] },
        nominator: {
          firstName: form['nominator.firstName'].trim(),
          lastName: form['nominator.lastName'].trim(),
          designation: form['nominator.designation'].trim(),
          office: form['nominator.office'].trim(),
          email: form['nominator.email'].trim(),
          mobile: form['nominator.mobile'].trim(),
          officialAddress: form['nominator.officialAddress'].trim(),
          alternateContact: form['nominator.alternateContact'].trim() || null,
          officialLguEmail: form['nominator.officialLguEmail'].trim(),
          isThirdParty: form['nominator.isThirdParty'],
        },
      }
      const created = await api.post('/entries/', payload, { auth: true })
      navigate(`/entries/${created.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const mapped = {}
        for (const [k, msgs] of Object.entries(err.fieldErrors)) mapped[k] = msgs[0]
        setErrors((p) => ({ ...p, ...mapped }))
        const steps = Object.keys(mapped).map(stepForKey)
        if (steps.length) setStep(Math.min(...steps))
        setBanner({ tone: 'error', message: 'Please fix the highlighted fields.' })
      } else {
        setBanner({ tone: 'error', message: err instanceof ApiError ? err.message : 'We couldn’t create the entry. Please try again.' })
      }
      setSubmitting(false)
    }
  }

  const isLast = step === STEPS.length - 1

  return (
    <>
      <div className="dash-page-head">
        <div>
          <button type="button" className="dash-btn is-ghost is-sm ne-back" onClick={() => navigate('/dashboard/entries')}>
            <i className="fas fa-arrow-left" aria-hidden="true" /> My entries
          </button>
          <h1 className="dash-h1">Create an entry</h1>
          <p className="dash-sub">Three quick steps. You’ll compose the bidbook, declaration, and endorsement next.</p>
        </div>
      </div>

      {banner && (
        <div className={`dash-banner tone-${banner.tone}`} style={{ marginBottom: 18 }}>
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{banner.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="ne-grid">
        <div className="ne-col">
          {/* Step indicator */}
          <ol className="ne-steps">
            {STEPS.map((s, i) => (
              <li key={s.key} className={`ne-step${i === step ? ' is-active' : i < step ? ' is-done' : ''}`}>
                <button type="button" onClick={() => i < step && goToStep(i)} disabled={i > step}>
                  <span className="ne-step-num">{i < step ? <i className="fas fa-check" aria-hidden="true" /> : i + 1}</span>
                  <span className="ne-step-label">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>

          {/* Context once a category is chosen */}
          {category && step > 0 && (
            <div className="ne-context">
              <span className="dash-badge tone-progress">#{category.number}</span>
              <span>{form.title || category.name}</span>
            </div>
          )}

          <section className="dash-card dash-card-pad ne-section">
            {step === 0 && (
              <>
                <div className="dash-card-title"><i className="fas fa-award" aria-hidden="true" /> Category &amp; program</div>
                <Field label="Award category" htmlFor="categoryNumber" required error={errors.categoryNumber}>
                  <select id="categoryNumber" className={ctl('dash-select', errors.categoryNumber)} value={form.categoryNumber} onChange={onCategoryChange}>
                    <option value="">Select a category…</option>
                    {catalog.categories.map((c) => (
                      <option key={c.number} value={c.number}>#{c.number} — {c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Entry title" htmlFor="title" required error={errors.title} hint="Name the program or initiative you’re entering.">
                  <input id="title" className={ctl('dash-input', errors.title)} value={form.title} onChange={set('title')} placeholder="e.g. Bohol Heritage Trails Revitalization" />
                </Field>
                <Field label="Program coverage" htmlFor="coverage" required error={errors.coverage}>
                  <select id="coverage" className={ctl('dash-select', errors.coverage)} value={form.coverage} onChange={set('coverage')}>
                    <option value="">Select coverage…</option>
                    {COVERAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <div className="dash-card-title"><i className="fas fa-building-columns" aria-hidden="true" /> Local government unit</div>
                <Field label="LGU name" htmlFor="lguName" required error={errors['lgu.name']}>
                  <input id="lguName" className={ctl('dash-input', errors['lgu.name'])} value={form['lgu.name']} onChange={set('lgu.name')} placeholder="e.g. Province of Bohol" />
                </Field>
                <div className="dash-form-row">
                  <Field label="Level" htmlFor="lguLevel" required error={errors['lgu.level']}>
                    <select id="lguLevel" className={ctl('dash-select', errors['lgu.level'])} value={form['lgu.level']} onChange={set('lgu.level')}>
                      <option value="">Select level…</option>
                      {levelOptions.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Region" htmlFor="lguRegion" required error={errors['lgu.region']}>
                    <select id="lguRegion" className={ctl('dash-select', errors['lgu.region'])} value={form['lgu.region']} onChange={set('lgu.region')}>
                      <option value="">Select region…</option>
                      {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="dash-card-title"><i className="fas fa-user-tie" aria-hidden="true" /> Nominator</div>
                <p className="dash-help" style={{ marginTop: -4 }}>Pre-filled from your profile — edit it if you’re nominating on someone else’s behalf.</p>
                <div className="dash-form-row">
                  <Field label="First name" htmlFor="nomFirst" required error={errors['nominator.firstName']}>
                    <input id="nomFirst" className={ctl('dash-input', errors['nominator.firstName'])} value={form['nominator.firstName']} onChange={set('nominator.firstName')} />
                  </Field>
                  <Field label="Last name" htmlFor="nomLast" required error={errors['nominator.lastName']}>
                    <input id="nomLast" className={ctl('dash-input', errors['nominator.lastName'])} value={form['nominator.lastName']} onChange={set('nominator.lastName')} />
                  </Field>
                </div>
                <div className="dash-form-row">
                  <Field label="Designation" htmlFor="nomDesig" required error={errors['nominator.designation']}>
                    <input id="nomDesig" className={ctl('dash-input', errors['nominator.designation'])} value={form['nominator.designation']} onChange={set('nominator.designation')} />
                  </Field>
                  <Field label="Office" htmlFor="nomOffice" required error={errors['nominator.office']}>
                    <input id="nomOffice" className={ctl('dash-input', errors['nominator.office'])} value={form['nominator.office']} onChange={set('nominator.office')} />
                  </Field>
                </div>
                <div className="dash-form-row">
                  <Field label="Email" htmlFor="nomEmail" required error={errors['nominator.email']}>
                    <input id="nomEmail" type="email" className={ctl('dash-input', errors['nominator.email'])} value={form['nominator.email']} onChange={set('nominator.email')} />
                  </Field>
                  <Field label="Mobile" htmlFor="nomMobile" required error={errors['nominator.mobile']}>
                    <input id="nomMobile" className={ctl('dash-input', errors['nominator.mobile'])} value={form['nominator.mobile']} onChange={set('nominator.mobile')} placeholder="+63…" />
                  </Field>
                </div>
                <Field label="Official address" htmlFor="nomAddr" required error={errors['nominator.officialAddress']}>
                  <input id="nomAddr" className={ctl('dash-input', errors['nominator.officialAddress'])} value={form['nominator.officialAddress']} onChange={set('nominator.officialAddress')} />
                </Field>
                <div className="dash-form-row">
                  <Field label="Official LGU email" htmlFor="nomLguEmail" required error={errors['nominator.officialLguEmail']}>
                    <input id="nomLguEmail" type="email" className={ctl('dash-input', errors['nominator.officialLguEmail'])} value={form['nominator.officialLguEmail']} onChange={set('nominator.officialLguEmail')} />
                  </Field>
                  <Field label="Alternate contact" htmlFor="nomAlt" hint="Optional">
                    <input id="nomAlt" className="dash-input" value={form['nominator.alternateContact']} onChange={set('nominator.alternateContact')} />
                  </Field>
                </div>
                <Field error={errors['nominator.isThirdParty']}>
                  <label className="dash-check">
                    <input type="checkbox" checked={form['nominator.isThirdParty']} onChange={set('nominator.isThirdParty')} />
                    <span>This is a third-party nomination (the nominator is not the entrant themselves).</span>
                  </label>
                </Field>
              </>
            )}
          </section>

          <div className="ne-actions">
            {step > 0 ? (
              <button type="button" className="dash-btn" onClick={() => goToStep(step - 1)}>
                <i className="fas fa-arrow-left" aria-hidden="true" /> Back
              </button>
            ) : (
              <button type="button" className="dash-btn" onClick={() => navigate('/dashboard/entries')}>Cancel</button>
            )}
            <div style={{ flex: 1 }} />
            <button type="submit" className="dash-btn is-primary" disabled={submitting}>
              {isLast
                ? (submitting ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Creating…</> : <>Create &amp; continue <i className="fas fa-arrow-right" aria-hidden="true" /></>)
                : <>Next <i className="fas fa-arrow-right" aria-hidden="true" /></>}
            </button>
          </div>
        </div>

        {/* Guidance rail */}
        <aside className="ne-aside">
          <div className="dash-card dash-card-pad ne-guide">
            {category ? (
              <>
                <span className="dash-badge tone-progress" style={{ marginBottom: 10 }}>Category #{category.number}</span>
                <h3 className="ne-guide-title">{category.name}</h3>
                <p className="ne-guide-def">{category.definition}</p>
                <dl className="ne-facts">
                  <div><dt>Entrant</dt><dd>{ENTRANT_TYPE_LABELS[category.entrantType] || category.entrantType}</dd></div>
                  <div><dt>Nomination</dt><dd>{NOMINATOR_RULE_LABELS[category.nominatorRule] || category.nominatorRule}</dd></div>
                  <div><dt>Criteria</dt><dd>{category.criteria.length} · {category.criteria.reduce((s, c) => s + c.points, 0)} pts</dd></div>
                </dl>
                {category.eligibilityText && (
                  <p className="ne-guide-elig"><strong>Eligibility.</strong> {category.eligibilityText}</p>
                )}
              </>
            ) : (
              <div className="ne-guide-empty">
                <i className="fas fa-hand-pointer" aria-hidden="true" />
                <p>Select a category to see its definition, eligibility, and what assessors look for.</p>
              </div>
            )}
          </div>
        </aside>
      </form>

      <style>{`
        .ne-back { padding-left: 0; margin-bottom: 4px; }
        .ne-grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; }
        .ne-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .ne-section { display: flex; flex-direction: column; gap: 15px; }
        .ne-actions { display: flex; align-items: center; gap: 12px; }
        .ne-aside { position: sticky; top: 84px; }

        /* Stepper */
        .ne-steps { display: flex; gap: 8px; list-style: none; margin: 0; padding: 0; }
        .ne-step { flex: 1; }
        .ne-step button {
          width: 100%; display: flex; align-items: center; gap: 10px; cursor: default;
          background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
          padding: 11px 14px; font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem; color: var(--gray-400);
          transition: var(--transition-fast);
        }
        .ne-step button:not(:disabled) { cursor: pointer; }
        .ne-step.is-active button { border-color: var(--gold); color: var(--navy); box-shadow: 0 0 0 3px rgba(200,168,75,0.12); }
        .ne-step.is-done button { color: var(--navy); border-color: var(--gray-200); }
        .ne-step.is-done button:hover { border-color: var(--gold); }
        .ne-step-num { width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-size: 0.72rem; background: var(--gray-100); color: var(--gray-400); }
        .ne-step.is-active .ne-step-num { background: var(--gold); color: var(--white); }
        .ne-step.is-done .ne-step-num { background: var(--navy); color: var(--gold-light); }

        .ne-context { display: flex; align-items: center; gap: 10px; font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; }

        .ne-guide-title { font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800; color: var(--navy); line-height: 1.25; margin-bottom: 10px; }
        .ne-guide-def { color: var(--gray-600); font-size: 0.88rem; line-height: 1.6; margin-bottom: 16px; }
        .ne-facts { display: flex; flex-direction: column; gap: 0; margin-bottom: 14px; }
        .ne-facts > div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--gray-100); }
        .ne-facts dt { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gray-600); }
        .ne-facts dd { font-size: 0.84rem; color: var(--navy); text-align: right; font-weight: 600; }
        .ne-guide-elig { font-size: 0.82rem; color: var(--gray-600); line-height: 1.55; }
        .ne-guide-elig strong { color: var(--navy); }
        .ne-guide-empty { text-align: center; color: var(--gray-400); padding: 16px 8px; }
        .ne-guide-empty i { font-size: 1.8rem; color: var(--gold); margin-bottom: 12px; }
        .ne-guide-empty p { font-size: 0.86rem; line-height: 1.55; }

        @media (max-width: 900px) {
          .ne-grid { grid-template-columns: 1fr; }
          .ne-aside { position: static; order: -1; }
          .ne-step-label { display: none; }
          .ne-step button { justify-content: center; }
        }
      `}</style>
    </>
  )
}

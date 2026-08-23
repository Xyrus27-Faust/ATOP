import { Field, ctl } from './form'
import { PARTICIPANT_TYPES, DOWNPAYMENT_PER_PAX, formatPeso, modeMeta } from '@/lib/events'

/**
 * The field set for one delegate: rate picker, name, contact, and consents.
 *
 * Shared by the booking form (which repeats it per delegate) and the "add a delegate"
 * dialog on an existing registration. One copy so the required fields and — more
 * importantly — the RA 10173 consent wording can't drift apart between the two.
 *
 * Error keys differ between the two callers: the booking form gets `delegates[2].email`
 * from the server, the add dialog gets a bare `email`. Hence `errorPrefix`.
 *
 * Carries its own styles, like Modal, so a page can drop it in without copying CSS.
 */
export default function DelegateFields({
  value,
  rates,
  errors = {},
  errorPrefix = '',
  idPrefix = 'dlg',
  onChange,
}) {
  const at = (field) => errors[`${errorPrefix}${field}`]
  const id = (field) => `${idPrefix}-${field}`
  const set = (field) => (e) => onChange(field, e.target.value)

  return (
    <div className="dlg-fields">
      {/* One rate on sale means there is nothing to choose: state the price instead of asking.
          The picker comes back by itself the day ATOP switches online attendance back on. */}
      {rates.length === 1 ? (
        <>
          <div className="dlg-onerate">
            <span className="dlg-onerate-label">
              <i className="fas fa-user-tie" aria-hidden="true" /> {rates[0].label}
            </span>
            <span className="dlg-onerate-amount">{formatPeso(rates[0].amount)}</span>
          </div>

          {/* Each seat is paid for on its own terms — one delegation can settle three people and
              reserve two, which is how an LGU's funds actually arrive. */}
          <Field label="Paying for this delegate" required error={at('paymentMode')}>
            <div className="dlg-pay">
              <button
                type="button"
                className={`dlg-pay-opt${value.paymentMode !== 'downpayment' ? ' is-active' : ''}`}
                onClick={() => onChange('paymentMode', 'full')}
              >
                <span className="dlg-pay-top">In full</span>
                <span className="dlg-pay-amount">{formatPeso(rates[0].amount)}</span>
              </button>
              <button
                type="button"
                className={`dlg-pay-opt${value.paymentMode === 'downpayment' ? ' is-active' : ''}`}
                onClick={() => onChange('paymentMode', 'downpayment')}
              >
                <span className="dlg-pay-top">Reserve now</span>
                <span className="dlg-pay-amount">{formatPeso(DOWNPAYMENT_PER_PAX)}</span>
                <span className="dlg-pay-hint">
                  balance {formatPeso(Math.max(0, rates[0].amount - DOWNPAYMENT_PER_PAX))} before the convention
                </span>
              </button>
            </div>
          </Field>
        </>
      ) : (
      <Field label="Registration type" required error={at('rateCode')}>
        <div className="dlg-rates">
          {rates.map((r) => {
            const rm = modeMeta(r.attendanceMode)
            return (
              <button
                type="button"
                key={r.id ?? r.code}
                className={`dlg-rate${value.rateCode === r.code ? ' is-active' : ''}`}
                onClick={() => onChange('rateCode', r.code)}
              >
                <span className="dlg-rate-top">
                  <i className={`fas ${rm.icon}`} aria-hidden="true" /> {rm.label}
                </span>
                <span className="dlg-rate-amount">{formatPeso(r.amount)}</span>
                <span className="dlg-rate-label">{r.label}</span>
              </button>
            )
          })}
        </div>
      </Field>
      )}

      <div className="dash-form-row">
        <Field label="First name" htmlFor={id('fn')} required error={at('firstName')}>
          <input id={id('fn')} className={ctl('dash-input', at('firstName'))} value={value.firstName} onChange={set('firstName')} />
        </Field>
        <Field label="Middle name" htmlFor={id('mn')}>
          <input id={id('mn')} className="dash-input" value={value.middleName} onChange={set('middleName')} />
        </Field>
        <Field label="Last name" htmlFor={id('ln')} required error={at('lastName')}>
          <input id={id('ln')} className={ctl('dash-input', at('lastName'))} value={value.lastName} onChange={set('lastName')} />
        </Field>
        <Field label="Suffix" htmlFor={id('sf')} hint="Jr., III…">
          <input id={id('sf')} className="dash-input" value={value.suffix} onChange={set('suffix')} />
        </Field>
      </div>

      <div className="dash-form-row">
        <Field label="Designation" htmlFor={id('dg')} required error={at('designation')}>
          <input id={id('dg')} className={ctl('dash-input', at('designation'))} value={value.designation} onChange={set('designation')} />
        </Field>
        <Field label="Office / department" htmlFor={id('od')}>
          <input id={id('od')} className="dash-input" value={value.officeDepartment} onChange={set('officeDepartment')} />
        </Field>
      </div>

      <div className="dash-form-row">
        <Field label="Email" htmlFor={id('em')} required error={at('email')} hint="Their badge or stream link is sent here.">
          <input id={id('em')} type="email" className={ctl('dash-input', at('email'))} value={value.email} onChange={set('email')} />
        </Field>
        <Field label="Mobile" htmlFor={id('mb')} required error={at('mobile')}>
          <input id={id('mb')} className={ctl('dash-input', at('mobile'))} value={value.mobile} onChange={set('mobile')} />
        </Field>
      </div>

      <div className="dash-form-row">
        <Field label="Classification" htmlFor={id('pt')} required error={at('participantType')}
               hint="What they are attending as. Everyone pays the same rate.">
          <select id={id('pt')} className={ctl('dash-select', at('participantType'))}
                  value={value.participantType} onChange={set('participantType')}>
            {PARTICIPANT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="dlg-consents">
        <label className={`dash-check dlg-consent${at('dataPrivacyConsent') ? ' has-error' : ''}`}>
          <input type="checkbox" checked={value.dataPrivacyConsent} onChange={(e) => onChange('dataPrivacyConsent', e.target.checked)} />
          <span>
            <strong>Data privacy consent</strong> — this delegate consents to ATOP processing their
            personal data for convention registration and attendance, under RA 10173.
          </span>
        </label>
        {at('dataPrivacyConsent') && (
          <span className="dash-error">
            <i className="fas fa-circle-exclamation" aria-hidden="true" /> {at('dataPrivacyConsent')}
          </span>
        )}
        <label className="dash-check dlg-consent">
          <input type="checkbox" checked={value.mediaReleaseConsent} onChange={(e) => onChange('mediaReleaseConsent', e.target.checked)} />
          <span>
            <strong>Media release</strong> — this delegate agrees to appear in event photos and the
            livestream. Optional.
          </span>
        </label>
      </div>

      <style>{`
        /* Vertical rhythm: the shared field primitives carry no outer margin. */
        .dlg-fields > .dash-field, .dlg-fields > .dash-form-row { margin-bottom: 20px; }
        .dlg-fields .dash-form-row .dash-field { margin-bottom: 0; }

        .dlg-rates { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
        .dlg-rate {
          display: flex; flex-direction: column; gap: 2px; text-align: left; cursor: pointer;
          padding: 12px 14px; border-radius: 10px; border: 1px solid var(--gray-200);
          background: var(--white); transition: var(--transition-fast);
        }
        .dlg-rate:hover { border-color: var(--gold); }
        .dlg-rate.is-active { border-color: var(--navy); box-shadow: inset 0 0 0 1px var(--navy); }
        .dlg-rate-top { font-size: 0.76rem; font-weight: 700; color: var(--gray-600); text-transform: uppercase; letter-spacing: 0.04em; }
        .dlg-rate-amount { font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800; color: var(--navy); }
        .dlg-onerate {
    display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
    padding: 12px 16px; margin-bottom: 18px;
    background: var(--off-white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
  }
  .dlg-pay { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .dlg-pay-opt {
    display: flex; flex-direction: column; gap: 2px; text-align: left; cursor: pointer;
    padding: 10px 13px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
    background: var(--white); transition: var(--transition-fast);
  }
  .dlg-pay-opt:hover { border-color: var(--gold); }
  .dlg-pay-opt.is-active { border-color: var(--navy); box-shadow: inset 0 0 0 1px var(--navy); background: var(--off-white); }
  .dlg-pay-top { font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--gray-600); }
  .dlg-pay-amount { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); font-variant-numeric: tabular-nums; }
  .dlg-pay-hint { font-size: 0.78rem; color: var(--gray-600); }

  .dlg-onerate-label { font-family: var(--font-heading); font-weight: 700; font-size: 0.86rem; color: var(--navy); }
  .dlg-onerate-amount { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-variant-numeric: tabular-nums; }

  .dlg-rate-label { font-size: 0.78rem; color: var(--gray-600); }

        .dlg-consents { display: flex; flex-direction: column; gap: 10px; padding-top: 16px; border-top: 1px solid var(--gray-200); }
        .dlg-consent span { font-size: 0.83rem; line-height: 1.45; }
        .dlg-consent.has-error { color: #B91C1C; }
      `}</style>
    </div>
  )
}

/** A blank delegate, shared so both callers start from the same shape. */
// eslint-disable-next-line react-refresh/only-export-components
export const emptyDelegate = (defaultRateCode = '') => ({
  rateCode: defaultRateCode,
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  designation: '',
  officeDepartment: '',
  email: '',
  mobile: '',
  participantType: 'Delegate',
  // How this seat is being paid for. Not part of the delegate the server stores — it is a choice
  // about money, carried to checkout.
  paymentMode: 'full',
  dataPrivacyConsent: false,
  mediaReleaseConsent: false,
})

/**
 * Client-side checks for one delegate, keyed with `errorPrefix`. Mirrors the server's
 * DelegateFactory so the two can't disagree about what's required.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function validateDelegate(d, errorPrefix, validateEmail) {
  const e = {}
  const at = (field) => `${errorPrefix}${field}`

  if (!d.rateCode) e[at('rateCode')] = 'Choose a registration type.'
  if (!d.participantType) e[at('participantType')] = 'Choose a classification.'
  if (!d.firstName.trim()) e[at('firstName')] = 'First name is required.'
  if (!d.lastName.trim()) e[at('lastName')] = 'Last name is required.'
  if (!d.designation.trim()) e[at('designation')] = 'Designation is required.'
  const emailErr = validateEmail(d.email)
  if (emailErr) e[at('email')] = emailErr
  if (!d.mobile.trim()) e[at('mobile')] = 'Mobile number is required.'
  // RA 10173 — consent is given, never defaulted.
  if (!d.dataPrivacyConsent) e[at('dataPrivacyConsent')] = 'Consent is required to register this delegate.'

  return e
}

/**
 * The other direction: a saved delegate back into form state, for resuming a draft.
 * Names come back as one `fullName`, so the parts are read from the stored fields.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const fromDelegateResponse = (d) => ({
  ...emptyDelegate(d.rateCode),
  firstName: d.firstName ?? '',
  middleName: d.middleName ?? '',
  lastName: d.lastName ?? '',
  suffix: d.suffix ?? '',
  designation: d.designation ?? '',
  officeDepartment: d.officeDepartment ?? '',
  email: d.email ?? '',
  mobile: d.mobile ?? '',
  participantType: d.participantType ?? 'Delegate',
  // Consent was given when the draft was saved; re-ticking it on resume would be theatre.
  dataPrivacyConsent: Boolean(d.dataPrivacyConsentAt),
  mediaReleaseConsent: Boolean(d.mediaReleaseConsent),
})

/** Strip a delegate down to the API's payload shape. */
// eslint-disable-next-line react-refresh/only-export-components
export const toDelegatePayload = (d) => ({
  rateCode: d.rateCode,
  firstName: d.firstName.trim(),
  middleName: d.middleName.trim() || null,
  lastName: d.lastName.trim(),
  suffix: d.suffix.trim() || null,
  designation: d.designation.trim(),
  officeDepartment: d.officeDepartment.trim() || null,
  email: d.email.trim(),
  mobile: d.mobile.trim(),
  participantType: d.participantType,
  dataPrivacyConsent: d.dataPrivacyConsent,
  mediaReleaseConsent: d.mediaReleaseConsent,
})

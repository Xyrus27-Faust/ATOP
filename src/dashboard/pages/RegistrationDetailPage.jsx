import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form'
import Modal from '../components/Modal'
import { validateEmail } from '@/lib/validation'
import { formatDate, labelFor, REGIONS } from '@/lib/pearlAwards'
import {
  formatPeso,
  modeMeta,
  registrationStatusMeta,
  delegateStatusMeta,
  invoiceStatusMeta,
  canCheckout,
  isRegistrationEditable,
  summariseByRate,
  PARTICIPANT_TYPE_LABELS,
} from '@/lib/events'

// While an invoice is open we re-check the registration on a timer. The gateway
// confirms by webhook, not by the browser redirect — so coming back from the
// payment page proves nothing, and the only honest thing the UI can do is wait
// for the server to say it settled.
const POLL_MS = 5000

export default function RegistrationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { loading, error, data, reload } = useAsync(
    () => api.get(`/registrations/${id}`, { auth: true }),
    [id],
  )

  const [paying, setPaying] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [substituting, setSubstituting] = useState(null)

  const status = data?.status
  const invoiceStatus = data?.invoice?.status

  // Poll only while there's something to wait for. `reload` is a stable useCallback
  // from useAsync, so depending on it directly doesn't restart the timer each render.
  const shouldPoll = status === 'PendingPayment' && invoiceStatus === 'Pending'

  useEffect(() => {
    if (!shouldPoll) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [shouldPoll, reload])

  const pay = useCallback(async () => {
    setPaying(true)
    setActionError(null)
    try {
      const origin = globalThis.location?.origin ?? ''
      const invoice = await api.post(
        `/registrations/${id}/checkout`,
        {
          successRedirectUrl: `${origin}/dashboard/convention/registrations/${id}`,
          failureRedirectUrl: `${origin}/dashboard/convention/registrations/${id}`,
        },
        { auth: true },
      )
      if (invoice.checkoutUrl) {
        globalThis.location.assign(invoice.checkoutUrl)
      } else {
        reload()
      }
    } catch (err) {
      setActionError(err)
      setPaying(false)
    }
  }, [id, reload])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const reg = data
  const meta = registrationStatusMeta(reg.status)
  const editable = isRegistrationEditable(reg.status)
  const rateLines = summariseByRate(reg.delegates)
  const activeDelegates = reg.delegates.filter((d) => d.status !== 'Cancelled')

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Convention registration</span>
          <h1 className="dash-h1">{reg.referenceCode}</h1>
          <p className="dash-sub">
            {reg.lguName || reg.organizationName || reg.contact.name}
            {/* The API stores the region enum's name; show the human label. */}
            {reg.lguRegion && ` · ${labelFor(REGIONS, reg.lguRegion)}`}
          </p>
        </div>
        <span className={`dash-badge tone-${meta.tone} rd-status`}>
          <i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.label}
        </span>
      </div>

      {reg.status === 'Confirmed' && (
        <div className="dash-banner rd-banner-ok">
          <i className="fas fa-circle-check" aria-hidden="true" />
          <span>
            {reg.isComplimentary
              ? <>Issued complimentary by the Secretariat{reg.compReason ? ` — ${reg.compReason}` : ''}.</>
              : <>Confirmed on {formatDate(reg.confirmedAt)}. Each delegate’s reference code below is their check-in code.</>}
          </span>
        </div>
      )}

      {shouldPoll && (
        <div className="dash-banner rd-banner-wait">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          <span>
            Waiting for payment confirmation. This updates by itself once the gateway confirms —
            you can safely close this page and come back.
          </span>
        </div>
      )}

      {actionError && (
        <div className="dash-banner rd-banner-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{actionError.message}</span>
        </div>
      )}

      <div className="rd-grid">
        <div>
          {/* ---- Delegates ---- */}
          <div className="dash-card dash-card-pad rd-card">
            <h2 className="dash-card-title">
              Delegates
              <span className="rd-count">
                {reg.inPersonCount > 0 && `${reg.inPersonCount} in person`}
                {reg.inPersonCount > 0 && reg.virtualCount > 0 && ' · '}
                {reg.virtualCount > 0 && `${reg.virtualCount} online`}
              </span>
            </h2>

            <div className="rd-delegates">
              {reg.delegates.map((d) => {
                const dm = modeMeta(d.attendanceMode)
                const ds = delegateStatusMeta(d.status)
                const cancelled = d.status === 'Cancelled'
                return (
                  <div key={d.id} className={`rd-del${cancelled ? ' is-cancelled' : ''}`}>
                    <div className="rd-del-main">
                      <div className="rd-del-name">
                        {d.fullName}
                        {d.substitutedFromName && (
                          <span className="rd-del-sub" title={`Replaced ${d.substitutedFromName}`}>
                            <i className="fas fa-right-left" aria-hidden="true" /> replaced {d.substitutedFromName}
                          </span>
                        )}
                      </div>
                      <div className="rd-del-meta">
                        {d.designation}
                        {d.participantType !== 'Delegate' && ` · ${PARTICIPANT_TYPE_LABELS[d.participantType] || d.participantType}`}
                      </div>
                      <div className="rd-del-contact">{d.email} · {d.mobile}</div>
                    </div>

                    <div className="rd-del-side">
                      <span className={`dash-badge tone-${dm.tone}`}>
                        <i className={`fas ${dm.icon}`} aria-hidden="true" /> {dm.label}
                      </span>
                      <span className="rd-del-amount">{formatPeso(d.amount)}</span>
                      {reg.status === 'Confirmed' && !cancelled && (
                        <code className="rd-del-code" title="Check-in / access code">{d.referenceCode}</code>
                      )}
                      {d.status !== 'Registered' && (
                        <span className={`dash-badge tone-${ds.tone}`}>
                          <i className={`fas ${ds.icon}`} aria-hidden="true" /> {ds.label}
                        </span>
                      )}
                      {/* Substitution stays available after payment — LGUs swap people
                          days out, and the seat is already paid for. */}
                      {!cancelled && d.status !== 'CheckedIn' && (
                        <button type="button" className="rd-del-swap" onClick={() => setSubstituting(d)}>
                          <i className="fas fa-right-left" aria-hidden="true" /> Substitute
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {editable && (
              <p className="dash-help rd-editable-note">
                You can still add or remove delegates until you pay.
              </p>
            )}
          </div>

          {/* ---- Contact & billing ---- */}
          <div className="dash-card dash-card-pad rd-card">
            <h2 className="dash-card-title">Contact &amp; billing</h2>
            <dl className="rd-dl">
              <div><dt>Contact</dt><dd>{reg.contact.name} — {reg.contact.designation}</dd></div>
              <div><dt>Email</dt><dd>{reg.contact.email}</dd></div>
              <div><dt>Mobile</dt><dd>{reg.contact.mobile}{reg.contact.landline ? ` · ${reg.contact.landline}` : ''}</dd></div>
              <div><dt>Payer</dt><dd>{reg.billing.billingName} ({reg.billing.payerType})</dd></div>
              {reg.billing.tin && <div><dt>TIN</dt><dd>{reg.billing.tin}</dd></div>}
              {reg.billing.purchaseOrderNo && <div><dt>PO / voucher</dt><dd>{reg.billing.purchaseOrderNo}</dd></div>}
              <div><dt>Official receipt</dt><dd>{reg.billing.needsOfficialReceipt ? 'Required' : 'Not required'}</dd></div>
            </dl>
            {reg.notes && <p className="rd-notes">{reg.notes}</p>}
          </div>
        </div>

        {/* ---- Payment summary ---- */}
        <aside>
          <div className="dash-card dash-card-pad rd-pay">
            <h2 className="dash-card-title">Payment</h2>

            <table className="rd-lines">
              <tbody>
                {rateLines.map((line) => (
                  <tr key={line.rateCode}>
                    <td>
                      <span className="rd-line-mode">{modeMeta(line.attendanceMode).label}</span>
                      <span className="rd-line-qty">{formatPeso(line.unitAmount)} × {line.quantity}</span>
                    </td>
                    <td className="rd-line-total">{formatPeso(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="rd-line-total">{formatPeso(reg.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="rd-inclusive">All amounts are inclusive of fees — nothing is added at checkout.</p>

            {reg.invoice && (
              <dl className="rd-invoice">
                <div>
                  <dt>Invoice</dt>
                  <dd>
                    {reg.invoice.referenceCode}
                    {' '}
                    <span className={`dash-badge tone-${invoiceStatusMeta(reg.invoice.status).tone}`}>
                      {invoiceStatusMeta(reg.invoice.status).label}
                    </span>
                  </dd>
                </div>
                {reg.invoice.paidAt && <div><dt>Paid</dt><dd>{formatDate(reg.invoice.paidAt, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>}
                {reg.invoice.receiptNo && <div><dt>Receipt no.</dt><dd>{reg.invoice.receiptNo}</dd></div>}
                {reg.invoice.dueAt && reg.invoice.status === 'Pending' && (
                  <div><dt>Pay before</dt><dd>{formatDate(reg.invoice.dueAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>
                )}
              </dl>
            )}

            {canCheckout(reg.status) && (
              <button className="dash-btn is-primary rd-pay-btn" onClick={pay} disabled={paying || activeDelegates.length === 0}>
                {paying
                  ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Opening…</>
                  : <><i className="fas fa-credit-card" aria-hidden="true" /> {reg.status === 'PendingPayment' ? 'Continue to payment' : 'Pay now'}</>}
              </button>
            )}

            {editable && (
              <button
                className="dash-btn rd-cancel"
                onClick={async () => {
                  setActionError(null)
                  try {
                    await api.post(`/registrations/${reg.id}/cancel`, undefined, { auth: true })
                    navigate('/dashboard/convention')
                  } catch (err) { setActionError(err) }
                }}
              >
                Cancel this registration
              </button>
            )}
          </div>
        </aside>
      </div>

      {substituting && (
        <SubstituteModal
          delegate={substituting}
          registrationId={reg.id}
          onClose={() => setSubstituting(null)}
          onDone={() => { setSubstituting(null); reload() }}
        />
      )}

      <style>{`
        .rd-status { align-self: flex-start; }

        .rd-banner-ok, .rd-banner-wait, .rd-banner-error {
          display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
          padding: 12px 16px; border-radius: 10px; font-size: 0.86rem;
        }
        .rd-banner-ok { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }
        .rd-banner-wait { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }
        .rd-banner-error { background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C; }

        .rd-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; }
        .rd-card { margin-bottom: 16px; }
        .rd-count { float: right; font-size: 0.78rem; font-weight: 600; color: var(--gray-600); }

        .rd-delegates { display: flex; flex-direction: column; }
        .rd-del { display: flex; gap: 16px; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--gray-200); }
        .rd-del:last-child { border-bottom: none; }
        .rd-del.is-cancelled { opacity: 0.5; }
        .rd-del.is-cancelled .rd-del-name { text-decoration: line-through; }
        .rd-del-main { min-width: 0; }
        .rd-del-name { font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
        .rd-del-sub { margin-left: 8px; font-family: var(--font-body, inherit); font-size: 0.72rem; font-weight: 600; color: var(--gray-500, #6B7280); }
        .rd-del-meta { font-size: 0.82rem; color: var(--gray-600); margin-top: 2px; }
        .rd-del-contact { font-size: 0.76rem; color: var(--gray-500, #6B7280); margin-top: 2px; }
        .rd-del-side { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; flex-shrink: 0; }
        .rd-del-amount { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-size: 0.9rem; }
        .rd-del-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem;
          padding: 3px 8px; border-radius: 6px; background: var(--gray-100, #F3F4F6);
          border: 1px solid var(--gray-200); color: var(--navy); letter-spacing: 0.04em;
        }
        .rd-del-swap {
          border: none; background: none; cursor: pointer; color: var(--gray-600);
          font-size: 0.76rem; font-weight: 700; padding: 4px 6px; border-radius: 6px;
        }
        .rd-del-swap:hover { background: var(--gray-100, #F3F4F6); color: var(--navy); }
        .rd-editable-note { margin-top: 12px; }

        .rd-dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px 20px; margin: 0; }
        .rd-dl dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gray-500, #6B7280); font-weight: 700; }
        .rd-dl dd { margin: 2px 0 0; font-size: 0.86rem; color: var(--navy); }
        .rd-notes { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--gray-200); font-size: 0.84rem; color: var(--gray-600); }

        .rd-pay { position: sticky; top: 18px; }
        .rd-lines { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .rd-lines td { padding: 8px 0; vertical-align: top; }
        .rd-lines tbody tr { border-bottom: 1px solid var(--gray-200); }
        .rd-line-mode { display: block; font-weight: 700; color: var(--navy); }
        .rd-line-qty { display: block; font-size: 0.76rem; color: var(--gray-600); }
        .rd-line-total { text-align: right; font-family: var(--font-heading); font-weight: 800; color: var(--navy); white-space: nowrap; }
        .rd-lines tfoot td { padding-top: 12px; font-family: var(--font-heading); font-weight: 800; color: var(--navy); }
        .rd-inclusive { font-size: 0.72rem; color: var(--gray-500, #6B7280); font-style: italic; margin: 8px 0 0; }

        .rd-invoice { margin: 16px 0 0; padding-top: 14px; border-top: 1px solid var(--gray-200); display: grid; gap: 10px; }
        .rd-invoice dt { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gray-500, #6B7280); font-weight: 700; }
        .rd-invoice dd { margin: 2px 0 0; font-size: 0.82rem; color: var(--navy); }

        .rd-pay-btn { width: 100%; justify-content: center; margin-top: 16px; }
        .rd-cancel { width: 100%; justify-content: center; margin-top: 8px; color: #B91C1C; }

        @media (max-width: 900px) {
          .rd-grid { grid-template-columns: 1fr; }
          .rd-pay { position: static; }
        }
        @media (max-width: 640px) {
          .rd-del { flex-direction: column; }
          .rd-del-side { justify-content: flex-start; }
        }
      `}</style>
    </>
  )
}

/**
 * Replace a delegate in place. The reference code, attendance mode, and amount
 * all stay with the seat — only the person changes.
 */
function SubstituteModal({ delegate, registrationId, onClose, onDone }) {
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', suffix: '',
    badgeName: '', designation: delegate.designation || '',
    officeDepartment: delegate.officeDepartment || '', email: '', mobile: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })) }

  async function save() {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'First name is required.'
    if (!form.lastName.trim()) e.lastName = 'Last name is required.'
    if (!form.designation.trim()) e.designation = 'Designation is required.'
    const emailErr = validateEmail(form.email)
    if (emailErr) e.email = emailErr
    if (!form.mobile.trim()) e.mobile = 'Mobile number is required.'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSaving(true)
    try {
      await api.put(
        `/registrations/${registrationId}/delegates/${delegate.id}`,
        {
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || null,
          lastName: form.lastName.trim(),
          suffix: form.suffix.trim() || null,
          badgeName: form.badgeName.trim() || null,
          designation: form.designation.trim(),
          officeDepartment: form.officeDepartment.trim() || null,
          email: form.email.trim(),
          mobile: form.mobile.trim(),
        },
        { auth: true },
      )
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setErrors(Object.fromEntries(
          Object.entries(err.fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]),
        ))
      } else {
        setErrors({ firstName: err.message })
      }
      setSaving(false)
    }
  }

  return (
    <Modal title={`Substitute ${delegate.fullName}`} onClose={onClose}>
      <p className="dash-help" style={{ marginBottom: 14 }}>
        The seat, its amount, and the reference code <code>{delegate.referenceCode}</code> stay as they
        are — only the person attending changes.
      </p>

      <div className="dash-form-row">
        <Field label="First name" htmlFor="sFirst" required error={errors.firstName}>
          <input id="sFirst" className={ctl('dash-input', errors.firstName)} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="sLast" required error={errors.lastName}>
          <input id="sLast" className={ctl('dash-input', errors.lastName)} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
      </div>
      <Field label="Designation" htmlFor="sDesig" required error={errors.designation}>
        <input id="sDesig" className={ctl('dash-input', errors.designation)} value={form.designation} onChange={(e) => set('designation', e.target.value)} />
      </Field>
      <div className="dash-form-row">
        <Field label="Email" htmlFor="sEmail" required error={errors.email}>
          <input id="sEmail" type="email" className={ctl('dash-input', errors.email)} value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Mobile" htmlFor="sMobile" required error={errors.mobile}>
          <input id="sMobile" className={ctl('dash-input', errors.mobile)} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button type="button" className="dash-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="dash-btn is-primary" onClick={save} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : 'Substitute'}
        </button>
      </div>
    </Modal>
  )
}

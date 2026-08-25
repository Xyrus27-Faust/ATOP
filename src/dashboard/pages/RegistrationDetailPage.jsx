import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { Field, ctl } from '../components/form'
import Modal from '../components/Modal'
import DelegateFields, { emptyDelegate, validateDelegate, toDelegatePayload } from '../components/DelegateFields'
import SeatQr from '../components/SeatQr'
import SeatPassModal from '../components/SeatPassModal'
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
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [passFor, setPassFor] = useState(null)
  // Which seats this payment is for, and whether each is being settled or merely reserved. Paying
  // is per delegate now, so the page has to carry a choice per delegate rather than one for all.
  const [selected, setSelected] = useState(null)   // null = "everyone who still owes", set on first edit
  const [modes, setModes] = useState({})
  const [amountError, setAmountError] = useState(null)

  const status = data?.status
  const invoiceStatus = data?.invoice?.status

  // Poll only while there's something to wait for. `reload` is a stable useCallback
  // from useAsync, so depending on it directly doesn't restart the timer each render.
  const shouldPoll = invoiceStatus === 'Pending' && data?.balance > 0

  useEffect(() => {
    if (!shouldPoll) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [shouldPoll, reload])

  const pay = useCallback(async (payments) => {
    setPaying(true)
    setActionError(null)
    try {
      const origin = globalThis.location?.origin ?? ''
      const invoice = await api.post(
        `/registrations/${id}/checkout`,
        {
          payments,
          successRedirectUrl: `${origin}/convention/registrations/${id}`,
          failureRedirectUrl: `${origin}/convention/registrations/${id}`,
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

  // Seats that still owe something are the only ones that can be paid for.
  const owing = activeDelegates.filter((d) => Number(d.balance) > 0)
  const chosen = selected ?? owing.map((d) => d.id)

  // A seat that has already had its downpayment can only settle: one partial, then the rest. The
  // server enforces this; offering the choice anyway would be offering a refusal.
  const modeFor = (seat) => (Number(seat.amountPaid) > 0 ? 'Full' : modes[seat.id] ?? 'Full')
  const chargeFor = (seat) =>
    modeFor(seat) === 'Downpayment' ? Math.min(seat.downpaymentAmount, seat.balance) : Number(seat.balance)

  const payingNow = owing.filter((d) => chosen.includes(d.id)).reduce((sum, d) => sum + chargeFor(d), 0)

  const toggleSeat = (id) =>
    setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])

  function startPayment() {
    if (chosen.length === 0) return setAmountError('Choose at least one delegate to pay for.')
    setAmountError(null)
    return pay(owing.filter((d) => chosen.includes(d.id)).map((d) => ({ delegateId: d.id, mode: modeFor(d) })))
  }

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
        {reg.balance > 0 && reg.amountPaid > 0 && (
          <span className="dash-badge tone-warn rd-status">
            <i className="fas fa-hourglass-half" aria-hidden="true" /> {formatPeso(reg.balance)} balance due
          </span>
        )}
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
                    <div className="rd-del-top">
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

                      {/* Money gets its own column so it reads down rather than competing across. */}
                      <div className="rd-del-money">
                        <span className="rd-del-amount">{formatPeso(d.amount)}</span>
                        {!cancelled && Number(d.amountPaid) > 0 && Number(d.balance) > 0 && (
                          <span className="rd-del-owing">{formatPeso(d.balance)} due</span>
                        )}
                        {!cancelled && Number(d.balance) <= 0 && (
                          <span className="rd-del-settled"><i className="fas fa-check" aria-hidden="true" /> paid</span>
                        )}
                        {!cancelled && Number(d.amountPaid) === 0 && (
                          <span className="rd-del-unpaid">not paid yet</span>
                        )}
                      </div>

                      {/* The pass. Only a seat somebody has paid for has one. */}
                      {Number(d.amountPaid) > 0 && !cancelled ? (
                        <SeatQr code={d.referenceCode} onOpen={() => setPassFor(d)} />
                      ) : (
                        <div className="rd-del-nopass">no code<br />yet</div>
                      )}
                    </div>

                    {/* The quiet strip: identifiers and actions, out of the way of the numbers. */}
                    <div className="rd-del-foot">
                      {Number(d.amountPaid) > 0 && !cancelled && (
                        <code className="rd-del-code" title="Check-in code">{d.referenceCode}</code>
                      )}
                      <span className={`dash-badge tone-${dm.tone} rd-del-mode`}>
                        <i className={`fas ${dm.icon}`} aria-hidden="true" /> {dm.label}
                      </span>
                      {d.status !== 'Registered' && (
                        <span className={`dash-badge tone-${ds.tone}`}>
                          <i className={`fas ${ds.icon}`} aria-hidden="true" /> {ds.label}
                        </span>
                      )}
                      <span className="rd-del-foot-spacer" />
                      {/* Substitution stays available after payment — LGUs swap people
                          days out, and the seat is already paid for. */}
                      {!cancelled && d.status !== 'CheckedIn' && (
                        <button type="button" className="rd-del-swap" onClick={() => setSubstituting(d)}>
                          <i className="fas fa-right-left" aria-hidden="true" /> Substitute
                        </button>
                      )}
                      {/* Removal only while the booking is unpaid; afterwards the seat is
                          paid for and substitution is the right move instead. */}
                      {editable && !cancelled && activeDelegates.length > 1 && (
                        <button
                          type="button"
                          className="rd-del-remove"
                          disabled={removingId === d.id}
                          onClick={async () => {
                            setActionError(null)
                            setRemovingId(d.id)
                            try {
                              await api.delete(`/registrations/${reg.id}/delegates/${d.id}`, { auth: true })
                              reload()
                            } catch (err) {
                              setActionError(err)
                            } finally {
                              setRemovingId(null)
                            }
                          }}
                        >
                          <i className="fas fa-trash-can" aria-hidden="true" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {editable && (
              <div className="rd-editable">
                <button type="button" className="dash-btn" onClick={() => setAdding(true)}>
                  <i className="fas fa-plus" aria-hidden="true" /> Add delegate
                </button>
                <span className="dash-help">You can add or remove delegates until you pay.</span>
              </div>
            )}
            {!editable && reg.status !== 'Cancelled' && (
              <p className="dash-help rd-editable-note">
                The delegate list is fixed now that this booking has gone to payment. You can still
                substitute who fills a seat.
              </p>
            )}
          </div>

          {/* ---- Contact ---- */}
          <div className="dash-card dash-card-pad rd-card">
            <h2 className="dash-card-title">Contact</h2>
            <dl className="rd-dl">
              <div><dt>Contact</dt><dd>{reg.contact.name} — {reg.contact.designation}</dd></div>
              {reg.contact.office && <div><dt>Office</dt><dd>{reg.contact.office}</dd></div>}
              <div><dt>Email</dt><dd>{reg.contact.email}</dd></div>
              <div><dt>Mobile</dt><dd>{reg.contact.mobile}{reg.contact.landline ? ` · ${reg.contact.landline}` : ''}</dd></div>
              <div><dt>Billed to</dt><dd>{reg.billing.billingName}</dd></div>
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
                {reg.amountPaid > 0 && (
                  <>
                    <tr className="rd-paid">
                      <td>Paid</td>
                      <td className="rd-line-total">− {formatPeso(reg.amountPaid)}</td>
                    </tr>
                    <tr className="rd-balance">
                      <td>Balance</td>
                      <td className="rd-line-total">{formatPeso(reg.balance)}</td>
                    </tr>
                  </>
                )}
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

            {reg.status === 'Draft' && (
              <button
                className="dash-btn rd-pay-btn"
                onClick={() => navigate(`/convention/register/${reg.id}`)}
              >
                <i className="fas fa-pen-to-square" aria-hidden="true" /> Continue registration
              </button>
            )}

            {canCheckout(reg.status, reg.balance) && (
              <>
                {/* Who this payment is for. Each seat settles or reserves on its own terms, so the
                    choice is a list, not a single button — a treasurer paying for two stragglers in
                    November uses exactly the same control as the booking did in August. */}
                <ul className="rd-seats">
                  {owing.map((seat) => {
                    const ticked = chosen.includes(seat.id)
                    const partPaid = Number(seat.amountPaid) > 0
                    return (
                      <li key={seat.id} className={`rd-seat${ticked ? '' : ' is-off'}`}>
                        <label className="rd-seat-head">
                          <input
                            type="checkbox"
                            checked={ticked}
                            onChange={() => toggleSeat(seat.id)}
                          />
                          <span className="rd-seat-name">{seat.fullName}</span>
                          <span className="rd-seat-amount">{ticked ? formatPeso(chargeFor(seat)) : '—'}</span>
                        </label>

                        {partPaid ? (
                          <p className="rd-seat-note">
                            {formatPeso(seat.amountPaid)} received — this settles the {formatPeso(seat.balance)} balance.
                          </p>
                        ) : (
                          <select
                            className="dash-select rd-seat-mode"
                            value={modeFor(seat)}
                            disabled={!ticked}
                            aria-label={`How to pay for ${seat.fullName}`}
                            onChange={(e) => setModes((m) => ({ ...m, [seat.id]: e.target.value }))}
                          >
                            <option value="Full">Pay in full — {formatPeso(seat.balance)}</option>
                            <option value="Downpayment">Reserve — {formatPeso(seat.downpaymentAmount)}</option>
                          </select>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {amountError && (
                  <p className="rd-inclusive rd-seat-error">{amountError}</p>
                )}

                <button
                  className="dash-btn is-primary rd-pay-btn"
                  onClick={startPayment}
                  disabled={paying || activeDelegates.length === 0}
                >
                  {paying
                    ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Opening…</>
                    : (
                      <>
                        <i className="fas fa-credit-card" aria-hidden="true" />
                        {` Pay ${formatPeso(payingNow)}`}
                      </>
                    )}
                </button>
              </>
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

      {passFor && (
        <SeatPassModal delegate={passFor} reference={reg.referenceCode} onClose={() => setPassFor(null)} />
      )}

      {substituting && (
        <SubstituteModal
          delegate={substituting}
          registrationId={reg.id}
          onClose={() => setSubstituting(null)}
          onDone={() => { setSubstituting(null); reload() }}
        />
      )}

      {adding && (
        <AddDelegateModal
          registrationId={reg.id}
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); reload() }}
        />
      )}

      <style>{`
        .rd-status { align-self: flex-start; }
        /* A card per delegate: identity left, money in its own column, the pass on the right, and
           the identifiers and actions on a quiet strip underneath. The old single row put five
           competing things on one line and read as noise. */
        .rd-del { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; }
        .rd-del-top { display: flex; align-items: flex-start; gap: 16px; }
        .rd-del-main { flex: 1; min-width: 0; }
        .rd-del-money { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; white-space: nowrap; }
        .rd-del-nopass {
          width: 104px; height: 104px; flex: 0 0 104px; display: grid; place-items: center;
          border: 1px dashed var(--gray-200); border-radius: var(--radius-sm); background: var(--off-white);
          font-family: var(--font-heading); font-size: 0.68rem; font-weight: 700; color: var(--gray-400);
          text-align: center; line-height: 1.3;
        }
        .rd-del-foot {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding-top: 10px; border-top: 1px solid var(--gray-100);
        }
        .rd-del-foot-spacer { flex: 1; }
        .rd-del-unpaid { font-size: 0.76rem; color: var(--gray-500, #8b97a6); }

        .rd-del-owing { font-size: 0.76rem; font-weight: 700; color: var(--gold-dark); font-variant-numeric: tabular-nums; }
        .rd-del-settled { font-size: 0.76rem; font-weight: 700; color: var(--green-dark, #2f6b46); }

        /* A list, not a table: this lives in a narrow aside, and four columns of anything turn
           into wrapped names and a select with nowhere to render its value. */
        .rd-seats { list-style: none; margin: 14px 0 12px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .rd-seat { padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); background: var(--white); }
        .rd-seat.is-off { opacity: 0.5; }
        .rd-seat-head { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .rd-seat-name { flex: 1; font-family: var(--font-heading); font-weight: 700; font-size: 0.88rem; color: var(--navy); }
        .rd-seat-amount { font-family: var(--font-heading); font-weight: 800; color: var(--navy); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .rd-seat-note { margin: 6px 0 0; font-size: 0.78rem; color: var(--gray-600); }
        .rd-seat-mode { margin-top: 8px; width: 100%; padding: 5px 8px; font-size: 0.82rem; }
        .rd-seat-error { color: var(--danger, #a03328); margin-bottom: 8px; }

        .rd-pay-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0 12px; }
        .rd-pay-opt {
          display: flex; flex-direction: column; gap: 2px; text-align: left; cursor: pointer;
          padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
          background: var(--white); transition: var(--transition-fast);
        }
        .rd-pay-opt:hover { border-color: var(--gold); }
        .rd-pay-opt.is-active { border-color: var(--navy); box-shadow: inset 0 0 0 1px var(--navy); background: var(--off-white); }
        .rd-pay-opt-top { font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; color: var(--gray-600); }
        .rd-pay-opt-amount { font-family: var(--font-heading); font-size: 1rem; font-weight: 800; color: var(--navy); font-variant-numeric: tabular-nums; }

        .rd-balance-note { margin-top: 10px; }
        .rd-paid td { color: var(--gray-600); font-weight: 500; }
        .rd-balance td { color: var(--navy); font-family: var(--font-heading); font-weight: 800; }

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
        .rd-del-remove {
          border: none; background: none; cursor: pointer; color: #B91C1C;
          font-size: 0.76rem; font-weight: 700; padding: 4px 6px; border-radius: 6px;
        }
        .rd-del-remove:hover:not(:disabled) { background: #FEF2F2; }
        .rd-del-remove:disabled { opacity: 0.5; cursor: default; }
        .rd-editable { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 16px; }
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
 * Add a delegate to an existing unpaid booking. Uses the same field set as the booking
 * form, so the required fields and the RA 10173 consent wording can't drift apart.
 *
 * Fetches the event for its rates — the detail response carries each delegate's rate
 * *code*, but not the catalogue you'd pick a new one from.
 */
function AddDelegateModal({ registrationId, onClose, onDone }) {
  const [value, setValue] = useState(emptyDelegate)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const { loading, error, data } = useAsync(() => api.get('/events/'), [])

  const rates = data?.[0]?.rates ?? []

  const onChange = (field, v) => {
    setValue((prev) => ({ ...prev, [field]: v }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function save() {
    const e = validateDelegate(value, '', validateEmail)
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSaving(true)
    try {
      await api.post(`/registrations/${registrationId}/delegates`, toDelegatePayload(value), { auth: true })
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setErrors(Object.fromEntries(
          Object.entries(err.fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]),
        ))
      } else {
        setErrors({ rateCode: err.message })
      }
      setSaving(false)
    }
  }

  return (
    <Modal title="Add a delegate" onClose={onClose}>
      <div className="rd-add-form">
        {loading && <p className="dash-help">Loading registration types…</p>}
        {error && <p className="dash-error">Couldn’t load the registration types.</p>}

        {!loading && !error && (
          <DelegateFields
            value={value}
            rates={rates}
            errors={errors}
            idPrefix="add"
            onChange={onChange}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="dash-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="dash-btn is-primary" onClick={save} disabled={saving || loading}>
            {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Adding…</> : 'Add delegate'}
          </button>
        </div>
      </div>

      {/* The dialog is far narrower than the booking card, so the shared two- and
          four-column rows would be unusable at this width.

          The modal centres itself with no max-height, so this full field set is taller
          than the viewport and pushes its own title and buttons off-screen. Scroll the
          body rather than the page, so the header stays put and Add stays reachable. */}
      <style>{`
        .rd-add-form .dash-form-row { grid-template-columns: 1fr; gap: 18px; }
        .rd-add-form { max-height: min(68vh, 620px); overflow-y: auto; padding-right: 4px; }
      `}</style>
    </Modal>
  )
}

/**
 * One delegate's pass, big enough to scan off the screen and downloadable for the day the venue
 * has no signal. The image is redrawn at print size rather than scaled up from the thumbnail — a
 * QR blown up from 104px is a QR a scanner argues with.
 */
/**
 * Replace a delegate in place. The reference code, attendance mode, and amount
 * all stay with the seat — only the person changes.
 */
function SubstituteModal({ delegate, registrationId, onClose, onDone }) {
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', suffix: '',
    designation: delegate.designation || '',
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
      <div className="rd-sub-form">
      <p className="dash-help" style={{ marginBottom: 16 }}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button type="button" className="dash-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="dash-btn is-primary" onClick={save} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : 'Substitute'}
        </button>
      </div>
      </div>

      {/* Same vertical rhythm as the booking form — the shared field primitives carry no
          outer margin, so stacked controls would otherwise sit flush. */}
      <style>{`
        .rd-sub-form .dash-field, .rd-sub-form .dash-form-row { margin-bottom: 18px; }
        .rd-sub-form .dash-form-row .dash-field { margin-bottom: 0; }
      `}</style>
    </Modal>
  )
}

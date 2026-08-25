import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import SeatQr from '../components/SeatQr'
import SeatPassModal from '../components/SeatPassModal'
import { formatDate } from '@/lib/pearlAwards'
import {
  formatPeso,
  modeMeta,
  registrationStatusMeta,
  delegateStatusMeta,
  invoiceStatusMeta,
  PARTICIPANT_TYPE_LABELS,
} from '@/lib/events'

/**
 * One booking, whole, for the Secretariat.
 *
 * Deliberately read-only. The delegate's own page owns editing, and its endpoints are scoped to
 * the owner — an edit control here would be a button that always 403s. What the desk actually
 * needs is to *see*: who is coming, what they paid, and the pass each seat is entitled to.
 */
export default function AdminRegistrationDetailPage() {
  const { id } = useParams()
  const [showing, setShowing] = useState(null)

  const { loading, error, data, reload } = useAsync(async () => {
    // The admin route is nested under its event, and the list page resolves the event the same
    // way: there is one published convention at a time.
    const events = await api.get('/events/')
    const event = events[0]
    if (!event) return { event: null, reg: null }
    const reg = await api.get(`/admin/events/${event.id}/registrations/${id}`, { auth: true })
    return { event, reg }
  }, [id])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { reg } = data
  if (!reg) {
    return (
      <div className="dash-card dash-empty">
        <div className="dash-empty-icon"><i className="fas fa-inbox" aria-hidden="true" /></div>
        <h3>Registration not found</h3>
        <p>It may have been removed, or it belongs to another event.</p>
      </div>
    )
  }

  const meta = registrationStatusMeta(reg.status)
  const live = (reg.delegates || []).filter((d) => d.status !== 'Cancelled')
  const cancelledSeats = (reg.delegates || []).filter((d) => d.status === 'Cancelled')

  return (
    <>
      <div className="dash-page-head">
        <div>
          <Link to="/dashboard/admin/registrations" className="ard-back">
            <i className="fas fa-chevron-left" aria-hidden="true" /> Registrations
          </Link>
          <h1 className="dash-h1">{reg.referenceCode}</h1>
        </div>
        <span className={`dash-badge tone-${meta.tone}`}>
          <i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.label}
        </span>
      </div>

      {/* Money first: it is the question the desk is usually answering. */}
      <div className="dash-card ard-money">
        <Money label="Total" value={formatPeso(reg.totalAmount)} />
        <Money label="Received" value={formatPeso(reg.amountPaid)} tone="good" />
        <Money
          label="Outstanding"
          value={formatPeso(reg.balance)}
          tone={Number(reg.balance) > 0 ? 'warn' : 'good'}
        />
        {Number(reg.overpaid) > 0 && (
          <Money label="Overpaid" value={formatPeso(reg.overpaid)} tone="warn" />
        )}
        {reg.isComplimentary && <Money label="Complimentary" value={reg.compReason || 'Issued by the Secretariat'} />}
      </div>

      <div className="ard-cols">
        <section className="dash-card ard-block">
          <h2 className="ard-h2">Contact</h2>
          <Row label="Name" value={reg.contact?.name} />
          <Row label="Designation" value={reg.contact?.designation} />
          <Row label="Office" value={reg.contact?.office} />
          <Row label="Email" value={reg.contact?.email} />
          <Row label="Mobile" value={reg.contact?.mobile} />
          <Row label="Landline" value={reg.contact?.landline} />
        </section>

        <section className="dash-card ard-block">
          <h2 className="ard-h2">Registrant</h2>
          <Row label="Type" value={reg.registrantType} />
          <Row label="LGU" value={reg.lguName} />
          <Row label="Region" value={reg.lguRegion} />
          <Row label="Organization" value={reg.organizationName} />
          <Row label="Created" value={formatDate(reg.createdAt)} />
          <Row label="Confirmed" value={reg.confirmedAt ? formatDate(reg.confirmedAt) : null} />
        </section>

        <section className="dash-card ard-block">
          <h2 className="ard-h2">Billing</h2>
          <Row label="Payer" value={reg.billing?.payerType} />
          <Row label="Billed to" value={reg.billing?.billingName} />
          <Row label="TIN" value={reg.billing?.tin} />
          <Row label="Address" value={reg.billing?.billingAddress} />
          <Row label="Official receipt" value={reg.billing?.needsOfficialReceipt ? 'Required' : 'Not required'} />
          <Row label="PO number" value={reg.billing?.purchaseOrderNo} />
        </section>
      </div>

      {reg.invoice && (
        <section className="dash-card ard-block">
          <h2 className="ard-h2">Payment</h2>
          <Row label="Invoice" value={reg.invoice.referenceCode} />
          <Row label="Status" value={invoiceStatusMeta(reg.invoice.status).label} />
          <Row label="Amount" value={formatPeso(reg.invoice.total)} />
          <Row label="Settled" value={reg.invoice.paidAt ? formatDate(reg.invoice.paidAt) : null} />
          <Row label="Receipt no." value={reg.invoice.receiptNo} />
          <Row label="Due" value={reg.invoice.dueAt ? formatDate(reg.invoice.dueAt) : null} />
        </section>
      )}

      {reg.notes && (
        <section className="dash-card ard-block">
          <h2 className="ard-h2">Notes</h2>
          <p className="ard-notes">{reg.notes}</p>
        </section>
      )}

      <section className="ard-delegates">
        <h2 className="ard-h2 ard-h2-loud">
          Delegates <span className="ard-count">{live.length}</span>
        </h2>

        <div className="ard-grid">
          {live.map((d) => {
            const dm = modeMeta(d.attendanceMode)
            const ds = delegateStatusMeta(d.status)
            const paid = Number(d.amountPaid) > 0
            return (
              <article key={d.id} className="dash-card ard-del">
                <div className="ard-del-head">
                  <div>
                    <h3 className="ard-del-name">{d.fullName}</h3>
                    <p className="ard-del-role">
                      {d.designation}
                      {d.officeDepartment ? ` · ${d.officeDepartment}` : ''}
                    </p>
                    <p className="ard-del-org">{d.lguName || d.organizationName || '—'}</p>
                  </div>

                  {/* The pass, where a seat has one. Same rule as the delegate's own page: a seat
                      nobody has paid for would hand the door something that will not scan. */}
                  {paid ? (
                    <button type="button" className="ard-del-qr" onClick={() => setShowing(d)} title="Open pass">
                      <SeatQr code={d.referenceCode} size={96} />
                    </button>
                  ) : (
                    <div className="ard-del-nopass">no pass<br />yet</div>
                  )}
                </div>

                <dl className="ard-del-facts">
                  <Fact label="Reference" value={paid ? d.referenceCode : '—'} mono />
                  <Fact label="Email" value={d.email} />
                  <Fact label="Mobile" value={d.mobile} />
                  <Fact label="Participant" value={PARTICIPANT_TYPE_LABELS[d.participantType] || d.participantType} />
                  <Fact label="Seat" value={formatPeso(d.amount)} />
                  <Fact label="Paid" value={formatPeso(d.amountPaid)} />
                  <Fact label="Due" value={formatPeso(d.balance)} />
                  {d.substitutedFromName && <Fact label="Replaced" value={d.substitutedFromName} />}
                  {d.checkedInAt && <Fact label="Checked in" value={formatDate(d.checkedInAt)} />}
                </dl>

                <div className="ard-del-foot">
                  <span className={`dash-badge tone-${dm.tone}`}>
                    <i className={`fas ${dm.icon}`} aria-hidden="true" /> {dm.label}
                  </span>
                  <span className={`dash-badge tone-${ds.tone}`}>{ds.label}</span>
                </div>
              </article>
            )
          })}
        </div>

        {cancelledSeats.length > 0 && (
          <p className="ard-cancelled">
            {cancelledSeats.length} cancelled {cancelledSeats.length === 1 ? 'seat' : 'seats'}:{' '}
            {cancelledSeats.map((d) => d.fullName).join(', ')}
          </p>
        )}
      </section>

      {showing && (
        <SeatPassModal delegate={showing} reference={reg.referenceCode} onClose={() => setShowing(null)} />
      )}

      <style>{`
        .ard-back {
          display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase; color: var(--gray-600); text-decoration: none;
        }
        .ard-back:hover { color: var(--navy); }

        .ard-money { display: flex; flex-wrap: wrap; gap: 28px; padding: 16px 20px; margin-bottom: 16px; }
        .ard-money-item { display: flex; flex-direction: column; gap: 2px; }
        .ard-money-label {
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase; color: var(--gray-500, #6B7280);
        }
        .ard-money-value { font-size: 1.05rem; font-weight: 800; color: var(--navy); font-variant-numeric: tabular-nums; }
        .ard-money-value.is-good { color: var(--green-700, #15803d); }
        .ard-money-value.is-warn { color: var(--amber-700, #b45309); }

        .ard-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .ard-block { padding: 16px 20px; }
        .ard-h2 {
          margin: 0 0 10px; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--gray-500, #6B7280);
        }
        .ard-h2-loud { font-size: 0.9rem; color: var(--navy); }
        .ard-count {
          display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 999px;
          background: var(--gray-100, #F3F4F6); font-size: 0.8rem; color: var(--gray-600);
        }
        .ard-row { display: flex; gap: 10px; padding: 4px 0; font-size: 0.86rem; }
        .ard-row-label { flex: 0 0 40%; color: var(--gray-500, #6B7280); }
        .ard-row-value { flex: 1; color: var(--navy); word-break: break-word; }
        .ard-notes { margin: 0; font-size: 0.88rem; color: var(--navy); white-space: pre-wrap; }

        .ard-delegates { margin-top: 22px; }
        .ard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
        .ard-del { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
        .ard-del-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .ard-del-name { margin: 0; font-size: 1rem; font-weight: 800; color: var(--navy); }
        .ard-del-role { margin: 2px 0 0; font-size: 0.8rem; color: var(--gray-600); }
        .ard-del-org { margin: 2px 0 0; font-size: 0.78rem; color: var(--gray-500, #6B7280); }
        .ard-del-qr { padding: 0; border: 0; background: none; cursor: pointer; line-height: 0; }
        .ard-del-nopass {
          flex-shrink: 0; width: 96px; height: 96px; display: flex; align-items: center; justify-content: center;
          border: 1px dashed var(--gray-300, #D1D5DB); border-radius: 10px; text-align: center;
          font-size: 0.72rem; color: var(--gray-500, #6B7280);
        }
        .ard-del-facts { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0; font-size: 0.82rem; }
        .ard-del-facts dt { color: var(--gray-500, #6B7280); }
        .ard-del-facts dd { margin: 0; color: var(--navy); word-break: break-word; }
        .ard-del-facts dd.is-mono {
          font-family: var(--font-heading); letter-spacing: 0.05em; font-variant-numeric: tabular-nums;
        }
        .ard-del-foot { display: flex; flex-wrap: wrap; gap: 6px; }
        .ard-cancelled { margin: 14px 0 0; font-size: 0.82rem; color: var(--gray-600); }
      `}</style>
    </>
  )
}

function Money({ label, value, tone }) {
  return (
    <div className="ard-money-item">
      <span className="ard-money-label">{label}</span>
      <span className={`ard-money-value${tone ? ` is-${tone}` : ''}`}>{value}</span>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="ard-row">
      <span className="ard-row-label">{label}</span>
      <span className="ard-row-value">{value || '—'}</span>
    </div>
  )
}

function Fact({ label, value, mono }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? 'is-mono' : undefined}>{value || '—'}</dd>
    </>
  )
}

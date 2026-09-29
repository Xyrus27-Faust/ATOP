import { useState } from 'react'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import IdPhotoCropper from './IdPhotoCropper'

/**
 * ID photos, per delegate, on the booking page.
 *
 * <p>Like the tours and meals cards, this is a checklist rather than a form: the person reading it
 * is usually the LGU focal point who booked for five other people and is collecting their photos
 * over Viber. What it has to answer at a glance is "who have I still not done?", so an outstanding
 * count sits in the heading and every delegate gets a row whether or not they have sent anything.</p>
 *
 * <p>Fetches its own roster for the same reason its siblings do — the registration payload knows
 * nothing about photos, and the parent polls every five seconds while an invoice is open.</p>
 */
export default function IdPhotoCard({ registrationId }) {
  const { data, loading, error, reload } = useAsync(
    () => api.get(`/registrations/${registrationId}/photos`, { auth: true }),
    [registrationId],
  )

  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [actionError, setActionError] = useState(null)

  if (error && !data) {
    return (
      <div className="dash-card dash-card-pad rd-card" id="id-photo">
        <h2 className="dash-card-title">Convention ID photo</h2>
        <p className="dash-help">{error.message || 'We couldn’t load the ID photos just now.'}</p>
        <button type="button" className="dash-btn" onClick={reload}>
          <i className="fas fa-rotate-right" aria-hidden="true" /> Try again
        </button>
        <style>{ipcStyles}</style>
      </div>
    )
  }

  // Keyed on `data`, not `loading`: useAsync keeps the last payload across a reload, and blinking
  // the card out every time someone uploads would pull it from under the cursor.
  if (loading && !data) {
    return (
      <div className="dash-card dash-card-pad rd-card" id="id-photo">
        <h2 className="dash-card-title">Convention ID photo</h2>
        <p className="dash-help" role="status" aria-live="polite">
          <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Loading…
        </p>
        <style>{ipcStyles}</style>
      </div>
    )
  }

  if (!data || data.delegates.length === 0) return null

  const eligible = data.delegates.filter((d) => d.canUpload)
  if (eligible.length === 0) return null

  const outstanding = eligible.filter((d) => d.status !== 'Submitted').length

  async function remove(delegateId) {
    setActionError(null)
    setRemoving(delegateId)
    try {
      await api.delete(`/registrations/${registrationId}/delegates/${delegateId}/photo`, { auth: true })
      reload()
    } catch (err) {
      setActionError(err)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="dash-card dash-card-pad rd-card" id="id-photo">
      <h2 className="dash-card-title">
        Convention ID photo
        {outstanding > 0 && <span className="ipc-todo">{outstanding} still to send</span>}
      </h2>

      <p className="dash-help ipc-intro">
        Each delegate’s ID is printed with their photo. Use a clear head-and-shoulders shot of just
        that person — it is cropped to a square for the card.
      </p>

      {actionError && (
        <div className="ipc-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" />
          <span>{actionError.message}</span>
        </div>
      )}

      <div className="ipc-rows">
        {data.delegates.map((d) => (
          <div key={d.delegateId} className={`ipc-row${d.canUpload ? '' : ' is-off'}`}>
            <div className="ipc-thumb">
              {d.url
                ? <img src={d.url} alt={`ID photo for ${d.fullName}`} />
                : <i className="fas fa-user" aria-hidden="true" />}
            </div>

            <div className="ipc-who">
              <span className="ipc-name">{d.fullName}</span>
              {!d.canUpload && <span className="ipc-why">{d.ineligibleReason}</span>}
              {d.canUpload && d.status === 'Rejected' && (
                <span className="ipc-rejected">
                  <i className="fas fa-triangle-exclamation" aria-hidden="true" />
                  {d.rejectionReason || 'The secretariat asked for a different photo.'}
                </span>
              )}
              {d.canUpload && d.status === 'None' && (
                <span className="ipc-why">No photo yet</span>
              )}
            </div>

            {d.canUpload && (
              <div className="ipc-actions">
                <button
                  type="button"
                  className="dash-btn ipc-btn"
                  onClick={() => setEditing(d)}
                  disabled={removing === d.delegateId}
                >
                  {d.status === 'Submitted' ? 'Replace' : 'Add photo'}
                </button>
                {d.status !== 'None' && (
                  <button
                    type="button"
                    className="ipc-remove"
                    onClick={() => remove(d.delegateId)}
                    disabled={removing === d.delegateId}
                    aria-label={`Remove the photo for ${d.fullName}`}
                  >
                    <i className={removing === d.delegateId ? 'fas fa-spinner fa-spin' : 'fas fa-trash'} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <IdPhotoCropper
          registrationId={registrationId}
          delegate={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}

      <style>{ipcStyles}</style>
    </div>
  )
}

const ipcStyles = `
  .ipc-intro { margin-bottom: 14px; }
  .ipc-todo { font-size: 0.72rem; font-weight: 700; color: #a35c00; background: #fff3e0; padding: 3px 8px; border-radius: 999px; margin-left: 8px; }
  .ipc-error { display: flex; gap: 8px; align-items: flex-start; background: #fdeaea; color: #8a1c1c; border-radius: 8px; padding: 10px 12px; font-size: 0.85rem; margin-bottom: 12px; }

  .ipc-rows { display: grid; gap: 8px; }
  .ipc-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-lg); }
  .ipc-row.is-off { background: var(--gray-50, #fafbfc); }

  .ipc-thumb { width: 44px; height: 44px; border-radius: 8px; overflow: hidden; background: var(--gray-100, #f1f3f7); display: grid; place-items: center; color: var(--gray-400, #9aa3b2); flex: none; }
  .ipc-thumb img { width: 100%; height: 100%; object-fit: cover; }

  .ipc-name { display: block; font-weight: 600; color: var(--navy); font-size: 0.88rem; }
  .ipc-why { display: block; color: var(--gray-600); font-size: 0.76rem; line-height: 1.4; margin-top: 3px; }
  .ipc-rejected { display: flex; gap: 6px; align-items: flex-start; color: #a35c00; font-size: 0.76rem; line-height: 1.4; margin-top: 3px; }

  .ipc-actions { display: flex; align-items: center; gap: 6px; }
  .ipc-btn { font-size: 0.8rem; padding: 6px 12px; }
  .ipc-remove { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--gray-200); border-radius: 8px; background: none; color: var(--gray-600); cursor: pointer; }
  .ipc-remove:hover:not(:disabled) { border-color: #c0392b; color: #c0392b; }
  .ipc-remove:disabled { opacity: 0.6; cursor: default; }

  @media (max-width: 640px) {
    .ipc-row { grid-template-columns: auto minmax(0, 1fr); }
    .ipc-actions { grid-column: 1 / -1; justify-content: flex-end; }
  }
`

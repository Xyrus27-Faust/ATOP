import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMarshals, searchUsers, grantMarshal, revokeMarshal } from '@/lib/checkin'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'

// Long enough that typing a name sends one request, not one per letter.
const DEBOUNCE_MS = 300
const SEARCH_MIN_CHARS = 2

/**
 * Who may scan badges. An admin credits an existing account with the Marshal role here — guards
 * don't request it — and takes it away the same way.
 *
 * <p>Search and the list sit on one page rather than behind an "Add" dialog: on convention morning
 * the admin is adding guard after guard, and each one should land in the list below as it's done.</p>
 */
export default function MarshalAdminPage() {
  const { loading, error, data: marshals, reload } = useAsync(listMarshals, [])
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function change(user, grant) {
    setBusyId(user.userId)
    setActionError(null)
    try {
      await (grant ? grantMarshal(user.userId) : revokeMarshal(user.userId))
      await reload()
    } catch (e) {
      setActionError(e?.message || 'That didn’t go through. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const marshalIds = new Set((marshals || []).map((m) => m.userId))

  return (
    <>
      <div className="dash-page-head">
        <div>
          <Link to="/dashboard/admin/checkpoints" className="dash-btn is-ghost is-sm mr-back">
            <i className="fas fa-arrow-left" aria-hidden="true" /> Checkpoints
          </Link>
          <span className="dash-eyebrow">Admin · Check-in</span>
          <h1 className="dash-h1">Marshals</h1>
          <p className="dash-sub">
            Marshals scan badges at the doors and meals. Find the guard’s account and make them a marshal —
            they need to have signed up first.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="dash-banner tone-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{actionError}</span>
        </div>
      )}

      <section className="dash-card dash-card-pad mr-add">
        <h2 className="dash-card-title"><i className="fas fa-user-plus" aria-hidden="true" /> Add a marshal</h2>
        <AddMarshal marshalIds={marshalIds} busyId={busyId} onGrant={(u) => change(u, true)} />
        <p className="dash-help mr-foot">
          A new marshal signs out and back in, then lands straight on the scanner.
        </p>
      </section>

      <h2 className="mr-h2">
        Current marshals {marshals && <span className="mr-count">{marshals.length}</span>}
      </h2>
      {loading && !marshals ? (
        <Loading />
      ) : error && !marshals ? (
        <ErrorState error={error} onRetry={reload} />
      ) : marshals.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-qrcode" aria-hidden="true" /></div>
          <h3>No marshals yet</h3>
          <p>Search for a guard’s account above to add the first one.</p>
        </div>
      ) : (
        <>
          <ul className="dash-card mr-list">
            {marshals.map((m) => (
              <li key={m.userId} className="mr-row">
                <span className="mr-id">
                  <strong>{m.fullName || m.email}</strong>
                  <span>{m.email}</span>
                </span>
                <button
                  type="button"
                  className="dash-btn is-sm is-ghost"
                  disabled={busyId === m.userId}
                  onClick={() => change(m, false)}
                >
                  {busyId === m.userId ? 'Working…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
          <p className="dash-help mr-foot">
            Removing someone stops their scanning within 15 minutes, when their current sign-in renews.
          </p>
        </>
      )}

      <style>{MR_CSS}</style>
    </>
  )
}

function AddMarshal({ marshalIds, busyId, onGrant }) {
  const [q, setQ] = useState('')
  // The last answer, tagged with the term it answers — an answer for another term is stale.
  const [answer, setAnswer] = useState({ term: null, rows: null, error: null })
  const term = q.trim()
  const searchable = term.length >= SEARCH_MIN_CHARS

  useEffect(() => {
    if (!searchable) return undefined
    let active = true
    const t = setTimeout(() => {
      searchUsers(term).then(
        (rows) => { if (active) setAnswer({ term, rows, error: null }) },
        (error) => { if (active) setAnswer({ term, rows: null, error }) },
      )
    }, DEBOUNCE_MS)
    return () => { active = false; clearTimeout(t) }
  }, [term, searchable])

  const current = searchable && answer.term === term

  return (
    <>
      <div className="mr-search">
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          className="dash-input"
          type="search"
          autoComplete="off"
          placeholder="Name or email"
          aria-label="Search accounts by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div aria-live="polite">
        {searchable && !current && <p className="mr-note">Searching…</p>}
        {current && answer.error && <p className="mr-note">{answer.error.message}</p>}
        {current && answer.rows?.length === 0 && (
          <p className="mr-note">No account matches “{term}”. The guard needs to sign up first.</p>
        )}
        {current && answer.rows?.length > 0 && (
          <ul className="mr-results">
            {answer.rows.map((u) => (
              <li key={u.userId} className="mr-row">
                <span className="mr-id">
                  <strong>{u.fullName || u.email}</strong>
                  <span>{u.email}</span>
                </span>
                {marshalIds.has(u.userId) ? (
                  <span className="dash-badge tone-success">Marshal</span>
                ) : (
                  <button
                    type="button"
                    className="dash-btn is-sm is-primary"
                    disabled={busyId === u.userId}
                    onClick={() => onGrant(u)}
                  >
                    {busyId === u.userId ? 'Working…' : 'Make marshal'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

const MR_CSS = `
  .dash-btn.mr-back { display: flex; width: fit-content; margin-bottom: 12px; }
  .mr-add { margin-bottom: 8px; }
  .mr-search { position: relative; margin-top: 12px; }
  .mr-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
  .mr-search .dash-input { padding-left: 36px; min-height: 44px; }
  .mr-note { color: var(--gray-600); font-size: 0.86rem; padding: 10px 2px 0; }
  .mr-foot { margin-top: 12px; }
  .mr-results { list-style: none; margin: 8px 0 0; padding: 0; }
  .mr-h2 {
    display: flex; align-items: center; gap: 10px; margin: 26px 0 12px;
    font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy);
  }
  .mr-count {
    display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px;
    font-size: 0.78rem; font-weight: 800; color: var(--gold-dark);
    background: rgba(200,168,75,0.14); border: 1px solid rgba(200,168,75,0.28);
  }
  .mr-list { list-style: none; margin: 0; padding: 0 16px; }
  .mr-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
  .mr-row + .mr-row { border-top: 1px solid var(--gray-100); }
  .mr-row .dash-btn { flex-shrink: 0; min-height: 40px; }
  .mr-id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .mr-id strong {
    font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mr-id span { color: var(--gray-600); font-size: 0.84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`

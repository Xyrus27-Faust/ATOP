import { useEffect, useState } from 'react'
import { listStaff, searchUsers, grantStaffRole, revokeStaffRole } from '@/lib/checkin'
import { useAsync } from '../../useAsync'
import { Loading, ErrorState } from '../states'

// Long enough that typing a name sends one request, not one per letter.
const DEBOUNCE_MS = 300
const SEARCH_MIN_CHARS = 2

// What each role is for, said where the admin hands it out. The two read side by side on purpose:
// a marshal scans and sees nothing else, the secretariat sees the money and everyone's contact details.
const ROLES = {
  Marshal: {
    noun: 'marshal',
    plural: 'Marshals',
    icon: 'fa-qrcode',
    can: 'Scan badges at sessions, meals and tour buses — nothing else. No money, no registration list.',
    added: 'A new marshal signs out and back in, then lands straight on the scanner.',
    removeWarning: null,
  },
  Secretariat: {
    noun: 'secretariat',
    plural: 'Secretariat',
    icon: 'fa-id-card',
    can: 'Run the Secretariat desk — check-in, cash for balances, ID and kit — and work the registration list, '
      + 'with every delegate’s contact details. Give it to the desk staff only.',
    added: 'They sign out and back in, then find Secretariat Desk in their sidebar.',
    // The same role reviews Pearl Awards entries in its assigned categories: taking it away for the
    // desk takes that away too, and the admin should know before the tap, not after.
    removeWarning: 'They lose the desk and the registration list — and Pearl Awards review, if they review entries.',
  },
}

/**
 * Who holds one convention staff role: find an existing account and give it the role, or take it
 * away. Search and the list share the screen — on convention morning the admin adds person after
 * person, and each should land in the list as it's done.
 */
export default function StaffRoster({ role }) {
  const meta = ROLES[role]
  const { loading, error, data: staff, reload } = useAsync(() => listStaff(role), [role])
  const [busyId, setBusyId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function change(user, grant) {
    setBusyId(user.userId)
    setActionError(null)
    try {
      await (grant ? grantStaffRole(user.userId, role) : revokeStaffRole(user.userId, role))
      setConfirmId(null)
      await reload()
    } catch (e) {
      setActionError(e?.message || 'That didn’t go through. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const remove = (user) => {
    if (meta.removeWarning && confirmId !== user.userId) {
      setConfirmId(user.userId)
      return
    }
    change(user, false)
  }

  const staffIds = new Set((staff || []).map((m) => m.userId))

  return (
    <>
      <p className="dash-help sr-can"><i className={`fas ${meta.icon}`} aria-hidden="true" /> {meta.can}</p>

      {actionError && (
        <div className="dash-banner tone-error">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> <span>{actionError}</span>
        </div>
      )}

      <section className="dash-card dash-card-pad sr-add">
        <h2 className="dash-card-title"><i className="fas fa-user-plus" aria-hidden="true" /> Add {meta.noun}</h2>
        <AddStaff role={role} noun={meta.noun} staffIds={staffIds} busyId={busyId} onGrant={(u) => change(u, true)} />
        <p className="dash-help sr-foot">{meta.added} They need to have signed up first.</p>
      </section>

      <h2 className="sr-h2">
        Current {meta.plural.toLowerCase()} {staff && <span className="sr-count">{staff.length}</span>}
      </h2>
      {loading && !staff ? (
        <Loading />
      ) : error && !staff ? (
        <ErrorState error={error} onRetry={reload} />
      ) : staff.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className={`fas ${meta.icon}`} aria-hidden="true" /></div>
          <h3>No {meta.plural.toLowerCase()} yet</h3>
          <p>Search for an account above to add the first one.</p>
        </div>
      ) : (
        <>
          <ul className="dash-card sr-list">
            {staff.map((m) => (
              <li key={m.userId} className="sr-row">
                <span className="sr-id">
                  <strong>{m.fullName || m.email}</strong>
                  <span>{m.email}</span>
                  {confirmId === m.userId && <span className="sr-warn">{meta.removeWarning}</span>}
                </span>
                <span className="sr-acts">
                  {confirmId === m.userId && (
                    <button type="button" className="dash-btn is-sm is-ghost" disabled={busyId === m.userId} onClick={() => setConfirmId(null)}>
                      Keep
                    </button>
                  )}
                  <button
                    type="button"
                    className={`dash-btn is-sm ${confirmId === m.userId ? 'is-danger' : 'is-ghost'}`}
                    disabled={busyId === m.userId}
                    onClick={() => remove(m)}
                  >
                    {busyId === m.userId ? 'Working…' : confirmId === m.userId ? 'Yes, remove' : 'Remove'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="dash-help sr-foot">
            Removing someone takes effect within 15 minutes, when their current sign-in runs out.
          </p>
        </>
      )}

      <style>{SR_CSS}</style>
    </>
  )
}

function AddStaff({ role, noun, staffIds, busyId, onGrant }) {
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
      <div className="sr-search">
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
        {searchable && !current && <p className="sr-note">Searching…</p>}
        {current && answer.error && <p className="sr-note">{answer.error.message}</p>}
        {current && answer.rows?.length === 0 && (
          <p className="sr-note">No account matches “{term}”. They need to sign up first.</p>
        )}
        {current && answer.rows?.length > 0 && (
          <ul className="sr-results">
            {answer.rows.map((u) => (
              <li key={u.userId} className="sr-row">
                <span className="sr-id">
                  <strong>{u.fullName || u.email}</strong>
                  <span>{u.email}</span>
                </span>
                {staffIds.has(u.userId) || u.roles?.includes(role) ? (
                  <span className="dash-badge tone-success">{role}</span>
                ) : (
                  <button
                    type="button"
                    className="dash-btn is-sm is-primary"
                    disabled={busyId === u.userId}
                    onClick={() => onGrant(u)}
                  >
                    {busyId === u.userId ? 'Working…' : `Make ${noun}`}
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

const SR_CSS = `
  .sr-can { display: flex; gap: 8px; align-items: baseline; margin: 16px 0; line-height: 1.55; }
  .sr-can i { color: var(--gold-dark); }
  .sr-add { margin-bottom: 8px; }
  .sr-search { position: relative; margin-top: 12px; }
  .sr-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
  .sr-search .dash-input { padding-left: 36px; min-height: 44px; }
  .sr-note { color: var(--gray-600); font-size: 0.86rem; padding: 10px 2px 0; }
  .sr-foot { margin-top: 12px; }
  .sr-results { list-style: none; margin: 8px 0 0; padding: 0; }
  .sr-h2 {
    display: flex; align-items: center; gap: 10px; margin: 26px 0 12px;
    font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy);
  }
  .sr-count {
    display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px;
    font-size: 0.78rem; font-weight: 800; color: var(--gold-dark);
    background: rgba(200,168,75,0.14); border: 1px solid rgba(200,168,75,0.28);
  }
  .sr-list { list-style: none; margin: 0; padding: 0 16px; }
  .sr-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
  .sr-row + .sr-row { border-top: 1px solid var(--gray-100); }
  .sr-row .dash-btn { flex-shrink: 0; min-height: 40px; }
  .sr-acts { display: flex; gap: 8px; flex-shrink: 0; }
  .sr-id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .sr-id strong {
    font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sr-id span { color: var(--gray-600); font-size: 0.84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sr-id .sr-warn { color: var(--bad); white-space: normal; margin-top: 4px; }
`

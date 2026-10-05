import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'

const ROLE = 'RegistrationAdmin'

function initialsOf(name, email) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ra-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="ra-modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ra-modal-head">
          <h3 className="ra-modal-title">{title}</h3>
          <button type="button" className="ra-modal-x" onClick={onClose} aria-label="Close">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="ra-modal-body">{children}</div>
      </div>
    </div>
  )
}

// Search any account and grant or revoke the role in place.
function AddRegistrationAdmin({ onChanged }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const t = setTimeout(() => {
      setLoading(true)
      api.get(`/admin/users?q=${encodeURIComponent(term)}`, { auth: true })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  async function toggle(u, grant) {
    setBusy(u.userId)
    setError(null)
    try {
      const updated = grant
        ? await api.post(`/admin/users/${u.userId}/roles`, { role: ROLE }, { auth: true })
        : await api.delete(`/admin/users/${u.userId}/roles/${ROLE}`, { auth: true })
      setResults((rs) => rs.map((r) => (r.userId === u.userId ? updated : r)))
      onChanged()
    } catch (e) {
      setError(e?.message || 'Could not change the role. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const term = q.trim()
  return (
    <>
      <p className="ra-hint">
        The person needs an account first — they can sign up or sign in with Google. The role takes effect the
        next time they sign in.
      </p>
      <div className="ra-search">
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          className="dash-input"
          type="search"
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users"
          autoFocus
        />
      </div>

      {error && (
        <div className="dash-banner tone-error ra-err">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> {error}
        </div>
      )}

      {term.length < 2 ? (
        <p className="ra-note">Type at least two characters to search.</p>
      ) : loading ? (
        <p className="ra-note"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Searching…</p>
      ) : results.length === 0 ? (
        <p className="ra-note">No users match “{term}”.</p>
      ) : (
        <ul className="ra-results">
          {results.map((u) => {
            const has = (u.roles || []).includes(ROLE)
            return (
              <li key={u.userId} className="ra-result">
                <span className="ra-avatar" aria-hidden="true">{initialsOf(u.fullName, u.email)}</span>
                <span className="ra-id">
                  <span className="ra-name">{u.fullName || u.email}</span>
                  <span className="ra-email">{u.email}</span>
                </span>
                <button
                  type="button"
                  className={`dash-btn is-sm${has ? ' is-ghost' : ' is-primary'}`}
                  disabled={busy === u.userId}
                  onClick={() => toggle(u, !has)}
                >
                  {busy === u.userId
                    ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> …</>
                    : has
                      ? <><i className="fas fa-user-minus" aria-hidden="true" /> Remove</>
                      : <><i className="fas fa-user-plus" aria-hidden="true" /> Make registration admin</>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/**
 * Who works the registration desk. A Registration Admin sees Registrations and Tallies and nothing
 * else (ATOP, 2026-10-05) — no Pearl Awards, no event settings. Admin-only, behind AdminRoute.
 */
export default function RegistrationAdminsPage() {
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(null)
  const [removeError, setRemoveError] = useState(null)

  const { loading, error, data: list, reload } = useAsync(
    () => api.get(`/admin/users?role=${ROLE}`, { auth: true }),
    [],
  )

  if (loading && !list) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  async function remove(u) {
    setBusy(u.userId)
    setRemoveError(null)
    try {
      await api.delete(`/admin/users/${u.userId}/roles/${ROLE}`, { auth: true })
      await reload()
    } catch (e) {
      setRemoveError(e?.message || 'Could not remove the role. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Admin · Registration Admins</span>
          <h1 className="dash-h1">Registration admins</h1>
          <p className="dash-sub">
            Registration admins work the convention registration desk: they see <strong>Registrations</strong> and{' '}
            <strong>Tallies</strong>, and nothing else — no Pearl Awards and no event settings.
          </p>
        </div>
        <button type="button" className="dash-btn is-primary" onClick={() => setAdding(true)}>
          <i className="fas fa-user-plus" aria-hidden="true" /> Add registration admin
        </button>
      </div>

      {removeError && (
        <div className="dash-banner tone-error ra-err">
          <i className="fas fa-circle-exclamation" aria-hidden="true" /> {removeError}
        </div>
      )}

      {list.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-id-card-clip" aria-hidden="true" /></div>
          <h3>No registration admins yet</h3>
          <p>Use <strong>Add registration admin</strong> to give someone access to the registration desk.</p>
          <button type="button" className="dash-btn is-primary" onClick={() => setAdding(true)}>
            <i className="fas fa-user-plus" aria-hidden="true" /> Add registration admin
          </button>
        </div>
      ) : (
        <div className="dash-card ra-tablecard">
          <ul className="ra-list">
            {list.map((u) => (
              <li key={u.userId} className="ra-row">
                <span className="ra-avatar" aria-hidden="true">{initialsOf(u.fullName, u.email)}</span>
                <span className="ra-id">
                  <span className="ra-name">{u.fullName || u.email}</span>
                  <span className="ra-email">{u.email}</span>
                </span>
                <button
                  type="button"
                  className="dash-btn is-sm is-ghost"
                  disabled={busy === u.userId}
                  onClick={() => remove(u)}
                >
                  {busy === u.userId
                    ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Removing…</>
                    : <><i className="fas fa-user-minus" aria-hidden="true" /> Remove</>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adding && (
        <Modal title="Add a registration admin" onClose={() => { setAdding(false); reload() }}>
          <AddRegistrationAdmin onChanged={reload} />
        </Modal>
      )}

      <style>{`
        .ra-tablecard { padding: 0; overflow: hidden; }
        .ra-list { list-style: none; margin: 0; padding: 0; }
        .ra-row { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--gray-100); }
        .ra-row:last-child { border-bottom: none; }
        .ra-row .dash-btn { margin-left: auto; flex-shrink: 0; }
        .ra-avatar { width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-heading); font-weight: 800; font-size: 0.78rem; color: var(--navy); background: linear-gradient(135deg, var(--gold-light), var(--gold)); }
        .ra-id { display: flex; flex-direction: column; min-width: 0; }
        .ra-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; }
        .ra-email { color: var(--gray-600); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; }
        .ra-err { margin-bottom: 14px; }

        .ra-modal { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 20px; background: rgba(15,25,46,0.55); backdrop-filter: blur(2px); }
        .ra-modal-card { width: 100%; max-width: 560px; max-height: 86vh; display: flex; flex-direction: column; background: var(--white); border-radius: var(--radius-md); box-shadow: 0 30px 70px rgba(15,25,46,0.4); overflow: hidden; }
        .ra-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 24px 14px; border-bottom: 1px solid var(--gray-100); }
        .ra-modal-title { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; color: var(--navy); }
        .ra-modal-x { background: none; border: none; cursor: pointer; color: var(--gray-400); font-size: 1.05rem; padding: 4px 8px; border-radius: 6px; line-height: 1; }
        .ra-modal-x:hover { color: var(--navy); background: var(--gray-100); }
        .ra-modal-body { padding: 18px 24px; overflow-y: auto; }

        .ra-hint { font-size: 0.84rem; color: var(--gray-600); line-height: 1.55; margin-bottom: 14px; }
        .ra-search { position: relative; margin-bottom: 12px; }
        .ra-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .ra-search .dash-input { padding-left: 36px; }
        .ra-note { font-size: 0.84rem; color: var(--gray-600); padding: 10px 2px; }
        .ra-results { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .ra-result { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
        .ra-result .dash-btn { margin-left: auto; flex-shrink: 0; }

        @media (max-width: 640px) {
          .ra-row, .ra-result { flex-wrap: wrap; }
        }
      `}</style>
    </>
  )
}

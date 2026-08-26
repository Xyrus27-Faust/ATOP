import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'

function initialsOf(name, email) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function Modal({ title, sub, onClose, busy, children, foot }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="aa-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="aa-modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="aa-modal-head">
          <div>
            <h3 className="aa-modal-title">{title}</h3>
            {sub && <p className="aa-modal-sub">{sub}</p>}
          </div>
          <button type="button" className="aa-modal-x" onClick={onClose} disabled={busy} aria-label="Close">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="aa-modal-body">{children}</div>
        {foot && <div className="aa-modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

// Search any user and grant/revoke the 3PIC role. Without this, an admin could only assign
// categories to assessors who already existed — there'd be no way to create one in the app.
function AddAssessor({ onChanged }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(null)

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
    try {
      const updated = grant
        ? await api.post(`/admin/users/${u.userId}/roles`, { role: '3PIC' }, { auth: true })
        : await api.delete(`/admin/users/${u.userId}/roles/3PIC`, { auth: true })
      setResults((rs) => rs.map((r) => (r.userId === u.userId ? updated : r)))
      onChanged()
    } catch {
      // a transient failure leaves the row unchanged; the admin can retry
    } finally {
      setBusy(null)
    }
  }

  const term = q.trim()
  return (
    <>
      <p className="aa-hint">
        Assessors are appointed, not self-service — grant the 3PIC role here. They keep their existing roles,
        and see an empty scoring queue until you assign them categories. The role takes effect on their next
        sign-in.
      </p>
      <div className="aa-search">
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

      {term.length < 2 ? (
        <p className="aa-searchnote">Type at least two characters to search.</p>
      ) : loading ? (
        <p className="aa-searchnote"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Searching…</p>
      ) : results.length === 0 ? (
        <p className="aa-searchnote">No users match “{term}”.</p>
      ) : (
        <ul className="aa-results">
          {results.map((u) => {
            const has = (u.roles || []).includes('3PIC')
            return (
              <li key={u.userId} className="aa-result">
                <span className="aa-avatar" aria-hidden="true">{initialsOf(u.fullName, u.email)}</span>
                <span className="aa-id">
                  <span className="aa-name">{u.fullName || u.email}</span>
                  <span className="aa-email">{u.email}</span>
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
                      : <><i className="fas fa-user-plus" aria-hidden="true" /> Make assessor</>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// Admin management of 3PIC assessor ↔ award-category assignments. A tabular roster (better for
// scanning than cards); Edit opens a focused modal for the category checklist.
export default function AssessorAdminPage() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(null) // userId being assigned
  const [draft, setDraft] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [adding, setAdding] = useState(false)

  const { loading, error, data, reload } = useAsync(
    () =>
      Promise.all([api.get('/admin/assessors', { auth: true }), api.get('/award-categories/')]).then(
        ([list, catalog]) => ({ list, catalog }),
      ),
    [],
  )

  const close = () => { if (!saving) setEditing(null) }

  if (!isAdmin(user?.roles)) return <Navigate to="/dashboard" replace />
  // Only blank the page on the *first* load. A reload() after granting a role also flips `loading`,
  // and swapping in <Loading /> there would unmount the open modal and wipe the admin's search.
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { list, catalog } = data
  const categories = catalog.categories
  const nameByNumber = new Map(categories.map((c) => [c.number, c.name]))
  const editRow = list.find((r) => r.userId === editing) || null

  function startEdit(r) {
    setEditing(r.userId)
    setDraft(new Set(r.categoryNumbers))
    setSaveError(null)
  }
  function toggle(n) {
    setDraft((d) => {
      const next = new Set(d)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }
  async function save(r) {
    setSaving(true)
    setSaveError(null)
    try {
      await api.put(`/admin/assessors/${r.userId}/categories`, { categoryNumbers: [...draft] }, { auth: true })
      setEditing(null)
      await reload()
    } catch (e) {
      setSaveError(e?.message || 'Could not save assignments. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Admin · Assessors</span>
          <h1 className="dash-h1">Assessor assignments</h1>
          <p className="dash-sub">
            Assign award categories to each 3PIC assessor. An assessor only sees and scores entries in their
            assigned categories; an unassigned assessor sees an empty scoring queue. Aim for a consistent panel
            of ~5 assessors per category so the average is meaningful.
          </p>
        </div>
        <button type="button" className="dash-btn is-primary" onClick={() => setAdding(true)}>
          <i className="fas fa-user-plus" aria-hidden="true" /> Add assessor
        </button>
      </div>

      {list.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-user-check" aria-hidden="true" /></div>
          <h3>No assessors yet</h3>
          <p>Use <strong>Add assessor</strong> to grant the 3PIC role, then assign the categories they’ll score.</p>
          <button type="button" className="dash-btn is-primary" onClick={() => setAdding(true)}>
            <i className="fas fa-user-plus" aria-hidden="true" /> Add assessor
          </button>
        </div>
      ) : (
        <div className="dash-card aa-tablecard">
          <div className="aa-scroll">
            <table className="aa-table">
              <thead>
                <tr>
                  <th>Assessor</th>
                  <th>Roles</th>
                  <th>Assigned categories</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const roles = r.roles.filter((x) => x !== 'Applicant')
                  return (
                    <tr key={r.userId} className="aa-row">
                      <td className="aa-who">
                        <span className="aa-avatar" aria-hidden="true">{initialsOf(r.fullName, r.email)}</span>
                        <span className="aa-id">
                          <span className="aa-name">{r.fullName || r.email}</span>
                          <span className="aa-email">{r.email}</span>
                        </span>
                      </td>
                      <td className="aa-rolescell">
                        {roles.map((role) => <span key={role} className="aa-role">{role}</span>)}
                      </td>
                      <td className="aa-cats">
                        {r.categoryNumbers.length === 0 ? (
                          <span className="aa-none"><i className="fas fa-circle-info" aria-hidden="true" /> None — empty queue</span>
                        ) : (
                          <span className="aa-chips">
                            {r.categoryNumbers.map((n) => (
                              <span key={n} className="aa-chip"><span className="aa-chip-n">#{n}</span> {nameByNumber.get(n) || `Category ${n}`}</span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="aa-actioncell">
                        <button type="button" className="dash-btn is-sm" onClick={() => startEdit(r)}>
                          <i className="fas fa-pen" aria-hidden="true" /> Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adding && (
        <Modal title="Add an assessor" onClose={() => { setAdding(false); reload() }}>
          <AddAssessor onChanged={reload} />
        </Modal>
      )}

      {editRow && (
        <Modal
          title="Assign categories"
          sub={editRow.fullName || editRow.email}
          onClose={close}
          busy={saving}
          foot={
            <>
              <span className="aa-selected">{draft.size} of {categories.length} selected</span>
              <button type="button" className="dash-btn is-ghost is-sm" onClick={close} disabled={saving}>Cancel</button>
              <button type="button" className="dash-btn is-primary is-sm" onClick={() => save(editRow)} disabled={saving}>
                {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : 'Save assignments'}
              </button>
            </>
          }
        >
          <div className="aa-grid">
            {categories.map((c) => {
              const on = draft.has(c.number)
              return (
                <label key={c.number} className={`aa-check${on ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(c.number)} />
                  <span className="aa-num">#{c.number}</span>
                  <span className="aa-cname">{c.name}</span>
                </label>
              )
            })}
          </div>
          {saveError && (
            <div className="dash-banner tone-error aa-modal-err">
              <i className="fas fa-circle-exclamation" aria-hidden="true" /> {saveError}
            </div>
          )}
        </Modal>
      )}

      <style>{`
        .aa-tablecard { padding: 0; overflow: hidden; }
        .aa-scroll { overflow-x: auto; }
        .aa-table { width: 100%; border-collapse: collapse; }
        .aa-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 12px 18px; text-align: left; white-space: nowrap; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
        .aa-table td { padding: 13px 18px; vertical-align: middle; border-bottom: 1px solid var(--gray-100); }
        .aa-table tbody tr:last-child td { border-bottom: none; }
        .aa-row:hover { background: rgba(200,168,75,0.05); }

        .aa-who { display: flex; align-items: center; gap: 12px; min-width: 220px; }
        .aa-avatar { width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-heading); font-weight: 800; font-size: 0.78rem; color: var(--navy); background: linear-gradient(135deg, var(--gold-light), var(--gold)); }
        .aa-id { display: flex; flex-direction: column; min-width: 0; }
        .aa-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; }
        .aa-email { color: var(--gray-600); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; }
        .aa-rolescell { white-space: nowrap; }
        .aa-role { display: inline-block; font-family: var(--font-heading); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.3); padding: 3px 8px; border-radius: 999px; }

        .aa-cats { min-width: 340px; }
        .aa-chips { display: flex; flex-wrap: wrap; gap: 5px; }
        .aa-chip { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 600; line-height: 1.5; color: var(--navy); background: rgba(200,168,75,0.1); border: 1px solid rgba(200,168,75,0.28); padding: 3px 9px; border-radius: 999px; white-space: nowrap; cursor: default; }
        .aa-chip-n { font-weight: 800; color: var(--gold-dark); }
        .aa-none { display: inline-flex; align-items: center; gap: 7px; color: var(--gray-600); font-size: 0.84rem; font-style: italic; }
        .aa-actioncell { text-align: right; white-space: nowrap; }

        /* Assign modal (matches the app's ed-modal) */
        .aa-modal { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 20px; background: rgba(15,25,46,0.55); backdrop-filter: blur(2px); animation: aa-modal-in 0.16s ease-out; }
        @keyframes aa-modal-in { from { opacity: 0; } to { opacity: 1; } }
        .aa-modal-card { width: 100%; max-width: 660px; max-height: 86vh; display: flex; flex-direction: column; background: var(--white); border-radius: var(--radius-md); box-shadow: 0 30px 70px rgba(15,25,46,0.4); overflow: hidden; }
        .aa-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 24px 14px; border-bottom: 1px solid var(--gray-100); }
        .aa-modal-title { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; color: var(--navy); }
        .aa-modal-sub { color: var(--gray-600); font-size: 0.84rem; margin-top: 2px; }
        .aa-modal-x { background: none; border: none; cursor: pointer; color: var(--gray-400); font-size: 1.05rem; padding: 4px 8px; border-radius: 6px; line-height: 1; }
        .aa-modal-x:hover:not(:disabled) { color: var(--navy); background: var(--gray-100); }
        .aa-modal-body { padding: 18px 24px; overflow-y: auto; }
        .aa-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
        .aa-check { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition-fast); background: var(--white); }
        .aa-check:hover { border-color: var(--gold); }
        .aa-check.is-on { border-color: var(--gold); background: rgba(200,168,75,0.1); }
        .aa-check input { width: 17px; height: 17px; accent-color: var(--gold-dark); cursor: pointer; flex-shrink: 0; }
        .aa-num { font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); flex-shrink: 0; }
        .aa-cname { font-family: var(--font-body); font-size: 0.84rem; color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .aa-modal-err { margin-top: 14px; }
        .aa-modal-foot { display: flex; align-items: center; gap: 12px; padding: 14px 24px; border-top: 1px solid var(--gray-100); background: var(--off-white); }
        .aa-selected { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gray-600); margin-right: auto; }

        /* Add-assessor search */
        .aa-hint { font-size: 0.84rem; color: var(--gray-600); line-height: 1.55; margin-bottom: 14px; }
        .aa-search { position: relative; margin-bottom: 12px; }
        .aa-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .aa-search .dash-input { padding-left: 36px; }
        .aa-searchnote { font-size: 0.84rem; color: var(--gray-600); padding: 10px 2px; }
        .aa-results { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .aa-result { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
        .aa-result .dash-btn { margin-left: auto; flex-shrink: 0; }

        @media (max-width: 640px) { .aa-chips { display: none; } }
      `}</style>
    </>
  )
}

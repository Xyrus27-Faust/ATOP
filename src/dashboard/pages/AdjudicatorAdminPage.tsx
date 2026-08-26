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

function Modal({ title, sub, onClose, children, foot }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ja-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="ja-modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ja-modal-head">
          <div>
            <h3 className="ja-modal-title">{title}</h3>
            {sub && <p className="ja-modal-sub">{sub}</p>}
          </div>
          <button type="button" className="ja-modal-x" onClick={onClose} aria-label="Close">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="ja-modal-body">{children}</div>
        {foot && <div className="ja-modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

// Search any user and grant/revoke the Adjudicator role. Without this, an admin could only assign
// categories to adjudicators who already existed — there'd be no way to create one in the app.
function AddAdjudicator({ onChanged }) {
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
        ? await api.post(`/admin/users/${u.userId}/roles`, { role: 'Adjudicator' }, { auth: true })
        : await api.delete(`/admin/users/${u.userId}/roles/Adjudicator`, { auth: true })
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
      <p className="ja-hint">
        Adjudicators are appointed, not self-service — grant the role here. They keep their existing roles, and
        see nothing in Finals until you assign them categories.
      </p>
      <div className="ja-search">
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
        <p className="ja-searchnote">Type at least two characters to search.</p>
      ) : loading ? (
        <p className="ja-searchnote"><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Searching…</p>
      ) : results.length === 0 ? (
        <p className="ja-searchnote">No users match “{term}”.</p>
      ) : (
        <ul className="ja-results">
          {results.map((u) => {
            const has = (u.roles || []).includes('Adjudicator')
            return (
              <li key={u.userId} className="ja-result">
                <span className="ja-avatar" aria-hidden="true">{initialsOf(u.fullName, u.email)}</span>
                <span className="ja-id">
                  <span className="ja-name">{u.fullName || u.email}</span>
                  <span className="ja-email">{u.email}</span>
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
                      : <><i className="fas fa-user-plus" aria-hidden="true" /> Make adjudicator</>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// Admin management of the finals panel: who is an adjudicator, and which categories they rank.
export default function AdjudicatorAdminPage() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(null) // userId whose categories are being assigned
  const [draft, setDraft] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [adding, setAdding] = useState(false)

  const { loading, error, data, reload } = useAsync(
    () =>
      Promise.all([api.get('/admin/adjudicators', { auth: true }), api.get('/award-categories/')]).then(
        ([list, catalog]) => ({ list, catalog }),
      ),
    [],
  )

  if (!isAdmin(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
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
      await api.put(`/admin/adjudicators/${r.userId}/categories`, { categoryNumbers: [...draft] }, { auth: true })
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
          <span className="dash-eyebrow">Admin · Adjudicators</span>
          <h1 className="dash-h1">Adjudicator panel</h1>
          <p className="dash-sub">
            Adjudicators rank the finalists in the final round — a separate panel from the 3PIC assessors who
            score pre-finals. Assign each one the categories they’ll judge; an unassigned adjudicator sees an
            empty Finals queue. Every assigned adjudicator must submit a ranking before a category can be finalized.
          </p>
        </div>
        <button type="button" className="dash-btn is-primary" onClick={() => setAdding(true)}>
          <i className="fas fa-user-plus" aria-hidden="true" /> Add adjudicator
        </button>
      </div>

      {list.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-user-tie" aria-hidden="true" /></div>
          <h3>No adjudicators yet</h3>
          <p>Use <strong>Add adjudicator</strong> to grant the role, then assign the categories they’ll judge.</p>
          <button type="button" className="dash-btn is-primary" onClick={() => setAdding(true)}>
            <i className="fas fa-user-plus" aria-hidden="true" /> Add adjudicator
          </button>
        </div>
      ) : (
        <div className="dash-card ja-tablecard">
          <div className="ja-scroll">
            <table className="ja-table">
              <thead>
                <tr>
                  <th>Adjudicator</th>
                  <th>Assigned categories</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.userId} className="ja-row">
                    <td className="ja-who">
                      <span className="ja-avatar" aria-hidden="true">{initialsOf(r.fullName, r.email)}</span>
                      <span className="ja-id">
                        <span className="ja-name">{r.fullName || r.email}</span>
                        <span className="ja-email">{r.email}</span>
                      </span>
                    </td>
                    <td className="ja-cats">
                      {r.categoryNumbers.length === 0 ? (
                        <span className="ja-none"><i className="fas fa-circle-info" aria-hidden="true" /> None — empty Finals queue</span>
                      ) : (
                        <span className="ja-chips">
                          {r.categoryNumbers.map((n) => (
                            <span key={n} className="ja-chip">
                              <span className="ja-chip-n">#{n}</span> {nameByNumber.get(n) || `Category ${n}`}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="ja-actioncell">
                      <button type="button" className="dash-btn is-sm" onClick={() => startEdit(r)}>
                        <i className="fas fa-pen" aria-hidden="true" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adding && (
        <Modal title="Add an adjudicator" onClose={() => { setAdding(false); reload() }}>
          <AddAdjudicator onChanged={reload} />
        </Modal>
      )}

      {editRow && (
        <Modal
          title="Assign categories"
          sub={editRow.fullName || editRow.email}
          onClose={() => { if (!saving) setEditing(null) }}
          foot={
            <>
              <span className="ja-selected">{draft.size} of {categories.length} selected</span>
              <button type="button" className="dash-btn is-ghost is-sm" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button type="button" className="dash-btn is-primary is-sm" onClick={() => save(editRow)} disabled={saving}>
                {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : 'Save assignments'}
              </button>
            </>
          }
        >
          <div className="ja-grid">
            {categories.map((c) => {
              const on = draft.has(c.number)
              return (
                <label key={c.number} className={`ja-check${on ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(c.number)} />
                  <span className="ja-num">#{c.number}</span>
                  <span className="ja-cname">{c.name}</span>
                </label>
              )
            })}
          </div>
          {saveError && (
            <div className="dash-banner tone-error ja-err">
              <i className="fas fa-circle-exclamation" aria-hidden="true" /> {saveError}
            </div>
          )}
        </Modal>
      )}

      <style>{`
        .ja-tablecard { padding: 0; overflow: hidden; }
        .ja-scroll { overflow-x: auto; }
        .ja-table { width: 100%; border-collapse: collapse; }
        .ja-table thead th { background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 12px 18px; text-align: left; white-space: nowrap; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); }
        .ja-table td { padding: 13px 18px; vertical-align: middle; border-bottom: 1px solid var(--gray-100); }
        .ja-table tbody tr:last-child td { border-bottom: none; }
        .ja-row:hover { background: rgba(200,168,75,0.05); }

        .ja-who { display: flex; align-items: center; gap: 12px; min-width: 220px; }
        .ja-avatar { width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-heading); font-weight: 800; font-size: 0.78rem; color: var(--navy); background: linear-gradient(135deg, var(--gold-light), var(--gold)); }
        .ja-id { display: flex; flex-direction: column; min-width: 0; }
        .ja-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.9rem; }
        .ja-email { color: var(--gray-600); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; }

        .ja-cats { min-width: 340px; }
        .ja-chips { display: flex; flex-wrap: wrap; gap: 5px; }
        .ja-chip { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-heading); font-size: 0.7rem; font-weight: 600; line-height: 1.5; color: var(--navy); background: rgba(200,168,75,0.1); border: 1px solid rgba(200,168,75,0.28); padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .ja-chip-n { font-weight: 800; color: var(--gold-dark); }
        .ja-none { display: inline-flex; align-items: center; gap: 7px; color: var(--gray-600); font-size: 0.84rem; font-style: italic; }
        .ja-actioncell { text-align: right; white-space: nowrap; }

        .ja-modal { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 20px; background: rgba(15,25,46,0.55); backdrop-filter: blur(2px); }
        .ja-modal-card { width: 100%; max-width: 640px; max-height: 86vh; display: flex; flex-direction: column; background: var(--white); border-radius: var(--radius-md); box-shadow: 0 30px 70px rgba(15,25,46,0.4); overflow: hidden; }
        .ja-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 24px 14px; border-bottom: 1px solid var(--gray-100); }
        .ja-modal-title { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; color: var(--navy); }
        .ja-modal-sub { color: var(--gray-600); font-size: 0.84rem; margin-top: 2px; }
        .ja-modal-x { background: none; border: none; cursor: pointer; color: var(--gray-400); font-size: 1.05rem; padding: 4px 8px; border-radius: 6px; line-height: 1; }
        .ja-modal-x:hover { color: var(--navy); background: var(--gray-100); }
        .ja-modal-body { padding: 18px 24px; overflow-y: auto; }
        .ja-modal-foot { display: flex; align-items: center; gap: 12px; padding: 14px 24px; border-top: 1px solid var(--gray-100); background: var(--off-white); }
        .ja-selected { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gray-600); margin-right: auto; }

        .ja-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
        .ja-check { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition-fast); background: var(--white); }
        .ja-check:hover { border-color: var(--gold); }
        .ja-check.is-on { border-color: var(--gold); background: rgba(200,168,75,0.1); }
        .ja-check input { width: 17px; height: 17px; accent-color: var(--gold-dark); cursor: pointer; flex-shrink: 0; }
        .ja-num { font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); flex-shrink: 0; }
        .ja-cname { font-family: var(--font-body); font-size: 0.84rem; color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ja-err { margin-top: 14px; }

        .ja-hint { font-size: 0.84rem; color: var(--gray-600); line-height: 1.55; margin-bottom: 14px; }
        .ja-search { position: relative; margin-bottom: 12px; }
        .ja-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .ja-search .dash-input { padding-left: 36px; }
        .ja-searchnote { font-size: 0.84rem; color: var(--gray-600); padding: 10px 2px; }
        .ja-results { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .ja-result { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); }
        .ja-result .dash-btn { margin-left: auto; flex-shrink: 0; }

        @media (max-width: 640px) { .ja-chips { display: none; } }
      `}</style>
    </>
  )
}

import { useState } from 'react'
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

export default function ReviewerAdminPage() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(null) // userId being edited
  const [draft, setDraft] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const { loading, error, data, reload } = useAsync(
    () =>
      Promise.all([api.get('/admin/reviewers', { auth: true }), api.get('/award-categories/')]).then(
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
      await api.put(`/admin/reviewers/${r.userId}/categories`, { categoryNumbers: [...draft] }, { auth: true })
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
          <span className="dash-eyebrow">Admin · Reviewers</span>
          <h1 className="dash-h1">Reviewer assignments</h1>
          <p className="dash-sub">
            Assign award categories to each Secretariat and Validator. A reviewer only sees and acts on entries in
            their assigned categories; an unassigned reviewer sees an empty queue.
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-users-gear" aria-hidden="true" /></div>
          <h3>No reviewers yet</h3>
          <p>Give a user the Secretariat or Validator role first — they'll then appear here for category assignment.</p>
        </div>
      ) : (
        <div className="ra-list">
          {list.map((r) => {
            const isEditing = editing === r.userId
            const roles = r.roles.filter((x) => x !== 'Applicant')
            return (
              <div key={r.userId} className="dash-card ra-card">
                <div className="ra-head">
                  <span className="ra-avatar" aria-hidden="true">{initialsOf(r.fullName, r.email)}</span>
                  <div className="ra-id">
                    <span className="ra-name">{r.fullName || r.email}</span>
                    <span className="ra-email">{r.email}</span>
                  </div>
                  <span className="ra-roles">
                    {roles.map((role) => (
                      <span key={role} className="ra-role">{role}</span>
                    ))}
                  </span>
                  {!isEditing && (
                    <button type="button" className="dash-btn is-sm" onClick={() => startEdit(r)}>
                      <i className="fas fa-pen" aria-hidden="true" /> Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="ra-editor">
                    <div className="ra-grid">
                      {categories.map((c) => {
                        const on = draft.has(c.number)
                        return (
                          <label key={c.number} className={`ra-check${on ? ' is-on' : ''}`}>
                            <input type="checkbox" checked={on} onChange={() => toggle(c.number)} />
                            <span className="ra-num">#{c.number}</span>
                            <span className="ra-cname">{c.name}</span>
                          </label>
                        )
                      })}
                    </div>
                    {saveError && (
                      <div className="dash-banner tone-error">
                        <i className="fas fa-circle-exclamation" aria-hidden="true" /> {saveError}
                      </div>
                    )}
                    <div className="ra-actions">
                      <span className="ra-selected">{draft.size} selected</span>
                      <button type="button" className="dash-btn is-ghost" onClick={() => setEditing(null)} disabled={saving}>
                        Cancel
                      </button>
                      <button type="button" className="dash-btn is-primary" onClick={() => save(r)} disabled={saving}>
                        {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : 'Save assignments'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ra-chips">
                    {r.categoryNumbers.length === 0 ? (
                      <span className="ra-empty"><i className="fas fa-circle-info" aria-hidden="true" /> No categories assigned — this reviewer sees an empty queue.</span>
                    ) : (
                      r.categoryNumbers.map((n) => (
                        <span key={n} className="ra-chip"><b>#{n}</b> {nameByNumber.get(n) || `Category ${n}`}</span>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .ra-list { display: flex; flex-direction: column; gap: 16px; }
        .ra-card { padding: 18px 20px; }
        .ra-head { display: flex; align-items: center; gap: 14px; }
        .ra-avatar { width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-heading); font-weight: 800; font-size: 0.85rem; color: var(--navy); background: linear-gradient(135deg, var(--gold-light), var(--gold)); }
        .ra-id { display: flex; flex-direction: column; min-width: 0; }
        .ra-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.96rem; }
        .ra-email { color: var(--gray-600); font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; }
        .ra-roles { display: flex; gap: 6px; margin-left: auto; flex-shrink: 0; }
        .ra-role { font-family: var(--font-heading); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.3); padding: 4px 9px; border-radius: 999px; }

        .ra-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--gray-100); }
        .ra-chip { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 600; color: var(--navy); background: var(--off-white); border: 1px solid var(--gray-200); padding: 6px 11px; border-radius: 8px; }
        .ra-chip b { color: var(--gold-dark); }
        .ra-empty { display: inline-flex; align-items: center; gap: 8px; color: var(--gray-600); font-size: 0.86rem; font-style: italic; }

        .ra-editor { margin-top: 14px; padding-top: 16px; border-top: 1px solid var(--gray-100); }
        .ra-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
        .ra-check { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition-fast); background: var(--white); }
        .ra-check:hover { border-color: var(--gold); }
        .ra-check.is-on { border-color: var(--gold); background: rgba(200,168,75,0.08); }
        .ra-check input { width: 17px; height: 17px; accent-color: var(--gold-dark); cursor: pointer; flex-shrink: 0; }
        .ra-num { font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem; color: var(--gold-dark); flex-shrink: 0; }
        .ra-cname { font-family: var(--font-body); font-size: 0.84rem; color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .ra-actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
        .ra-selected { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gray-600); margin-right: auto; }
        .ra-editor .dash-banner { margin-top: 14px; }
      `}</style>
    </>
  )
}

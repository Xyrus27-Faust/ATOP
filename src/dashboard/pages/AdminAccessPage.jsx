import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'

// Admin: approve/deny self-service validator requests, and grant/revoke the role directly.
// Granting only adds the role (additive) — it never removes the user's existing roles. After a
// grant, the admin scopes the validator's award categories on the existing Reviewers page.
export default function AdminAccessPage() {
  const { user } = useAuth()
  const { loading, error, data, reload } = useAsync(() => api.get('/admin/role-requests', { auth: true }), [])
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  if (!isAdmin(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const requests = data || []

  async function decide(req, action) {
    setBusyId(req.id)
    setActionError(null)
    try {
      await api.post(`/admin/role-requests/${req.id}/${action}`, action === 'deny' ? {} : undefined, { auth: true })
      await reload()
    } catch (e) {
      setActionError(e?.message || 'Could not complete that action. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Admin · Access</span>
          <h1 className="dash-h1">Validator access</h1>
          <p className="dash-sub">
            Approve validator requests or assign the role directly. After granting, scope their award
            categories on the <Link to="/dashboard/admin/reviewers" className="dash-inline-link">Reviewers</Link> page.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="dash-banner tone-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {actionError}</div>
      )}

      <section className="aa-section">
        <h2 className="aa-h2">Pending requests <span className="aa-count">{requests.length}</span></h2>
        {requests.length === 0 ? (
          <div className="dash-card dash-empty">
            <div className="dash-empty-icon"><i className="fas fa-inbox" aria-hidden="true" /></div>
            <h3>No pending requests</h3>
            <p>Self-service validator requests will appear here for approval.</p>
          </div>
        ) : (
          <div className="aa-list">
            {requests.map((r) => (
              <div key={r.id} className="dash-card aa-card">
                <div className="aa-id">
                  <span className="aa-name">{r.fullName || r.email}</span>
                  <span className="aa-email">{r.email}</span>
                </div>
                <span className="dash-badge tone-progress">{r.role}</span>
                <div className="aa-actions">
                  <button type="button" className="dash-btn is-sm is-ghost" disabled={busyId === r.id} onClick={() => decide(r, 'deny')}>
                    Deny
                  </button>
                  <button type="button" className="dash-btn is-sm is-primary" disabled={busyId === r.id} onClick={() => decide(r, 'approve')}>
                    {busyId === r.id ? 'Working…' : 'Approve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="aa-section">
        <h2 className="aa-h2">Assign directly</h2>
        <UserAssign />
      </section>

      <style>{`
        .aa-section { margin-top: 26px; }
        .aa-h2 { display: flex; align-items: center; gap: 10px; font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); margin-bottom: 14px; }
        .aa-count { display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; color: var(--gold-dark); background: rgba(200,168,75,0.14); border: 1px solid rgba(200,168,75,0.28); }
        .aa-list { display: flex; flex-direction: column; gap: 12px; }
        .aa-card { display: flex; align-items: center; gap: 14px; padding: 14px 18px; }
        .aa-id { display: flex; flex-direction: column; min-width: 0; }
        .aa-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; }
        .aa-email { color: var(--gray-600); font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; }
        .aa-actions { display: flex; gap: 8px; margin-left: auto; flex-shrink: 0; }

        .aa-search { position: relative; }
        .aa-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .aa-search .dash-input { padding-left: 36px; }
        .aa-results { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
        .aa-user { display: flex; align-items: center; gap: 14px; padding: 11px 4px; border-bottom: 1px solid var(--gray-100); }
        .aa-user:last-child { border-bottom: none; }
        .aa-note { color: var(--gray-600); font-size: 0.86rem; padding: 8px 2px; }
      `}</style>
    </>
  )
}

function UserAssign() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    // Leave stale results in state when the term is too short — the render gates on length, so
    // they're never shown, and clearing here would be a synchronous setState in the effect body.
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
        ? await api.post(`/admin/users/${u.userId}/roles`, { role: 'Validator' }, { auth: true })
        : await api.delete(`/admin/users/${u.userId}/roles/Validator`, { auth: true })
      setResults((rs) => rs.map((r) => (r.userId === u.userId ? updated : r)))
    } catch {
      // a transient failure leaves the row unchanged; the admin can retry
    } finally {
      setBusy(null)
    }
  }

  const term = q.trim()
  return (
    <div className="dash-card dash-card-pad">
      <div className="aa-search">
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          className="dash-input"
          type="search"
          placeholder="Search users by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users"
        />
      </div>
      {term.length >= 2 && (
        <div className="aa-results">
          {loading && <div className="aa-note">Searching…</div>}
          {!loading && results.length === 0 && <div className="aa-note">No users match “{term}”.</div>}
          {results.map((u) => {
            const isValidator = (u.roles || []).includes('Validator')
            return (
              <div key={u.userId} className="aa-user">
                <div className="aa-id">
                  <span className="aa-name">{u.fullName || u.email}</span>
                  <span className="aa-email">{u.email}</span>
                </div>
                <div className="aa-actions">
                  {isValidator ? (
                    <button type="button" className="dash-btn is-sm is-ghost" disabled={busy === u.userId} onClick={() => toggle(u, false)}>
                      {busy === u.userId ? 'Working…' : 'Remove validator'}
                    </button>
                  ) : (
                    <button type="button" className="dash-btn is-sm is-primary" disabled={busy === u.userId} onClick={() => toggle(u, true)}>
                      {busy === u.userId ? 'Working…' : 'Make validator'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

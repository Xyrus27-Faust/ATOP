import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/auth/AuthContext'
import { isAdmin } from '../dashboardNav'
import { useAsync } from '../useAsync'
import { Loading, ErrorState } from '../components/states'
import { formatDate } from '@/lib/pearlAwards'

// Admin home for validators: approve/deny self-service requests, see the active validators, and
// grant/revoke the role directly. Validators are unscoped — they review submissions across ALL
// categories — so there are no per-validator category assignments here.
export default function AdminAccessPage() {
  const { user } = useAuth()
  const { loading, error, data, reload } = useAsync(
    () => Promise.all([
      api.get('/admin/role-requests', { auth: true }),
      api.get('/admin/reviewers', { auth: true }),
      api.get('/award-categories/'),
    ]).then(([requests, reviewers, catalog]) => ({ requests, reviewers, catalog })),
    [],
  )
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignFor, setAssignFor] = useState(null) // validator whose categories are being edited
  const [assignDraft, setAssignDraft] = useState(() => new Set())
  const [savingAssign, setSavingAssign] = useState(false)
  const [assignError, setAssignError] = useState(null)

  if (!isAdmin(user?.roles)) return <Navigate to="/dashboard" replace />
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const requests = data?.requests || []
  const validators = (data?.reviewers || []).filter((r) => (r.roles || []).includes('Validator'))
  const categories = data?.catalog?.categories || []
  const nameByNumber = new Map(categories.map((c) => [c.number, c.name]))

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

  async function removeValidator(v) {
    setBusyId(v.userId)
    setActionError(null)
    try {
      await api.delete(`/admin/users/${v.userId}/roles/Validator`, { auth: true })
      await reload()
    } catch (e) {
      setActionError(e?.message || 'Could not remove that validator. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  function openAssign(v) {
    setAssignFor(v)
    setAssignDraft(new Set(v.categoryNumbers || []))
    setAssignError(null)
  }

  function toggleCat(n) {
    setAssignDraft((d) => {
      const next = new Set(d)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  async function saveAssign() {
    setSavingAssign(true)
    setAssignError(null)
    try {
      await api.put(`/admin/reviewers/${assignFor.userId}/categories`, { categoryNumbers: [...assignDraft] }, { auth: true })
      setAssignFor(null)
      await reload()
    } catch (e) {
      setAssignError(e?.message || 'Could not save categories. Please try again.')
    } finally {
      setSavingAssign(false)
    }
  }

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="dash-eyebrow">Admin · Validators</span>
          <h1 className="dash-h1">Manage Validators</h1>
          <p className="dash-sub">
            Approve validator requests or add one directly. A new validator has <strong>no access</strong> until
            you assign categories — they only see and review entries in their assigned categories.
          </p>
        </div>
        <button type="button" className="dash-btn is-primary" onClick={() => setAssignOpen(true)}>
          <i className="fas fa-plus" aria-hidden="true" /> Add Validator
        </button>
      </div>

      {actionError && (
        <div className="dash-banner tone-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {actionError}</div>
      )}

      <h2 className="mv-h2">Pending requests <span className="mv-count">{requests.length}</span></h2>
      {requests.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-inbox" aria-hidden="true" /></div>
          <h3>No pending requests</h3>
          <p>Self-service validator requests appear here for approval. You can also add a validator directly.</p>
        </div>
      ) : (
        <div className="dash-card mv-table-card">
          <div className="mv-scroll">
            <table className="mv-table">
              <thead>
                <tr>
                  <th>Requester</th>
                  <th>Email</th>
                  <th>Requested</th>
                  <th className="mv-th-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="mv-name">{r.fullName || '—'}</td>
                    <td className="mv-email">{r.email}</td>
                    <td className="mv-date">{formatDate(r.requestedAt)}</td>
                    <td className="mv-actions">
                      <button type="button" className="dash-btn is-sm is-ghost" disabled={busyId === r.id} onClick={() => decide(r, 'deny')}>
                        Deny
                      </button>
                      <button type="button" className="dash-btn is-sm is-primary" disabled={busyId === r.id} onClick={() => decide(r, 'approve')}>
                        {busyId === r.id ? 'Working…' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="mv-h2">Active validators <span className="mv-count">{validators.length}</span></h2>
      {validators.length === 0 ? (
        <div className="dash-card dash-empty">
          <div className="dash-empty-icon"><i className="fas fa-user-shield" aria-hidden="true" /></div>
          <h3>No validators yet</h3>
          <p>Approve a request above, or use <strong>Add Validator</strong> to grant the role directly.</p>
        </div>
      ) : (
        <div className="dash-card mv-table-card">
          <div className="mv-scroll">
            <table className="mv-table">
              <thead>
                <tr>
                  <th>Validator</th>
                  <th>Email</th>
                  <th>Coverage</th>
                  <th className="mv-th-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {validators.map((v) => (
                  <tr key={v.userId}>
                    <td className="mv-name">{v.fullName || '—'}</td>
                    <td className="mv-email">{v.email}</td>
                    <td className="mv-cov">
                      {v.categoryNumbers?.length ? (
                        <span className="mv-chips">
                          {v.categoryNumbers.map((n) => (
                            <span key={n} className="mv-chip"><span className="mv-chip-n">#{n}</span> {nameByNumber.get(n) || `Category ${n}`}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="mv-none"><i className="fas fa-ban" aria-hidden="true" /> Not assigned</span>
                      )}
                    </td>
                    <td className="mv-actions">
                      <button type="button" className="dash-btn is-sm" onClick={() => openAssign(v)}>
                        <i className="fas fa-list-check" aria-hidden="true" /> Categories
                      </button>
                      <button type="button" className="dash-btn is-sm is-ghost" disabled={busyId === v.userId} onClick={() => removeValidator(v)}>
                        {busyId === v.userId ? 'Working…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {assignOpen && (
        <Modal title="Add validator" onClose={() => setAssignOpen(false)}>
          <p className="mv-modal-note">Search for a user and grant the Validator role. They keep their existing roles. A new validator has no access until you assign categories.</p>
          <UserAssign />
        </Modal>
      )}

      {assignFor && (
        <Modal title="Assign categories" onClose={() => { if (!savingAssign) setAssignFor(null) }}>
          <p className="mv-modal-note">
            <strong>{assignFor.fullName || assignFor.email}</strong> — pick the categories they should review.
            With nothing checked they have <strong>no access</strong> (empty review queue).
          </p>
          <div className="mv-catgrid">
            {categories.map((c) => {
              const on = assignDraft.has(c.number)
              return (
                <label key={c.number} className={`mv-check${on ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleCat(c.number)} />
                  <span className="mv-check-n">#{c.number}</span>
                  <span className="mv-check-name">{c.name}</span>
                </label>
              )
            })}
          </div>
          {assignError && (
            <div className="dash-banner tone-error" style={{ marginTop: 12 }}><i className="fas fa-circle-exclamation" aria-hidden="true" /> {assignError}</div>
          )}
          <div className="mv-modal-foot">
            <span className="mv-selected">{assignDraft.size === 0 ? 'No access' : `${assignDraft.size} of ${categories.length} selected`}</span>
            <button type="button" className="dash-btn is-sm is-ghost" onClick={() => setAssignFor(null)} disabled={savingAssign}>Cancel</button>
            <button type="button" className="dash-btn is-sm is-primary" onClick={saveAssign} disabled={savingAssign}>
              {savingAssign ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        .mv-h2 { display: flex; align-items: center; gap: 10px; font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); margin: 26px 0 14px; }
        .mv-count { display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; color: var(--gold-dark); background: rgba(200,168,75,0.14); border: 1px solid rgba(200,168,75,0.28); }

        .mv-table-card { padding: 0; overflow: hidden; }
        .mv-scroll { overflow-x: auto; }
        .mv-table { width: 100%; border-collapse: collapse; }
        .mv-table thead th { text-align: left; background: var(--off-white); border-bottom: 1px solid var(--gray-200); padding: 12px 16px; font-family: var(--font-heading); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gray-600); white-space: nowrap; }
        .mv-th-actions { width: 1%; }
        .mv-table tbody tr { border-bottom: 1px solid var(--gray-100); }
        .mv-table tbody tr:last-child { border-bottom: none; }
        .mv-table tbody tr:hover { background: rgba(200,168,75,0.05); }
        .mv-table td { padding: 12px 16px; vertical-align: middle; }
        .mv-name { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.92rem; white-space: nowrap; }
        .mv-email { color: var(--gray-600); font-size: 0.86rem; }
        .mv-date { color: var(--gray-600); font-size: 0.84rem; white-space: nowrap; font-family: var(--font-heading); font-weight: 600; }
        .mv-actions { display: flex; gap: 8px; justify-content: flex-end; white-space: nowrap; }
        .mv-all { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.03em; color: var(--gold-dark); background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.28); padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
        .mv-cov { min-width: 220px; max-width: 460px; }
        .mv-none { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.03em; color: var(--gray-500); background: var(--gray-100); border: 1px solid var(--gray-200); padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
        .mv-chips { display: flex; flex-wrap: wrap; gap: 4px; }
        .mv-chip { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-heading); font-size: 0.68rem; font-weight: 600; color: var(--navy); background: rgba(200,168,75,0.1); border: 1px solid rgba(200,168,75,0.28); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
        .mv-chip-n { font-weight: 800; color: var(--gold-dark); }

        /* Assign-categories modal */
        .mv-catgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; max-height: 48vh; overflow-y: auto; }
        .mv-check { display: flex; align-items: center; gap: 9px; padding: 8px 11px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm, 8px); cursor: pointer; background: var(--white); transition: var(--transition-fast, all 0.12s ease); }
        .mv-check:hover { border-color: var(--gold); }
        .mv-check.is-on { border-color: var(--gold); background: rgba(200,168,75,0.1); }
        .mv-check input { width: 16px; height: 16px; accent-color: var(--gold-dark); cursor: pointer; flex-shrink: 0; }
        .mv-check-n { font-family: var(--font-heading); font-weight: 800; font-size: 0.76rem; color: var(--gold-dark); flex-shrink: 0; }
        .mv-check-name { font-family: var(--font-body); font-size: 0.82rem; color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mv-modal-foot { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--gray-100); }
        .mv-selected { font-family: var(--font-heading); font-size: 0.78rem; font-weight: 700; color: var(--gray-600); margin-right: auto; }

        /* Modal */
        .mv-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(15,25,46,0.45); display: grid; place-items: center; padding: 20px; animation: mvFade 0.15s ease-out; }
        .mv-modal { width: 100%; max-width: 520px; background: var(--white); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg, 0 24px 60px rgba(15,25,46,0.3)); overflow: hidden; }
        .mv-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--gray-200); }
        .mv-modal-head h3 { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--navy); }
        .mv-modal-close { display: grid; place-items: center; width: 32px; height: 32px; border: none; background: none; color: var(--gray-600); cursor: pointer; border-radius: 8px; }
        .mv-modal-close:hover { background: var(--gray-100); color: var(--navy); }
        .mv-modal-body { padding: 20px; }
        .mv-modal-note { color: var(--gray-600); font-size: 0.86rem; line-height: 1.6; margin-bottom: 14px; }
        @keyframes mvFade { from { opacity: 0; } to { opacity: 1; } }

        .mv-search { position: relative; }
        .mv-search i { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 0.85rem; pointer-events: none; }
        .mv-search .dash-input { padding-left: 36px; }
        .mv-results { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; max-height: 320px; overflow-y: auto; }
        .mv-user { display: flex; align-items: center; gap: 14px; padding: 11px 4px; border-bottom: 1px solid var(--gray-100); }
        .mv-user:last-child { border-bottom: none; }
        .mv-id { display: flex; flex-direction: column; min-width: 0; }
        .mv-note { color: var(--gray-600); font-size: 0.86rem; padding: 8px 2px; }
        .mv-actions-cell { margin-left: auto; flex-shrink: 0; }
      `}</style>
    </>
  )
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="mv-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mv-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mv-modal-head">
          <h3>{title}</h3>
          <button type="button" className="mv-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="mv-modal-body">{children}</div>
      </div>
    </div>
  )
}

function UserAssign() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    // Leave stale results when the term is too short — the render gates on length, so they're
    // never shown, and clearing here would be a synchronous setState in the effect body.
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
    <>
      <div className="mv-search">
        <i className="fas fa-magnifying-glass" aria-hidden="true" />
        <input
          className="dash-input"
          type="search"
          placeholder="Search users by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users"
          autoFocus
        />
      </div>
      {term.length >= 2 && (
        <div className="mv-results">
          {loading && <div className="mv-note">Searching…</div>}
          {!loading && results.length === 0 && <div className="mv-note">No users match “{term}”.</div>}
          {results.map((u) => {
            const isValidator = (u.roles || []).includes('Validator')
            return (
              <div key={u.userId} className="mv-user">
                <div className="mv-id">
                  <span className="mv-name">{u.fullName || u.email}</span>
                  <span className="mv-email">{u.email}</span>
                </div>
                <div className="mv-actions-cell">
                  {isValidator ? (
                    <button type="button" className="dash-btn is-sm is-ghost" disabled={busy === u.userId} onClick={() => toggle(u, false)}>
                      {busy === u.userId ? 'Working…' : 'Remove'}
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
    </>
  )
}

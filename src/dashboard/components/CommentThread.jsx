import { useState } from 'react'
import { api } from '@/lib/apiClient'
import { useAsync } from '../useAsync'
import { formatDate } from '@/lib/pearlAwards'

// The review conversation on an entry. Shared by the applicant's editor and the reviewer's
// entry page: both read the same thread and can post. A message notifies the other side; it
// never changes the entry's status.
export default function CommentThread({ entryId }) {
  const { loading, error, data, reload } = useAsync(() => api.get(`/entries/${entryId}/comments`, { auth: true }), [entryId])
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState(null)

  const comments = data || []

  async function submit(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text || posting) return
    setPosting(true)
    setPostError(null)
    try {
      await api.post(`/entries/${entryId}/comments`, { body: text }, { auth: true })
      setBody('')
      await reload()
    } catch (err) {
      setPostError(err?.message || 'Could not post your message. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <section className="dash-card dash-card-pad ct-card">
      <div className="dash-card-title"><i className="fas fa-comments" aria-hidden="true" /> Reviewer conversation</div>
      <p className="dash-help ct-help">
        Reply to the reviewer, ask a question, or dispute a decision. Messages notify the other
        side — they don't change your entry's status.
      </p>

      {loading ? (
        <p className="dash-help">Loading the conversation…</p>
      ) : error ? (
        <p className="dash-help">We couldn't load the conversation.</p>
      ) : comments.length === 0 ? (
        <p className="ct-empty">No messages yet. Start the conversation below.</p>
      ) : (
        <ul className="ct-list">
          {comments.map((c) => (
            <li key={c.id} className={`ct-msg ${c.byReviewer ? 'is-reviewer' : 'is-applicant'}`}>
              <div className="ct-msg-head">
                <span className="ct-author">{c.authorName}</span>
                <span className={`ct-tag ${c.byReviewer ? 'is-reviewer' : ''}`}>{c.byReviewer ? 'Reviewer' : 'Applicant'}</span>
                <span className="ct-time">{formatDate(c.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div className="ct-body">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      <form className="ct-form" onSubmit={submit}>
        <textarea
          className="dash-textarea ct-input"
          rows={3}
          placeholder="Write a message…"
          value={body}
          disabled={posting}
          onChange={(e) => setBody(e.target.value)}
        />
        {postError && <p className="ct-error"><i className="fas fa-circle-exclamation" aria-hidden="true" /> {postError}</p>}
        <div className="ct-actions">
          <button type="submit" className="dash-btn is-primary is-sm" disabled={posting || !body.trim()}>
            <i className="fas fa-paper-plane" aria-hidden="true" /> {posting ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>

      <style>{`
        .ct-help { margin-bottom: 16px; }
        .ct-empty { color: var(--gray-600); font-size: 0.9rem; padding: 6px 0 14px; }
        .ct-list { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .ct-msg { border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 12px 14px; background: var(--white); }
        .ct-msg.is-reviewer { border-left: 3px solid var(--gold); background: rgba(200,168,75,0.05); }
        .ct-msg.is-applicant { border-left: 3px solid var(--navy); }
        .ct-msg-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
        .ct-author { font-family: var(--font-heading); font-weight: 700; color: var(--navy); font-size: 0.88rem; }
        .ct-tag { font-family: var(--font-heading); font-size: 0.64rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; color: var(--navy); background: rgba(15,25,46,0.08); }
        .ct-tag.is-reviewer { color: var(--gold-dark); background: rgba(200,168,75,0.16); }
        .ct-time { margin-left: auto; color: var(--gray-500, #9aa2b1); font-size: 0.76rem; font-family: var(--font-heading); font-weight: 600; }
        .ct-body { color: var(--ink, #2b303b); font-size: 0.92rem; line-height: 1.6; white-space: pre-wrap; }
        .ct-input { width: 100%; }
        .ct-error { color: #b91c1c; font-size: 0.84rem; margin: 8px 0 0; }
        .ct-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
      `}</style>
    </section>
  )
}

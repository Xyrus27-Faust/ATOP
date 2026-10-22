// The form in progress, kept on the device (ATOP, 2026-10-22). Sixty-odd questions on venue wifi:
// a dropped signal, a locked phone or a closed tab must not cost someone their answers. One draft
// per event per device; storage can be blocked (private mode), so every read and write is allowed
// to fail and the form simply works without it.

const key = (eventId) => `atop-evaluation:${eventId}`

export function loadDraft(eventId) {
  try {
    const raw = localStorage.getItem(key(eventId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDraft(eventId, draft) {
  try {
    localStorage.setItem(key(eventId), JSON.stringify(draft))
  } catch {
    // Full or blocked: the form still works, it just won't survive a reload.
  }
}

export function clearDraft(eventId) {
  try {
    localStorage.removeItem(key(eventId))
  } catch {
    // Nothing to clear.
  }
}

/** A saved sign-in still worth using: the server would refuse it a little early anyway. */
export const tokenUsable = (draft) =>
  Boolean(draft?.accessToken && draft?.expiresAt && new Date(draft.expiresAt).getTime() - Date.now() > 60_000)

/** The question ids a section still needs before Next — ratings and scales; comments are optional. */
export const missingIn = (section, answers) =>
  section.questions.filter((q) => q.required && !isAnswered(q, answers[q.id])).map((q) => q.id)

export function isAnswered(question, answer) {
  if (!answer) return false
  switch (question.kind) {
    case 'Rating':
      return answer.na || answer.value != null
    case 'Scale':
      return answer.value != null
    case 'Choice':
      return Boolean(answer.choice)
    default:
      return Boolean(answer.text?.trim())
  }
}

/** What the API takes: one entry per question touched, only the fields its kind uses. */
export function toPayload(sections, answers) {
  const out = []
  for (const section of sections) {
    for (const q of section.questions) {
      const a = answers[q.id]
      if (!isAnswered(q, a)) continue
      switch (q.kind) {
        case 'Rating':
          out.push({ questionId: q.id, value: a.na ? null : a.value, notApplicable: Boolean(a.na), choice: null, text: null })
          break
        case 'Scale':
          out.push({ questionId: q.id, value: a.value, notApplicable: false, choice: null, text: null })
          break
        case 'Choice':
          out.push({ questionId: q.id, value: null, notApplicable: false, choice: a.choice, text: a.choice === 'Other' ? a.text?.trim() || null : null })
          break
        default:
          out.push({ questionId: q.id, value: null, notApplicable: false, choice: null, text: a.text.trim() })
      }
    }
  }
  return out
}

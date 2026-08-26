import { useEffect, useRef } from 'react'

/**
 * Debounced autosave + leave protection for an editor section.
 *
 *  - `signature`: a string that changes whenever the editable content changes
 *    (so the debounce can depend on a literal dep array).
 *  - `dirty`: there are unsaved changes.
 *  - `canSave`: the content is valid enough to persist (e.g. not over a limit,
 *    required fields present).
 *  - `onSave(silent)`: persists. Called with `false` for a normal autosave and
 *    `true` on unmount (must avoid setting state on the unmounting component).
 *
 * Also warns on tab close/refresh while dirty, and flushes a final save when the
 * component unmounts (navigating away) so long-form work is never lost.
 */
export function useAutosave({ signature, dirty, canSave, onSave, delay = 1500 }) {
  const ref = useRef({ dirty, canSave, onSave })
  useEffect(() => {
    ref.current = { dirty, canSave, onSave }
  })

  // Debounce a save once there are unsaved, saveable changes.
  useEffect(() => {
    if (!dirty || !canSave) return undefined
    const timer = setTimeout(() => ref.current.onSave(false), delay)
    return () => clearTimeout(timer)
  }, [signature, dirty, canSave, delay])

  // Warn before the tab closes / reloads while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Flush a final save when navigating away (component unmounts).
  useEffect(
    () => () => {
      const r = ref.current
      if (r.dirty && r.canSave) r.onSave(true)
    },
    [],
  )
}

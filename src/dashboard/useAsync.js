import { useCallback, useEffect, useState } from 'react'

/**
 * Minimal data-loading hook: runs `fn` on mount (and on `reload()`), tracking
 * loading/error/data. An `active` flag drops a stale response if deps change or
 * the component unmounts before the request settles. `deps` re-runs the loader.
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => { if (active) setState({ loading: false, error: null, data }) },
      (error) => { if (active) setState({ loading: false, error, data: null }) },
    )
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, nonce])

  return { ...state, reload }
}

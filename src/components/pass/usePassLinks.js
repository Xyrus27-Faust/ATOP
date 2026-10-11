import { useMemo } from 'react'
import { useAsync } from '@/dashboard/useAsync'
import { getPassLinks, passUrl } from '@/lib/pass'

/**
 * The booker's live pass links, as { delegateId: url }. Asked for only once a seat has a pass. A
 * failure leaves the map empty: the share buttons are an extra, and the QR beside them still works.
 */
export function usePassLinks(registrationId, enabled) {
  const { data } = useAsync(
    () => (enabled ? getPassLinks(registrationId).catch(() => []) : Promise.resolve([])),
    [registrationId, enabled],
  )
  return useMemo(
    () => Object.fromEntries((data || []).map((l) => [l.delegateId, passUrl(l.token)])),
    [data],
  )
}

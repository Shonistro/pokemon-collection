import { useCallback, useSyncExternalStore } from 'react';
import { getRateLimit, subscribeRateLimit, type QuotaKey } from '../lib/quotaStore';

/**
 * Subscribe to the latest daily rate-limit info for one upstream ('tcgapi' by
 * default, or 'pokewallet'). Returns null until the first proxy call to that API
 * this session reports numbers.
 */
export function useQuota(provider: QuotaKey = 'tcgapi') {
  const getSnapshot = useCallback(() => getRateLimit(provider), [provider]);
  return useSyncExternalStore(subscribeRateLimit, getSnapshot, getSnapshot);
}

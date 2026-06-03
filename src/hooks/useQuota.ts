import { useSyncExternalStore } from 'react';
import { getRateLimit, subscribeRateLimit } from '../lib/quotaStore';

/**
 * Subscribe to the latest TCG API rate-limit info. Returns null until the first
 * proxy call of the session reports it.
 */
export function useQuota() {
  return useSyncExternalStore(subscribeRateLimit, getRateLimit, getRateLimit);
}

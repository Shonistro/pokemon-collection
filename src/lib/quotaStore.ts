import type { RateLimitInfo } from '../types';

/**
 * A tiny external store holding the latest TCG API rate-limit info. Every proxy
 * response updates it, and the UI subscribes via `useQuota()` to show how many
 * of the 100/day requests remain. Plain module state keeps it dependency-free.
 */
let current: RateLimitInfo | null = null;
const listeners = new Set<() => void>();

export function setRateLimit(info: RateLimitInfo | null | undefined) {
  // Only update when the proxy actually reported numbers.
  if (info && (info.limit != null || info.remaining != null)) {
    current = info;
    listeners.forEach((l) => l());
  }
}

export function getRateLimit(): RateLimitInfo | null {
  return current;
}

export function subscribeRateLimit(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

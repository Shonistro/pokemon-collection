import type { RateLimitInfo } from '../types';

/**
 * A tiny external store holding the latest daily rate-limit info PER upstream.
 * Every proxy response updates the budget for the API it hit, and the UI
 * subscribes via `useQuota(key)` to show how many requests remain.
 *
 *   - 'tcgapi'    — TCG API free tier (100/day). Drives the refresh-cap logic.
 *   - 'pokewallet'— PokéWallet free tier (1000/day). The Pokémon search fallback.
 *
 * Plain module state keeps it dependency-free.
 */
export type QuotaKey = 'tcgapi' | 'pokewallet';

const budgets: Record<QuotaKey, RateLimitInfo | null> = {
  tcgapi: null,
  pokewallet: null,
};
const listeners = new Set<() => void>();

export function setRateLimit(key: QuotaKey, info: RateLimitInfo | null | undefined) {
  // Only update when the proxy actually reported numbers.
  if (info && (info.limit != null || info.remaining != null)) {
    budgets[key] = info;
    listeners.forEach((l) => l());
  }
}

export function getRateLimit(key: QuotaKey): RateLimitInfo | null {
  return budgets[key];
}

export function subscribeRateLimit(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

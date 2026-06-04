import { useQuota } from '../hooks/useQuota';
import type { QuotaKey } from '../lib/quotaStore';

const META: Record<QuotaKey, { label: string; title: string }> = {
  tcgapi: {
    label: 'TCG API',
    title: 'TCG API requests remaining today (free tier: 100/day)',
  },
  pokewallet: {
    label: 'PokéWallet',
    title: 'PokéWallet requests remaining today (free tier: 1000/day, fallback for Pokémon)',
  },
};

/**
 * Shows the remaining daily quota for one upstream. Color shifts to amber/red as
 * the budget runs low (thresholds are relative to the limit, so it works for the
 * 100/day TCG API and the 1000/day PokéWallet alike). Hidden until the first
 * proxy call to that API this session reports numbers.
 */
export function QuotaIndicator({ provider = 'tcgapi' }: { provider?: QuotaKey }) {
  const quota = useQuota(provider);
  if (!quota || quota.remaining == null) return null;

  const { remaining, limit } = quota;
  const ratio = limit ? remaining / limit : 1;
  const low = ratio <= 0.1;
  const warn = ratio <= 0.25;

  const color = low
    ? 'text-down border-down/30 bg-down/10'
    : warn
      ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
      : 'text-white/60 border-white/10 bg-white/5';

  const { label, title } = META[provider];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}
      title={title}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label} {remaining}
      {limit != null ? `/${limit}` : ''} left
    </span>
  );
}

/** True when the TCG API quota is too low to safely spend more requests. */
export function useQuotaNearlyExhausted(threshold = 5): boolean {
  const quota = useQuota('tcgapi');
  return quota?.remaining != null && quota.remaining <= threshold;
}

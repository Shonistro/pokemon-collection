import { useQuota } from '../hooks/useQuota';

/**
 * Shows the remaining TCG API daily quota (100/day free tier). Color shifts to
 * amber/red as the budget runs low. Hidden until the first proxy call of the
 * session reports numbers.
 */
export function QuotaIndicator() {
  const quota = useQuota();
  if (!quota || quota.remaining == null) return null;

  const { remaining, limit } = quota;
  const low = remaining <= 10;
  const warn = remaining <= 25;

  const color = low
    ? 'text-down border-down/30 bg-down/10'
    : warn
      ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
      : 'text-white/60 border-white/10 bg-white/5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}
      title="TCG API requests remaining today (free tier: 100/day)"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      API {remaining}
      {limit != null ? `/${limit}` : ''} left
    </span>
  );
}

/** True when the quota is too low to safely spend more requests. */
export function useQuotaNearlyExhausted(threshold = 5): boolean {
  const quota = useQuota();
  return quota?.remaining != null && quota.remaining <= threshold;
}

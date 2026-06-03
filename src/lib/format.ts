import type { CollectionItem } from '../types';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Format a number as USD, with a graceful dash for null/undefined. */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return usd.format(value);
}

/**
 * The price we use for display/totals for a single copy of an item.
 * Prefer the cached market price; fall back to the manually-entered price,
 * then to the acquisition price. NEVER triggers an API call.
 */
export function effectiveUnitPrice(item: CollectionItem): number | null {
  return item.last_known_price ?? item.manual_price ?? item.acquired_price ?? null;
}

/** Total cached value of one collection row (unit price * quantity). */
export function itemValue(item: CollectionItem): number {
  const unit = effectiveUnitPrice(item);
  return unit != null ? unit * item.quantity : 0;
}

/** Total cached value across a collection (no API calls). */
export function collectionTotal(items: CollectionItem[]): number {
  return items.reduce((sum, item) => sum + itemValue(item), 0);
}

/**
 * Price change vs the previously-cached price (set on the last refresh).
 * Returns null when there's no prior price to compare against.
 */
export function priceChange(
  item: CollectionItem,
): { abs: number; pct: number } | null {
  const prev = item.previous_price;
  const cur = item.last_known_price;
  if (prev == null || cur == null) return null;
  const abs = cur - prev;
  const pct = prev !== 0 ? (abs / prev) * 100 : 0;
  return { abs, pct };
}

/** Format a signed percentage, e.g. +8.26% / -11.78%. */
export function formatPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

/** Relative "x days ago" style label for a timestamp. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

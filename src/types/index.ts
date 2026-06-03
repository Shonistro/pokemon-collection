import type { Database, Condition, GameSource, CardSource } from './database';

export type { Condition, GameSource, CardSource };

// Convenience row aliases pulled straight from the DB schema.
export type Game = Database['public']['Tables']['games']['Row'];
export type Card = Database['public']['Tables']['cards']['Row'];
export type CollectionRow = Database['public']['Tables']['collection']['Row'];

/** A collection entry joined with its card (and the card's game). */
export interface CollectionItem extends CollectionRow {
  card: Card & { game: Game };
}

/**
 * Normalized search result returned by any PriceProvider.
 * Mirrors the TCG API /v1/search item shape, but is provider-agnostic so the
 * ManualProvider can produce the same shape from our own `cards` table.
 */
export interface CardResult {
  /** External card id (TCG API `id`) or local card id for manual results. */
  externalId: string;
  name: string;
  setName: string | null;
  number: string | null;
  rarity: string | null;
  productType: string | null;
  printing: string | null;
  imageUrl: string | null;
  /** Primary price (TCG API `market_price`). May be null if unpriced. */
  marketPrice: number | null;
  lowPrice: number | null;
  medianPrice: number | null;
  totalListings: number | null;
}

/** Daily rate-limit info surfaced by the proxy so the UI can warn the user. */
export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset: string | null;
}

/** All conditions in display order, with human labels. */
export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'NM', label: 'Near Mint' },
  { value: 'LP', label: 'Lightly Played' },
  { value: 'MP', label: 'Moderately Played' },
  { value: 'HP', label: 'Heavily Played' },
  { value: 'DMG', label: 'Damaged' },
];

export const CONDITION_LABELS: Record<Condition, string> = CONDITIONS.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<Condition, string>,
);

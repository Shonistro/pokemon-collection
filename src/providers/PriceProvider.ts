import type { CardResult } from '../types';

/**
 * The pricing/catalog abstraction. Adding support for a new game means writing
 * a new PriceProvider and registering it (see registry.ts) — existing code is
 * never touched.
 */
export interface PriceProvider {
  /** Stable id, useful for debugging / logging. */
  readonly id: string;

  /** Search the catalog for cards matching `query` within a game (by slug). */
  searchCards(query: string, game: string): Promise<CardResult[]>;

  /**
   * Fetch the current price for a card by its external id.
   * Returns null when no price is available (e.g. manual games).
   */
  getPrice(externalId: string): Promise<number | null>;
}

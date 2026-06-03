import type { CardResult } from '../types';
import type { PriceProvider } from './PriceProvider';

/**
 * Tries a primary provider first, then a fallback. Search falls back when the
 * primary ERRORS (e.g. quota/network) OR returns no results — the latter also
 * improves coverage (e.g. tcgapi.dev's weak number search returns nothing, so
 * PokéWallet's native number search takes over).
 *
 * NOTE: price refresh does NOT go through here — it routes by each card's
 * stored `source` (see registry.getProviderBySource), since the two providers
 * use different id spaces.
 */
export class FallbackProvider implements PriceProvider {
  readonly id: string;

  constructor(
    private primary: PriceProvider,
    private fallback: PriceProvider,
  ) {
    this.id = `${primary.id}>${fallback.id}`;
  }

  async searchCards(query: string, game: string): Promise<CardResult[]> {
    let primaryResults: CardResult[] | null = null;
    let primaryErr: unknown = null;
    try {
      primaryResults = await this.primary.searchCards(query, game);
    } catch (e) {
      primaryErr = e;
    }
    if (primaryResults && primaryResults.length > 0) return primaryResults;

    // Primary empty or errored -> try the fallback.
    try {
      const fb = await this.fallback.searchCards(query, game);
      if (fb.length > 0) return fb;
      return primaryResults ?? [];
    } catch (e) {
      if (primaryResults) return primaryResults; // primary was OK-but-empty
      throw primaryErr ?? e; // both failed — surface an error
    }
  }

  async getPrice(externalId: string): Promise<number | null> {
    try {
      const p = await this.primary.getPrice(externalId);
      if (p != null) return p;
    } catch {
      /* fall through to fallback */
    }
    return this.fallback.getPrice(externalId);
  }
}

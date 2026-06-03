import type { CardSource, Game, GameSource } from '../types';
import type { PriceProvider } from './PriceProvider';
import { tcgApiProvider } from './TcgApiProvider';
import { manualProvider } from './ManualProvider';
import { pokeWalletProvider } from './PokeWalletProvider';
import { FallbackProvider } from './FallbackProvider';

/**
 * Provider selection.
 *
 * SEARCH: chosen per game.
 *   - 'pokemon' -> tcgapi.dev first, then PokéWallet as fallback.
 *   - other 'tcgapi' games -> TcgApiProvider.
 *   - 'manual' games -> ManualProvider.
 * Adding a new game/provider is purely additive.
 */

// Pokémon: try tcgapi.dev first, fall back to PokéWallet (native number search,
// 1000/day) on error or when tcgapi returns nothing.
const pokemonProvider = new FallbackProvider(tcgApiProvider, pokeWalletProvider);

const bySource: Record<GameSource, PriceProvider> = {
  tcgapi: tcgApiProvider,
  manual: manualProvider,
};

const slugProviders: Record<string, PriceProvider> = {
  pokemon: pokemonProvider,
};

/** Resolve the SEARCH provider for a game. Unknown/unsupported -> ManualProvider. */
export function getProviderForGame(game: Pick<Game, 'slug' | 'source'>): PriceProvider {
  return slugProviders[game.slug] ?? bySource[game.source] ?? manualProvider;
}

/**
 * Resolve the provider for refreshing a card's PRICE, by the card's stored
 * source. Manual cards have no API price (returns null -> skipped on refresh).
 */
export function getProviderBySource(source: CardSource): PriceProvider | null {
  switch (source) {
    case 'tcgapi':
      return tcgApiProvider;
    case 'pokewallet':
      return pokeWalletProvider;
    default:
      return null;
  }
}

import type { Game, GameSource } from '../types';
import type { PriceProvider } from './PriceProvider';
import { tcgApiProvider } from './TcgApiProvider';
import { manualProvider } from './ManualProvider';

/**
 * Provider selection.
 *
 * The default mapping keys off a game's `source`:
 *   'tcgapi' -> TcgApiProvider (proxy)
 *   'manual' -> ManualProvider
 *
 * `slugOverrides` lets you force a specific provider for a specific game slug
 * without touching anything else (e.g. a game that's technically on the TCG API
 * but you'd rather track manually). Adding a new provider is purely additive.
 */
const bySource: Record<GameSource, PriceProvider> = {
  tcgapi: tcgApiProvider,
  manual: manualProvider,
};

const slugOverrides: Record<string, PriceProvider> = {
  // 'riftbound': manualProvider,  // example override
};

/** Resolve the provider for a game. Unknown/unsupported -> ManualProvider. */
export function getProviderForGame(game: Pick<Game, 'slug' | 'source'>): PriceProvider {
  return slugOverrides[game.slug] ?? bySource[game.source] ?? manualProvider;
}

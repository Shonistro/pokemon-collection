import type { CardResult } from '../types';
import { callProxy } from '../lib/tcgProxy';
import type { PriceProvider } from './PriceProvider';

/**
 * PokéWallet price provider (Pokémon), accessed through the `tcg-proxy` Edge
 * Function. Used as the FALLBACK after TcgApiProvider — it natively searches by
 * collector number (e.g. "025/165") and has a generous 1000/day quota.
 *
 * Quota tracking is disabled on its proxy calls (`trackQuota: false`) so the
 * UI's quota indicator keeps showing the primary TCG API budget.
 *
 * Note: PokéWallet exposes images only via an authenticated endpoint, so search
 * results carry no image URL — cards added via this fallback show a placeholder
 * until you upload a photo.
 */
interface PwPrice {
  market_price?: number | string | null;
  low_price?: number | string | null;
  mid_price?: number | string | null;
  sub_type_name?: string | null;
}
interface PwCardInfo {
  name?: string;
  clean_name?: string;
  set_name?: string | null;
  card_number?: string | null;
  rarity?: string | null;
}
interface PwResult {
  id: string;
  card_info?: PwCardInfo;
  tcgplayer?: { prices?: PwPrice[]; url?: string };
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Best market price from a tcgplayer block (prefer market_price, else mid/low). */
function marketFrom(tcg?: { prices?: PwPrice[] }): number | null {
  const prices = tcg?.prices ?? [];
  for (const p of prices) {
    const m = num(p.market_price);
    if (m != null) return m;
  }
  for (const p of prices) {
    const m = num(p.mid_price ?? p.low_price);
    if (m != null) return m;
  }
  return null;
}

function toResult(r: PwResult): CardResult {
  const ci = r.card_info ?? {};
  const tp = r.tcgplayer?.prices?.[0] ?? {};
  return {
    externalId: String(r.id),
    source: 'pokewallet',
    name: ci.clean_name || ci.name || 'Unknown card',
    setName: ci.set_name ?? null,
    number: ci.card_number ?? null,
    rarity: ci.rarity ?? null,
    productType: null,
    printing: tp.sub_type_name ?? null,
    imageUrl: null, // no public image URL from PokéWallet search
    marketPrice: marketFrom(r.tcgplayer),
    lowPrice: num(tp.low_price),
    medianPrice: num(tp.mid_price),
    totalListings: null,
  };
}

function resultsArray(payload: unknown): PwResult[] {
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results as PwResult[];
    if (Array.isArray(o.data)) return o.data as PwResult[];
  }
  return [];
}

export class PokeWalletProvider implements PriceProvider {
  readonly id = 'pokewallet';

  async searchCards(query: string, _game: string): Promise<CardResult[]> {
    const payload = await callProxy<unknown>(
      'pw_search',
      { q: query, limit: 20 },
      { trackQuota: false },
    );
    return resultsArray(payload)
      .filter((r) => r && r.id)
      .map(toResult);
  }

  async getPrice(externalId: string): Promise<number | null> {
    const payload = await callProxy<Record<string, unknown>>(
      'pw_card',
      { id: externalId },
      { trackQuota: false },
    );
    // The card endpoint may return the object directly or wrapped.
    const card = (payload?.card ?? payload?.data ?? payload) as PwResult | undefined;
    return marketFrom(card?.tcgplayer);
  }
}

export const pokeWalletProvider = new PokeWalletProvider();

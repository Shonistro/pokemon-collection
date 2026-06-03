import type { CardResult } from '../types';
import { callProxy } from '../lib/tcgProxy';
import type { PriceProvider } from './PriceProvider';

/** Raw search item as returned by the TCG API (id is numeric in practice). */
interface TcgSearchItem {
  id: string | number;
  name: string;
  number?: string | null;
  set_name?: string | null;
  rarity?: string | null;
  product_type?: string | null;
  foil_only?: boolean | null;
  total_listings?: number | null;
  printing?: string | null;
  market_price?: number | null;
  low_price?: number | null;
  median_price?: number | null;
  lowest_with_shipping?: number | null;
  image_url?: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/**
 * Different endpoints may wrap their payload differently ([], {data:[]},
 * {results:[]}, ...). Normalize to a flat array.
 */
function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['data', 'results', 'cards', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function toCardResult(item: TcgSearchItem): CardResult {
  return {
    // The API returns numeric ids; store as string (external_id is a text column).
    externalId: String(item.id),
    name: item.name,
    setName: item.set_name ?? null,
    number: item.number ?? null,
    rarity: item.rarity ?? null,
    productType: item.product_type ?? null,
    printing: item.printing ?? null,
    imageUrl: item.image_url ?? null,
    marketPrice: num(item.market_price),
    lowPrice: num(item.low_price),
    medianPrice: num(item.median_price),
    totalListings: num(item.total_listings),
  };
}

/** Pull a usable market price out of the /prices payload (shape-tolerant). */
function extractMarketPrice(payload: unknown): number | null {
  // Single object with market_price.
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    const direct = num(obj.market_price ?? obj.median_price ?? obj.low_price);
    if (direct != null) return direct;
  }
  // Array of printings — take the first that has a price.
  for (const row of asArray<Record<string, unknown>>(payload)) {
    const p = num(row.market_price ?? row.median_price ?? row.low_price);
    if (p != null) return p;
  }
  return null;
}

// A full collector number with a slash: "098/088", "TG12/TG30", "GG01/GG70",
// "SV001/SV198". Must contain at least one digit so plain "a/b" text isn't caught.
const FULL_NUMBER_RE = /^[A-Za-z0-9]{1,6}\s*\/\s*[A-Za-z0-9]{1,6}$/;

/** True when the query looks like a full collector number. */
export function isFullNumber(query: string): boolean {
  const q = query.trim();
  return FULL_NUMBER_RE.test(q) && /\d/.test(q);
}

/**
 * The term we actually send to the API. The full-text search matches the bare
 * numerator ("098", "TG12") but NOT the slash form, so for a full number we send
 * just the part before the slash and filter for the exact match afterwards.
 * Plain name queries pass through unchanged.
 */
export function normalizeQuery(query: string): string {
  const q = query.trim();
  return isFullNumber(q) ? q.split('/')[0].trim() : q;
}

/** Canonical number key: lowercase, no spaces, leading-zero-insensitive. */
function canonicalNumber(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) ? String(parseInt(seg, 10)) : seg))
    .join('/');
}

/**
 * PriceProvider backed by the TCG API, accessed exclusively through the
 * `tcg-proxy` Edge Function. Used for every game with source 'tcgapi'.
 */
export class TcgApiProvider implements PriceProvider {
  readonly id = 'tcgapi';

  async searchCards(query: string, game: string): Promise<CardResult[]> {
    const raw = query.trim();
    const payload = await callProxy<unknown>('search', { q: normalizeQuery(raw), game });
    const results = asArray<TcgSearchItem>(payload)
      .filter((i) => i && i.id && i.name)
      .map(toCardResult);

    // For a full number like "098/088", the numerator search returns every card
    // containing "098" (098/086, 098/193, 030/098, ...). Narrow to the exact
    // collector number so the user gets the card they actually asked for.
    if (isFullNumber(raw)) {
      const want = canonicalNumber(raw);
      const exact = results.filter(
        (r) => r.number != null && canonicalNumber(r.number) === want,
      );
      // Prefer the exact collector-number match; if none (e.g. the card isn't in
      // the numerator results), fall back to the broader list instead of showing
      // an empty screen.
      return exact.length > 0 ? exact : results;
    }

    return results;
  }

  async getPrice(externalId: string): Promise<number | null> {
    const payload = await callProxy<unknown>('prices', { id: externalId });
    return extractMarketPrice(payload);
  }
}

export const tcgApiProvider = new TcgApiProvider();

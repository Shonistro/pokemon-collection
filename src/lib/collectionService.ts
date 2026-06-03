import { supabase } from './supabase';
import { tcgApiProvider } from '../providers/TcgApiProvider';
import type { CardSource, Condition, CollectionItem, GameSource } from '../types';

/**
 * All collection-mutating DB logic lives here so React components stay thin.
 * Nothing in this file calls the TCG API except `refreshPrices`, which is only
 * ever triggered by the explicit "Refresh prices" button.
 */

const SELECT_COLLECTION = `
  id, user_id, card_id, condition, quantity,
  acquired_price, manual_price, last_known_price, previous_price, price_updated_at, is_favorite, created_at,
  card:cards!inner (
    id, game_id, name, set_name, number, image_url, external_id, source, created_at,
    game:games!inner ( id, slug, name, source, created_at )
  )
`;

/** Fetch the current user's full collection (cards + games joined). */
export async function fetchCollection(): Promise<CollectionItem[]> {
  const { data, error } = await supabase
    .from('collection')
    .select(SELECT_COLLECTION)
    .order('created_at', { ascending: false });

  if (error) throw error;
  // Supabase types embedded relations as arrays; our FKs are to-one.
  return (data ?? []) as unknown as CollectionItem[];
}

/** Ensure a game row exists (idempotent by slug); returns its id. */
async function resolveGameId(game: {
  slug: string;
  name: string;
  source: GameSource;
}): Promise<string> {
  const { data, error } = await supabase
    .from('games')
    .upsert(
      { slug: game.slug, name: game.name, source: game.source },
      { onConflict: 'slug', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

type CardRef =
  | { kind: 'local'; id: string }
  | {
      kind: 'catalog';
      externalId: string | null;
      name: string;
      setName: string | null;
      number: string | null;
      imageUrl: string | null;
      source: CardSource;
    };

/** Ensure a card row exists; returns its id. Dedupes TCG cards by external id. */
async function resolveCardId(gameId: string, card: CardRef): Promise<string> {
  if (card.kind === 'local') return card.id;

  // For TCG-API cards, reuse an existing row if we already imported it.
  if (card.externalId) {
    const { data: existing, error: selErr } = await supabase
      .from('cards')
      .select('id')
      .eq('game_id', gameId)
      .eq('external_id', card.externalId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) return existing.id;
  }

  const { data, error } = await supabase
    .from('cards')
    .insert({
      game_id: gameId,
      name: card.name,
      set_name: card.setName,
      number: card.number,
      image_url: card.imageUrl,
      external_id: card.externalId,
      source: card.source,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export interface AddToCollectionParams {
  game: { slug: string; name: string; source: GameSource };
  card: CardRef;
  condition: Condition;
  quantity: number;
  acquiredPrice: number | null;
  /** Cached market price for TCG cards (-> last_known_price). */
  marketPrice: number | null;
  /** User-entered price for manual cards. */
  manualPrice: number | null;
}

/**
 * Add copies to the collection. If a row already exists for the same
 * (card, condition), the quantity is incremented and the cached price refreshed.
 */
export async function addToCollection(params: AddToCollectionParams): Promise<void> {
  const gameId = await resolveGameId(params.game);
  const cardId = await resolveCardId(gameId, params.card);

  const cachedPrice = params.marketPrice ?? params.manualPrice ?? null;
  const nowIso = new Date().toISOString();

  // Is this card+condition already in the collection?
  const { data: existing, error: selErr } = await supabase
    .from('collection')
    .select('id, quantity')
    .eq('card_id', cardId)
    .eq('condition', params.condition)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const { error } = await supabase
      .from('collection')
      .update({
        quantity: existing.quantity + params.quantity,
        last_known_price: cachedPrice,
        manual_price: params.manualPrice,
        price_updated_at: cachedPrice != null ? nowIso : null,
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('collection').insert({
    card_id: cardId,
    condition: params.condition,
    quantity: params.quantity,
    acquired_price: params.acquiredPrice,
    manual_price: params.manualPrice,
    last_known_price: cachedPrice,
    price_updated_at: cachedPrice != null ? nowIso : null,
    // user_id defaults to auth.uid() at the DB level.
  });
  if (error) throw error;
}

/** Set a collection row's quantity. Quantity <= 0 deletes the row. */
export async function setQuantity(itemId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return removeItem(itemId);
  const { error } = await supabase
    .from('collection')
    .update({ quantity })
    .eq('id', itemId);
  if (error) throw error;
}

export async function removeItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('collection').delete().eq('id', itemId);
  if (error) throw error;
}

/** Star / unstar a collection entry (favorites pin to the top of the gallery). */
export async function setFavorite(itemId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('collection')
    .update({ is_favorite: value })
    .eq('id', itemId);
  if (error) throw error;
}

/** Replace a card's image (e.g. after uploading a custom photo to Storage). */
export async function updateCardImage(cardId: string, imageUrl: string): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .update({ image_url: imageUrl })
    .eq('id', cardId);
  if (error) throw error;
}

/** Set a manual/cached price for one collection row (used for manual cards). */
export async function updateManualPrice(itemId: string, price: number | null): Promise<void> {
  const { error } = await supabase
    .from('collection')
    .update({
      manual_price: price,
      last_known_price: price,
      price_updated_at: price != null ? new Date().toISOString() : null,
    })
    .eq('id', itemId);
  if (error) throw error;
}

export interface RefreshOptions {
  /** Skip cards whose price was refreshed more recently than this many hours. */
  staleHours?: number;
  /** Cap the number of distinct API calls this run (e.g. remaining quota). */
  maxRequests?: number;
}

export interface RefreshResult {
  eligible: number; // distinct stale TCG cards that could be refreshed
  requested: number; // distinct API calls actually attempted (after the cap)
  updated: number; // collection rows updated
  skippedFresh: number; // cards skipped because recently refreshed
  deferred: number; // eligible cards left for next time due to the cap
  errors: string[];
}

interface CardGroup {
  id: string; // external_id
  rowIds: string[];
  lastUpdated: number; // ms; 0 = never priced
  oldPrice: number | null; // representative current price (becomes previous_price)
}

/** Group TCG-API items by external id (one API call serves all its copies). */
function groupTcgCards(items: CollectionItem[]): CardGroup[] {
  const map = new Map<string, CardGroup>();
  for (const i of items) {
    if (i.card.source !== 'tcgapi' || !i.card.external_id) continue;
    const id = i.card.external_id;
    const g = map.get(id) ?? { id, rowIds: [], lastUpdated: 0, oldPrice: null };
    g.rowIds.push(i.id);
    const ts = i.price_updated_at ? new Date(i.price_updated_at).getTime() : 0;
    g.lastUpdated = Math.max(g.lastUpdated, ts);
    if (g.oldPrice == null) g.oldPrice = i.last_known_price;
    map.set(id, g);
  }
  return Array.from(map.values());
}

const isFresh = (g: CardGroup, staleMs: number) =>
  staleMs > 0 && g.lastUpdated > 0 && Date.now() - g.lastUpdated < staleMs;

/** How many distinct cards a refresh would actually touch (UI preview/cost). */
export function distinctStaleTcgCards(items: CollectionItem[], staleHours: number): number {
  const staleMs = staleHours * 3_600_000;
  return groupTcgCards(items).filter((g) => !isFresh(g, staleMs)).length;
}

/**
 * Re-fetch prices through the proxy and update the cache — built to SAVE quota:
 *   - manual cards are skipped (no API price);
 *   - calls are DEDUPED by card (all copies/conditions share one call);
 *   - cards refreshed within `staleHours` are skipped (no point re-asking);
 *   - oldest-priced cards go first, capped at `maxRequests` (e.g. remaining quota);
 *   - the old price is saved to previous_price so we can show % change.
 * Runs sequentially to be gentle on the 100/day limit.
 */
export async function refreshPrices(
  items: CollectionItem[],
  opts: RefreshOptions = {},
): Promise<RefreshResult> {
  const { staleHours = 0, maxRequests = Infinity } = opts;
  const staleMs = staleHours * 3_600_000;

  const all = groupTcgCards(items);
  const skippedFresh = all.filter((g) => isFresh(g, staleMs)).length;

  // Eligible = stale (or never priced), oldest first.
  const eligible = all
    .filter((g) => !isFresh(g, staleMs))
    .sort((a, b) => a.lastUpdated - b.lastUpdated);

  const toRefresh = Number.isFinite(maxRequests) ? eligible.slice(0, maxRequests) : eligible;

  const result: RefreshResult = {
    eligible: eligible.length,
    requested: 0,
    updated: 0,
    skippedFresh,
    deferred: eligible.length - toRefresh.length,
    errors: [],
  };

  for (const g of toRefresh) {
    result.requested += 1;
    try {
      const price = await tcgApiProvider.getPrice(g.id);
      if (price == null) continue;

      const { error } = await supabase
        .from('collection')
        .update({
          previous_price: g.oldPrice, // keep the old value for % change
          last_known_price: price,
          price_updated_at: new Date().toISOString(),
        })
        .in('id', g.rowIds);

      if (error) throw error;
      result.updated += g.rowIds.length;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}

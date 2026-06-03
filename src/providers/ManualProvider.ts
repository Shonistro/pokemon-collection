import type { CardResult } from '../types';
import { supabase } from '../lib/supabase';
import type { PriceProvider } from './PriceProvider';

/**
 * PriceProvider for games NOT on the TCG API. It searches our OWN `cards` table
 * (source = 'manual') so previously-entered cards are findable, and reads back
 * the user-entered price. New manual cards are created via the manual add form,
 * not here.
 *
 * `externalId` for manual results is the local `cards.id` (there is no upstream
 * id). Prices are never auto-fetched — getPrice returns the user's own entry.
 */
export class ManualProvider implements PriceProvider {
  readonly id = 'manual';

  async searchCards(query: string, game: string): Promise<CardResult[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('id, name, set_name, number, image_url, games!inner(slug)')
      .eq('source', 'manual')
      .eq('games.slug', game)
      .ilike('name', `%${query}%`)
      .limit(50);

    if (error) throw error;

    return (data ?? []).map((c) => ({
      externalId: c.id,
      source: 'manual' as const,
      name: c.name,
      setName: c.set_name,
      number: c.number,
      rarity: null,
      productType: null,
      printing: null,
      imageUrl: c.image_url,
      // Price is entered per-copy on add; not known at search time.
      marketPrice: null,
      lowPrice: null,
      medianPrice: null,
      totalListings: null,
    }));
  }

  async getPrice(externalId: string): Promise<number | null> {
    // Return the user's most recent manually-entered price for this card.
    const { data, error } = await supabase
      .from('collection')
      .select('manual_price')
      .eq('card_id', externalId)
      .not('manual_price', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.manual_price ?? null;
  }
}

export const manualProvider = new ManualProvider();

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { callProxy } from '../lib/tcgProxy';
import type { Game, GameSource } from '../types';

/** A game option for the selector (may not yet exist as a DB row). */
export interface GameOption {
  slug: string;
  name: string;
  source: GameSource;
}

interface TcgGame {
  slug?: string;
  id?: string;
  name?: string;
}

function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['data', 'results', 'games', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

/** Games already stored in our DB (manual + previously-imported TCG games). */
async function fetchDbGames(): Promise<Game[]> {
  const { data, error } = await supabase.from('games').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

/**
 * The full list of selectable games: our DB games merged with the TCG API's
 * catalog (/v1/games, a public/no-key endpoint). The TCG list is cached
 * indefinitely for the session so we don't refetch it repeatedly.
 *
 * DB games win on slug conflicts, so a manual override (e.g. tracking a game
 * manually that's technically on the API) is respected.
 */
export function useGames() {
  const dbQuery = useQuery({ queryKey: ['games', 'db'], queryFn: fetchDbGames });

  const tcgQuery = useQuery({
    queryKey: ['games', 'tcg'],
    queryFn: () => callProxy<unknown>('games'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    // A failure here (e.g. proxy not deployed yet) shouldn't break the page;
    // we still have DB/manual games.
  });

  const merged = mergeGames(dbQuery.data, tcgQuery.data);

  return {
    games: merged,
    isLoading: dbQuery.isLoading,
    dbGames: dbQuery.data ?? [],
    tcgError: tcgQuery.error as Error | null,
  };
}

function mergeGames(dbGames: Game[] | undefined, tcgPayload: unknown): GameOption[] {
  const bySlug = new Map<string, GameOption>();

  for (const g of asArray<TcgGame>(tcgPayload)) {
    const slug = g.slug ?? g.id;
    if (!slug || !g.name) continue;
    bySlug.set(slug, { slug, name: g.name, source: 'tcgapi' });
  }

  // DB rows take precedence (and add manual games).
  for (const g of dbGames ?? []) {
    bySlug.set(g.slug, { slug: g.slug, name: g.name, source: g.source });
  }

  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Favorite games, pinned to the top of the game picker so you don't scroll to
 * find Pokémon / Riftbound every time. Stored in localStorage (per-device) —
 * no DB round-trip, instant. Keyed by game slug.
 */
const KEY = 'favoriteGames';
const listeners = new Set<() => void>();
let cache: string[] = read();

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(next: string[]) {
  cache = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function useFavoriteGames() {
  const favorites = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cache,
    () => cache,
  );

  const toggle = useCallback((slug: string) => {
    write(cache.includes(slug) ? cache.filter((s) => s !== slug) : [...cache, slug]);
  }, []);

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites]);

  return { favorites, toggle, isFavorite };
}

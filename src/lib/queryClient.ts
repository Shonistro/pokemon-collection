import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared React Query client.
 *
 * Defaults are deliberately conservative because our pricing data is
 * EXPENSIVE to fetch (TCG API allows only 100 requests/day). We never refetch
 * automatically — prices are only updated when the user explicitly asks.
 * Collection/catalog reads come from Supabase (cheap) and can be refetched.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't hammer the network on focus/reconnect.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      // Supabase reads are cheap; keep them fresh-ish but cached.
      staleTime: 30_000,
    },
  },
});

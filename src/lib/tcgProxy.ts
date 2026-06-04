import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { RateLimitInfo } from '../types';
import { setRateLimit, type QuotaKey } from './quotaStore';

/** Actions accepted by the `tcg-proxy` Edge Function (must match its whitelist). */
export type ProxyAction =
  | 'games'
  | 'sets'
  | 'search'
  | 'card'
  | 'prices'
  | 'pw_search'
  | 'pw_card'
  | 'pw_image';

/** PokéWallet actions bill against a separate daily budget from the TCG API. */
const PW_ACTIONS = new Set<ProxyAction>(['pw_search', 'pw_card', 'pw_image']);
function quotaKeyFor(action: ProxyAction): QuotaKey {
  return PW_ACTIONS.has(action) ? 'pokewallet' : 'tcgapi';
}

interface ProxyEnvelope<T> {
  data: T;
  rateLimit?: RateLimitInfo;
  error?: string;
}

/**
 * Call the `tcg-proxy` Edge Function. This is the ONLY path to the card APIs
 * from the client — the API keys never leave the server. Every call records the
 * returned rate-limit info under the matching budget ('tcgapi' or 'pokewallet')
 * so the UI can warn near each limit.
 *
 * NOTE: callers are responsible for rate discipline — only invoke this on an
 * explicit user action (search to add, or refresh prices), never on render.
 */
export async function callProxy<T>(
  action: ProxyAction,
  params: Record<string, unknown> = {},
): Promise<T> {
  const quotaKey = quotaKeyFor(action);
  const { data, error } = await supabase.functions.invoke<ProxyEnvelope<T>>('tcg-proxy', {
    body: { action, params },
  });

  if (error) {
    // Non-2xx from the function: try to surface its JSON { error } message.
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) message = body.error;
      if (body?.rateLimit) setRateLimit(quotaKey, body.rateLimit);
    }
    throw new Error(message);
  }

  if (data?.rateLimit) setRateLimit(quotaKey, data.rateLimit);
  if (!data) throw new Error('Empty proxy response');
  return data.data;
}

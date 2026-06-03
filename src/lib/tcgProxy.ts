import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { RateLimitInfo } from '../types';
import { setRateLimit } from './quotaStore';

/** Actions accepted by the `tcg-proxy` Edge Function (must match its whitelist). */
export type ProxyAction = 'games' | 'sets' | 'search' | 'card' | 'prices';

interface ProxyEnvelope<T> {
  data: T;
  rateLimit?: RateLimitInfo;
  error?: string;
}

/**
 * Call the `tcg-proxy` Edge Function. This is the ONLY path to the TCG API from
 * the client — the API key never leaves the server. Every call records the
 * returned rate-limit info in the quota store so the UI can warn near the limit.
 *
 * NOTE: callers are responsible for rate discipline — only invoke this on an
 * explicit user action (search to add, or refresh prices), never on render.
 */
export async function callProxy<T>(
  action: ProxyAction,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<ProxyEnvelope<T>>('tcg-proxy', {
    body: { action, params },
  });

  if (error) {
    // Non-2xx from the function: try to surface its JSON { error } message.
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) message = body.error;
      if (body?.rateLimit) setRateLimit(body.rateLimit);
    }
    throw new Error(message);
  }

  if (data?.rateLimit) setRateLimit(data.rateLimit);
  if (!data) throw new Error('Empty proxy response');
  return data.data;
}

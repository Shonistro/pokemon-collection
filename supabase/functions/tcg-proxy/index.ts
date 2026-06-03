// ============================================================================
// tcg-proxy — Supabase Edge Function (Deno)
//
// A NARROW proxy in front of two card APIs:
//   • TCG API   (https://api.tcgapi.dev)        — primary, all games. Key: TCG_API_KEY
//   • PokéWallet (https://api.pokewallet.io)     — Pokémon fallback.   Key: POKEWALLET_API_KEY
//
// Why this exists:
//  • API keys must NEVER reach the browser — they live only as function secrets
//    and are attached here, server-side.
//  • Only authenticated Supabase users may call it (JWT verified), so randoms
//    can't burn the shared daily quotas.
//  • Only a fixed WHITELIST of endpoints is reachable — not an open proxy.
//
// Request  (POST JSON):  { "action": "search", "params": { ... } }
// Response (JSON):       { "data": <api json>, "rateLimit": {...} }
//
// Secrets:  supabase secrets set TCG_API_KEY=...  POKEWALLET_API_KEY=pk_live_...
// Deploy:   supabase functions deploy tcg-proxy
// ============================================================================

// @ts-nocheck — this file runs on Deno (edge), not in the Vite/DOM build.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TCG_BASE = 'https://api.tcgapi.dev';
const PW_BASE = 'https://api.pokewallet.io';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action =
  | 'games'
  | 'sets'
  | 'search'
  | 'card'
  | 'prices'
  | 'pw_search'
  | 'pw_card'
  | 'pw_image';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Map a whitelisted action to an upstream URL + which secret key it needs. */
function buildRequest(action: Action, params: Record<string, unknown>): {
  url: string;
  keyEnv: string | null;
} {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const id = () => {
    const v = str(params.id);
    if (!v) throw new HttpError(400, 'Missing "id"');
    return v;
  };

  switch (action) {
    // ---- TCG API (api.tcgapi.dev) ----
    case 'games':
      return { url: `${TCG_BASE}/v1/games`, keyEnv: null };
    case 'sets': {
      const slug = str(params.slug);
      if (!slug) throw new HttpError(400, 'Missing "slug"');
      return { url: `${TCG_BASE}/v1/games/${encodeURIComponent(slug)}/sets`, keyEnv: null };
    }
    case 'search': {
      const q = str(params.q);
      if (!q) throw new HttpError(400, 'Missing "q"');
      const qs = new URLSearchParams({ q });
      const game = str(params.game);
      if (game) qs.set('game', game);
      return { url: `${TCG_BASE}/v1/search?${qs}`, keyEnv: 'TCG_API_KEY' };
    }
    case 'card':
      return { url: `${TCG_BASE}/v1/cards/${encodeURIComponent(id())}`, keyEnv: 'TCG_API_KEY' };
    case 'prices':
      return {
        url: `${TCG_BASE}/v1/cards/${encodeURIComponent(id())}/prices`,
        keyEnv: 'TCG_API_KEY',
      };

    // ---- PokéWallet (api.pokewallet.io) ----
    case 'pw_search': {
      const q = str(params.q);
      if (!q) throw new HttpError(400, 'Missing "q"');
      // Cap the page size: PokéWallet bills per request (not per card), but we
      // keep responses small for speed.
      const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 50);
      const qs = new URLSearchParams({ q, limit: String(limit) });
      return { url: `${PW_BASE}/search?${qs}`, keyEnv: 'POKEWALLET_API_KEY' };
    }
    case 'pw_card':
      return { url: `${PW_BASE}/cards/${encodeURIComponent(id())}`, keyEnv: 'POKEWALLET_API_KEY' };

    default:
      throw new HttpError(400, `Unknown action: ${action}`);
  }
}

/** Pull rate-limit info from upstream headers (handles both APIs' header names). */
function readRateLimit(res: Response) {
  const num = (...names: string[]) => {
    for (const n of names) {
      const v = res.headers.get(n);
      if (v != null) return Number(v);
    }
    return null;
  };
  return {
    limit: num('x-ratelimit-limit', 'x-ratelimit-limit-day', 'ratelimit-limit'),
    remaining: num('x-ratelimit-remaining', 'x-ratelimit-remaining-day', 'ratelimit-remaining'),
    reset: res.headers.get('x-ratelimit-reset') ?? res.headers.get('x-ratelimit-reset-day'),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Special action: fetch a PokéWallet card image (auth'd binary endpoint) on the
 * server, cache it in Supabase Storage, and return a PUBLIC url. This is how
 * PokéWallet-sourced cards get an image without ever exposing the API key.
 */
async function handlePwImage(params: Record<string, unknown>) {
  const id = (typeof params.id === 'string' ? params.id : '').trim();
  if (!id) return json({ error: 'Missing "id"' }, 400);

  const apiKey = Deno.env.get('POKEWALLET_API_KEY');
  if (!apiKey) return json({ error: 'Server is missing POKEWALLET_API_KEY secret' }, 500);

  const img = await fetch(`${PW_BASE}/images/${encodeURIComponent(id)}?size=high`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!img.ok) return json({ error: `Image fetch failed (${img.status})` }, img.status);

  const contentType = img.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const bytes = new Uint8Array(await img.arrayBuffer());

  // Service-role client bypasses Storage RLS; cache under a shared path so the
  // same card image is reused across users.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `pokewallet/${safe}.${ext}`;

  const { error: upErr } = await admin.storage
    .from('card-images')
    .upload(path, bytes, { contentType, upsert: true });
  if (upErr) return json({ error: `Storage upload failed: ${upErr.message}` }, 500);

  const { data } = admin.storage.from('card-images').getPublicUrl(path);
  return json({ data: { url: data.publicUrl } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // --- 1) Require an authenticated Supabase user ---
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing Authorization header' }, 401);
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    // --- 2) Parse + whitelist ---
    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    const params = (body?.params ?? {}) as Record<string, unknown>;
    if (!action) return json({ error: 'Missing "action"' }, 400);

    // Image caching is a special flow (fetch binary -> Storage -> public URL).
    if (action === 'pw_image') return await handlePwImage(params);

    const { url, keyEnv } = buildRequest(action, params);

    // --- 3) Attach the right key (server-side) ---
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (keyEnv) {
      const apiKey = Deno.env.get(keyEnv);
      if (!apiKey) return json({ error: `Server is missing ${keyEnv} secret` }, 500);
      headers['X-API-Key'] = apiKey;
    }

    // --- 4) Forward upstream ---
    const upstream = await fetch(url, { method: 'GET', headers });
    const rateLimit = readRateLimit(upstream);
    const text = await upstream.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!upstream.ok) {
      return json({ error: `Upstream error (${upstream.status})`, data, rateLimit }, upstream.status);
    }
    return json({ data, rateLimit });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error('tcg-proxy error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});

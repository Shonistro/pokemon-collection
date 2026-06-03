// ============================================================================
// tcg-proxy — Supabase Edge Function (Deno)
//
// A NARROW proxy in front of the TCG API (https://api.tcgapi.dev).
//
// Why this exists:
//  * The TCG API key must NEVER reach the browser. It lives only as the
//    function secret `TCG_API_KEY` and is attached here, server-side.
//  * Only authenticated Supabase users may call it (we verify their JWT), so
//    randoms can't burn the shared 100 requests/day quota.
//  * Only a fixed WHITELIST of endpoints is reachable — this is not an open
//    proxy.
//
// Request  (POST, JSON body):  { "action": "search", "params": { ... } }
// Response (JSON):             { "data": <tcg api json>, "rateLimit": {...} }
//
// Deploy:   supabase functions deploy tcg-proxy
// Secret:   supabase secrets set TCG_API_KEY=tcg_live_xxx
// ============================================================================

// @ts-nocheck — this file runs on Deno (edge), not in the Vite/DOM build.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TCG_BASE_URL = 'https://api.tcgapi.dev';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Whitelisted actions -> how to build the upstream request. */
type Action = 'games' | 'sets' | 'search' | 'card' | 'prices';

interface BuiltRequest {
  path: string;
  /** Whether this endpoint requires the X-API-Key header. */
  needsKey: boolean;
}

function buildRequest(action: Action, params: Record<string, unknown>): BuiltRequest {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  switch (action) {
    case 'games':
      // GET /v1/games — public, no key.
      return { path: '/v1/games', needsKey: false };

    case 'sets': {
      // GET /v1/games/:slug/sets — public.
      const slug = str(params.slug);
      if (!slug) throw new HttpError(400, 'Missing "slug"');
      return { path: `/v1/games/${encodeURIComponent(slug)}/sets`, needsKey: false };
    }

    case 'search': {
      // GET /v1/search?q=&game= — needs key.
      const q = str(params.q);
      const game = str(params.game);
      if (!q) throw new HttpError(400, 'Missing "q"');
      const qs = new URLSearchParams({ q });
      if (game) qs.set('game', game);
      return { path: `/v1/search?${qs.toString()}`, needsKey: true };
    }

    case 'card': {
      // GET /v1/cards/:id — needs key.
      const id = str(params.id);
      if (!id) throw new HttpError(400, 'Missing "id"');
      return { path: `/v1/cards/${encodeURIComponent(id)}`, needsKey: true };
    }

    case 'prices': {
      // GET /v1/cards/:id/prices — needs key.
      const id = str(params.id);
      if (!id) throw new HttpError(400, 'Missing "id"');
      return { path: `/v1/cards/${encodeURIComponent(id)}/prices`, needsKey: true };
    }

    default:
      throw new HttpError(400, `Unknown action: ${action}`);
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Pull rate-limit info from upstream response headers (best-effort). */
function readRateLimit(res: Response) {
  const num = (name: string) => {
    const v = res.headers.get(name);
    return v == null ? null : Number(v);
  };
  return {
    limit: num('x-ratelimit-limit') ?? num('ratelimit-limit'),
    remaining: num('x-ratelimit-remaining') ?? num('ratelimit-remaining'),
    reset: res.headers.get('x-ratelimit-reset') ?? res.headers.get('ratelimit-reset'),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // --- 1) Require an authenticated Supabase user -------------------------
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
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // --- 2) Validate the API key secret is configured ----------------------
    const apiKey = Deno.env.get('TCG_API_KEY');
    if (!apiKey) {
      return json({ error: 'Server is missing TCG_API_KEY secret' }, 500);
    }

    // --- 3) Parse + whitelist the request ----------------------------------
    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    const params = (body?.params ?? {}) as Record<string, unknown>;
    if (!action) return json({ error: 'Missing "action"' }, 400);

    const { path, needsKey } = buildRequest(action, params);

    // --- 4) Forward to the TCG API -----------------------------------------
    const upstreamHeaders: Record<string, string> = { Accept: 'application/json' };
    if (needsKey) upstreamHeaders['X-API-Key'] = apiKey;

    const upstream = await fetch(`${TCG_BASE_URL}${path}`, {
      method: 'GET',
      headers: upstreamHeaders,
    });

    const rateLimit = readRateLimit(upstream);
    const text = await upstream.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text; // non-JSON body; pass through as-is
    }

    if (!upstream.ok) {
      return json(
        { error: `TCG API error (${upstream.status})`, data, rateLimit },
        upstream.status,
      );
    }

    return json({ data, rateLimit });
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status);
    }
    console.error('tcg-proxy error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});

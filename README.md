# Card Collection Tracker

A personal trading-card collection tracker (à la Collectr) for **Pokémon**,
**Riftbound (League of Legends TCG)**, and any of the 89+ games supported by the
[TCG API](https://tcgapi.dev). Built for personal use by two people, running
entirely on free tiers.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Data fetching:** TanStack Query
- **Routing:** React Router
- **Backend / DB / Auth / Storage:** Supabase (free tier)
- **Pricing/catalog:** TCG API, proxied through a Supabase **Edge Function**
- **Hosting:** Vercel

---

## How pricing data works (read this first)

The TCG API free tier allows **100 requests/day**. The whole app is designed
around that hard limit:

- The TCG API is called **only** when you (a) **search** to add a card, or
  (b) explicitly **refresh prices**. Never on render, never in loops.
- Every fetched price is **cached** in the database (`last_known_price`). The
  collection view and total value are computed **entirely from the cache** — no
  API calls just to display.
- The TCG API key is **never** in the browser. It lives only as a Supabase
  **Edge Function secret**, and all TCG calls are proxied through the
  `tcg-proxy` function, which also **verifies the user's JWT** so randoms can't
  burn the quota.
- The proxy returns the API's **rate-limit info** so the UI can show how many of
  the 100 daily requests remain and disable refresh when it's too low.

---

## Project structure

```
.
├── src/
│   ├── main.tsx                 # App bootstrap (Router + React Query + Auth)
│   ├── App.tsx                  # Routes (protected vs /login)
│   ├── lib/
│   │   ├── supabase.ts          # Browser Supabase client (anon key only)
│   │   ├── tcgProxy.ts          # callProxy() -> invokes the Edge Function
│   │   ├── quotaStore.ts        # Tracks remaining daily API quota
│   │   ├── collectionService.ts # All collection DB reads/writes + refresh
│   │   ├── storage.ts           # Upload custom card photos to Storage
│   │   └── format.ts            # Currency / value helpers (cache-only totals)
│   ├── providers/
│   │   ├── PriceProvider.ts     # interface { searchCards, getPrice }
│   │   ├── TcgApiProvider.ts    # via the proxy (all TCG-API games)
│   │   ├── ManualProvider.ts    # searches our own cards table
│   │   └── registry.ts          # game -> provider map (default: manual)
│   ├── hooks/                   # useCollection, useGames, useQuota
│   ├── context/AuthContext.tsx  # Supabase session + sign in/up/out
│   ├── components/              # Layout, NavBar, CardTile, QuotaIndicator, ...
│   ├── pages/                   # Login, Collection, AddCard, CardDetail
│   └── types/                   # database.ts (schema) + domain types
├── supabase/
│   ├── config.toml              # Edge function config (verify_jwt)
│   ├── migrations/              # 0001 schema, 0002 RLS, 0003 storage
│   └── functions/tcg-proxy/     # The Deno Edge Function (the API proxy)
├── .env.example                 # Frontend env (SAFE — no secrets)
└── vercel.json                  # SPA rewrites for Vercel
```

### The PriceProvider abstraction

Adding a new game never touches existing code:

```ts
interface PriceProvider {
  searchCards(query: string, game: string): Promise<CardResult[]>;
  getPrice(externalId: string): Promise<number | null>;
}
```

`registry.ts` maps a game to a provider by its `source` (`tcgapi` →
`TcgApiProvider`, `manual` → `ManualProvider`), with optional per-slug
overrides. Unsupported games default to `ManualProvider`.

---

## 1. Prerequisites

- Node.js 18+ (this repo was built/tested on Node 22)
- A free [Supabase](https://supabase.com) project
- A free [TCG API](https://tcgapi.dev) key (see step 5)
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (for migrations +
  deploying the Edge Function):

  ```bash
  npm install -g supabase
  ```

---

## 2. Supabase setup

1. Create a project at <https://supabase.com>. Note your **Project URL** and
   **anon/publishable key** from **Project Settings → API**.
2. Link the CLI to your project (find the ref in the dashboard URL):

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

---

## 3. Run the migrations + RLS

The SQL in `supabase/migrations/` creates the `games`, `cards`, and `collection`
tables, enables **Row-Level Security**, and creates the Storage bucket.

**Option A — Supabase CLI (recommended):**

```bash
supabase db push
```

**Option B — SQL editor:** open each file in `supabase/migrations/` in order
(`0001`, `0002`, `0003`) and run it in the Supabase dashboard **SQL Editor**.

What RLS guarantees:

- `collection` rows are visible/editable **only** to the owning user
  (`user_id = auth.uid()`).
- `games` and `cards` form a shared catalog readable (and appendable) by any
  authenticated user — they hold no private data.
- Storage `card-images` is public-read; users can only write to their own
  folder.

---

## 4. Deploy the Edge Function + set the secret

The `tcg-proxy` function is the **only** thing that knows the TCG API key.

```bash
# Set the secret (NEVER put this key in frontend env or the bundle)
supabase secrets set TCG_API_KEY=tcg_live_xxxxxxxxxxxxxxxxxxxxxxxx

# Deploy the function
supabase functions deploy tcg-proxy
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into Edge Functions
automatically — no need to set them.

The function (`supabase/functions/tcg-proxy/index.ts`):

- requires a valid Supabase JWT (it calls `auth.getUser()`, and
  `verify_jwt = true` in `config.toml`);
- accepts only a **whitelist** of actions: `games`, `sets`, `search`, `card`,
  `prices` (not an open proxy);
- attaches `X-API-Key` server-side and forwards to `https://api.tcgapi.dev`;
- returns `{ data, rateLimit }` so the UI can track remaining quota.

**Test it** (replace `<...>` with values from your project; get a user JWT by
logging into the app and copying the access token from the browser, or via
`supabase` auth):

```bash
curl -i -X POST \
  "https://<your-project-ref>.functions.supabase.co/tcg-proxy" \
  -H "Authorization: Bearer <a-logged-in-user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"action":"search","params":{"q":"pikachu","game":"pokemon"}}'
```

A `401` means the JWT is missing/invalid (working as intended). A `200` returns
`{ "data": ..., "rateLimit": {...} }`.

---

## 5. Get a TCG API key

1. Go to <https://tcgapi.dev> and sign up (see the docs at
   <https://tcgapi.dev/introduction/>).
2. Create an API key — it looks like `tcg_live_...`.
3. Set it as the Edge Function secret (step 4). **Do not** put it in any
   `VITE_` variable or commit it.

The key is sent in the header `X-API-Key`. Base URL: `https://api.tcgapi.dev`.

---

## 6. Local development

```bash
# 1. Install deps
npm install

# 2. Configure frontend env (safe to expose — protected by RLS)
cp .env.example .env.local
#   then fill in:
#   VITE_SUPABASE_URL=https://<ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key>

# 3. Run
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check (tsc -b) + production build
npm run preview      # preview the production build locally
```

Create your account on the **Login** screen (Sign up). If email confirmation is
enabled in Supabase (**Authentication → Providers → Email**), confirm via the
emailed link, then sign in. For a 2-person personal app you can disable email
confirmation to skip that step.

---

## 7. Deploy to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. Framework preset: **Vite** (the included `vercel.json` already sets the build
   command, output dir, and SPA rewrites).
3. Add **Environment Variables** (Project → Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   > Only these two. The TCG API key stays in Supabase, never in Vercel.
4. Add your Vercel domain to Supabase **Authentication → URL Configuration**
   (Site URL + redirect URLs) so auth redirects work.
5. Deploy. The Edge Function is deployed separately via the Supabase CLI
   (step 4) and is shared by local + production.

---

## Quota etiquette (built in)

- **Search** is button-triggered, not as-you-type.
- **Refresh** dedupes by card across conditions (one API call per unique card),
  runs sequentially, and refreshes only the **currently filtered** cards — so
  you can refresh one game/set at a time.
- The refresh button shows the request cost (e.g. *Refresh prices (7)*) and is
  **disabled** when the remaining daily quota is smaller than the cost.
- Manual-game cards never hit the API; you set their price by hand.

## Troubleshooting

- **Proxy returns 401 in the app:** make sure you're logged in. The function
  requires a valid Supabase JWT by design.
- **CORS / preflight errors on `tcg-proxy`:** the function verifies the JWT
  itself (`auth.getUser()`), so if the platform-level gate ever interferes with
  preflight you can safely set `verify_jwt = false` in
  `supabase/config.toml` and redeploy — the request is still authenticated
  in-function.
- **"Missing Supabase env vars" on load:** you haven't created `.env.local`
  (copy it from `.env.example`).
- **Search works but prices look stale:** that's expected — totals come from the
  cache. Hit **Refresh prices** to update (mind the daily quota).

## Constraints honored

- No marketplace scraping — data comes only from the TCG API + manual entry.
- TCG API key lives **only** in the Edge Function secret.
- Frontend env is limited to `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Aggressive caching keeps usage well under 100 requests/day.

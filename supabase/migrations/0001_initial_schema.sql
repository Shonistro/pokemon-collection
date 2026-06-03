-- ============================================================================
-- 0001_initial_schema.sql
-- Core tables for the card collection tracker.
--
-- Design notes:
--  * `games` and `cards` form a SHARED catalog (any authenticated user can read
--    them, and add new entries when they search/import a card). They contain no
--    private data.
--  * `collection` is PER-USER and protected by RLS (see 0002).
--  * Prices are cached on each collection row (`last_known_price`,
--    `price_updated_at`) so the UI computes totals WITHOUT calling the TCG API.
-- ============================================================================

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- games: one row per game/TCG (Pokémon, Riftbound, etc.)
--   source = 'tcgapi'  -> catalog/pricing comes from the TCG API proxy
--   source = 'manual'  -> user-entered cards & prices (game not on TCG API)
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  source      text not null default 'tcgapi' check (source in ('tcgapi', 'manual')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- cards: catalog entry for a specific printing of a card.
--   external_id = TCG API card id (null for manual cards).
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  name        text not null,
  set_name    text,
  number      text,
  image_url   text,
  external_id text,
  source      text not null default 'tcgapi' check (source in ('tcgapi', 'manual')),
  created_at  timestamptz not null default now()
);

-- Dedupe API-sourced cards: at most one row per (game, external_id).
create unique index if not exists cards_game_external_uniq
  on public.cards (game_id, external_id)
  where external_id is not null;

create index if not exists cards_game_id_idx on public.cards (game_id);

-- ---------------------------------------------------------------------------
-- collection: a user's owned copies of a card, at a given condition.
--   One row per (user, card, condition); `quantity` tracks how many.
-- ---------------------------------------------------------------------------
create table if not exists public.collection (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  card_id          uuid not null references public.cards(id) on delete cascade,
  condition        text not null default 'NM' check (condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  quantity         integer not null default 1 check (quantity > 0),
  acquired_price   numeric(12, 2),
  manual_price     numeric(12, 2),
  last_known_price numeric(12, 2),
  price_updated_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, card_id, condition)
);

create index if not exists collection_user_id_idx on public.collection (user_id);
create index if not exists collection_card_id_idx on public.collection (card_id);

-- ---------------------------------------------------------------------------
-- Seed a manual game so the ManualProvider path works out of the box.
-- Riftbound (League of Legends TCG) is treated as manual here; if/when the TCG
-- API supports it you can flip source to 'tcgapi'.
-- ---------------------------------------------------------------------------
insert into public.games (slug, name, source)
values ('riftbound', 'Riftbound (League of Legends TCG)', 'manual')
on conflict (slug) do nothing;

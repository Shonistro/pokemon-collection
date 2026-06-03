-- ============================================================================
-- 0007_pokewallet_source.sql
-- Allow cards sourced from the PokéWallet API (the fallback price provider for
-- Pokémon, used after tcgapi.dev). The card's `source` drives which provider
-- refreshes its price, so it needs its own value.
-- ============================================================================

alter table public.cards drop constraint if exists cards_source_check;
alter table public.cards
  add constraint cards_source_check
  check (source in ('tcgapi', 'manual', 'pokewallet'));

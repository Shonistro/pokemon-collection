-- ============================================================================
-- 0006_favorites.sql
-- Let a user "star" a collection entry so favorites can be pinned to the top
-- of the gallery. Per-row flag on the (already RLS-protected) collection table.
-- ============================================================================

alter table public.collection
  add column if not exists is_favorite boolean not null default false;

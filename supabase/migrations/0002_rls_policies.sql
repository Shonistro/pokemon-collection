-- ============================================================================
-- 0002_rls_policies.sql
-- Row-Level Security.
--
--  * games / cards : shared catalog. Any authenticated user may READ, and may
--    INSERT/UPDATE entries (needed so the add-card flow can import a card the
--    other user hasn't added yet, and so price refresh can update image_url).
--    No private data lives here.
--  * collection    : strictly per-user. A user can only see/modify rows where
--    user_id = auth.uid().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
alter table public.games enable row level security;

drop policy if exists "games_select_authenticated" on public.games;
create policy "games_select_authenticated"
  on public.games for select
  to authenticated
  using (true);

drop policy if exists "games_insert_authenticated" on public.games;
create policy "games_insert_authenticated"
  on public.games for insert
  to authenticated
  with check (true);

drop policy if exists "games_update_authenticated" on public.games;
create policy "games_update_authenticated"
  on public.games for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------
alter table public.cards enable row level security;

drop policy if exists "cards_select_authenticated" on public.cards;
create policy "cards_select_authenticated"
  on public.cards for select
  to authenticated
  using (true);

drop policy if exists "cards_insert_authenticated" on public.cards;
create policy "cards_insert_authenticated"
  on public.cards for insert
  to authenticated
  with check (true);

drop policy if exists "cards_update_authenticated" on public.cards;
create policy "cards_update_authenticated"
  on public.cards for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- collection (per-user isolation)
-- ---------------------------------------------------------------------------
alter table public.collection enable row level security;

drop policy if exists "collection_select_own" on public.collection;
create policy "collection_select_own"
  on public.collection for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "collection_insert_own" on public.collection;
create policy "collection_insert_own"
  on public.collection for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "collection_update_own" on public.collection;
create policy "collection_update_own"
  on public.collection for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "collection_delete_own" on public.collection;
create policy "collection_delete_own"
  on public.collection for delete
  to authenticated
  using (user_id = auth.uid());

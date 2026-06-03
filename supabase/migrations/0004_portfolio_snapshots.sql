-- ============================================================================
-- 0004_portfolio_snapshots.sql
-- Daily snapshots of each user's total portfolio value, so we can draw a value
-- chart over time. Values are computed from CACHED prices (no API calls) and
-- recorded when the app loads or after a price refresh. One row per user/day
-- (upsert), so the series builds up forward in time as you use the app.
-- ============================================================================

create table if not exists public.portfolio_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  captured_on date not null default (now() at time zone 'utc')::date,
  total_value numeric(14, 2) not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, captured_on)
);

create index if not exists portfolio_snapshots_user_idx
  on public.portfolio_snapshots (user_id, captured_on);

alter table public.portfolio_snapshots enable row level security;

drop policy if exists "snapshots_select_own" on public.portfolio_snapshots;
create policy "snapshots_select_own"
  on public.portfolio_snapshots for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "snapshots_insert_own" on public.portfolio_snapshots;
create policy "snapshots_insert_own"
  on public.portfolio_snapshots for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "snapshots_update_own" on public.portfolio_snapshots;
create policy "snapshots_update_own"
  on public.portfolio_snapshots for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "snapshots_delete_own" on public.portfolio_snapshots;
create policy "snapshots_delete_own"
  on public.portfolio_snapshots for delete
  to authenticated
  using (user_id = auth.uid());

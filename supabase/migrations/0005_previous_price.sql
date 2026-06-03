-- ============================================================================
-- 0005_previous_price.sql
-- Track the prior cached price so we can show "Market Movers" (% change since
-- the last price refresh) without any extra API calls. On each refresh we copy
-- the old last_known_price into previous_price, then write the new price.
-- ============================================================================

alter table public.collection
  add column if not exists previous_price numeric(12, 2);

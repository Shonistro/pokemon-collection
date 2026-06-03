-- ============================================================================
-- 0003_storage.sql
-- Storage bucket for user-uploaded custom card photos.
--
--  * Bucket is PUBLIC for reads (so <img src> works without signed URLs).
--  * Writes/updates/deletes are restricted to the owning user's own folder
--    (path prefix = their auth.uid()).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

-- Public read of card images.
drop policy if exists "card_images_public_read" on storage.objects;
create policy "card_images_public_read"
  on storage.objects for select
  using (bucket_id = 'card-images');

-- A user may upload only into their own folder: card-images/<uid>/...
drop policy if exists "card_images_insert_own" on storage.objects;
create policy "card_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_images_update_own" on storage.objects;
create policy "card_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_images_delete_own" on storage.objects;
create policy "card_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

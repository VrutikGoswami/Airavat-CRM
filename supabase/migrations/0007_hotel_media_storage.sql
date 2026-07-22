insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-media',
  'hotel-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hotel_media_public_read on storage.objects;
create policy hotel_media_public_read on storage.objects
  for select to public
  using (bucket_id = 'hotel-media');

drop policy if exists hotel_media_staff_insert on storage.objects;
create policy hotel_media_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hotel-media' and public.is_staff());

drop policy if exists hotel_media_staff_update on storage.objects;
create policy hotel_media_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'hotel-media' and public.is_staff())
  with check (bucket_id = 'hotel-media' and public.is_staff());

drop policy if exists hotel_media_staff_delete on storage.objects;
create policy hotel_media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'hotel-media' and public.is_staff());

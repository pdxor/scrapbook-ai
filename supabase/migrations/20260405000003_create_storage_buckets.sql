insert into storage.buckets (id, name, public)
values ('frame-images', 'frame-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

create policy "Public read frame-images"
  on storage.objects for select
  using (bucket_id = 'frame-images');

create policy "Service write frame-images"
  on storage.objects for insert
  with check (bucket_id = 'frame-images');

create policy "Public read videos"
  on storage.objects for select
  using (bucket_id = 'videos');

create policy "Service write videos"
  on storage.objects for insert
  with check (bucket_id = 'videos');

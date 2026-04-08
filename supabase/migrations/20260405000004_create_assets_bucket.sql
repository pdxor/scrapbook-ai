insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

create policy "Public read assets"
  on storage.objects for select
  using (bucket_id = 'assets');

create policy "Service write assets"
  on storage.objects for insert
  with check (bucket_id = 'assets');

create policy "Service update assets"
  on storage.objects for update
  using (bucket_id = 'assets');

create policy "Service delete assets"
  on storage.objects for delete
  using (bucket_id = 'assets');

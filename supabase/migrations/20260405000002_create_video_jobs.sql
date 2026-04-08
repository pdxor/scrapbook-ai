create table if not exists video_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references video_batches(id) on delete cascade,
  frame_index integer not null,
  frame_title text,
  image_storage_path text,
  prompt text,
  status text not null default 'queued'
    check (status in ('queued', 'submitting', 'pending', 'done', 'failed', 'expired', 'cancelled')),
  xai_request_id text,
  progress integer not null default 0,
  video_url text,
  local_video_url text,
  error_message text,
  duration integer not null default 8,
  aspect_ratio text not null default '16:9',
  resolution text not null default '720p',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_jobs_batch_frame on video_jobs (batch_id, frame_index);
create index if not exists idx_video_jobs_status on video_jobs (status);

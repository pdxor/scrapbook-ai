create table if not exists video_batches (
  id uuid primary key default gen_random_uuid(),
  total_frames integer not null,
  default_prompt text,
  default_duration integer not null default 8,
  default_aspect_ratio text not null default '16:9',
  default_resolution text not null default '720p',
  created_at timestamptz not null default now()
);

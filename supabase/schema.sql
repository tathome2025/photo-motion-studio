create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'rendering', 'rendered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  original_url text not null,
  generated_url text,
  prompt_key text check (prompt_key in ('smile', 'greeting', 'laughing', 'handshake', 'hugging', 'blow-a-kiss', 'custom', 'static')),
  prompt_label text,
  custom_prompt text,
  generation_status text not null default 'uploaded' check (generation_status in ('uploaded', 'queued', 'processing', 'completed', 'failed')),
  kling_task_id text,
  regeneration_count integer not null default 0,
  is_static_clip boolean not null default false,
  timeline_order integer not null default 0,
  transition_key text not null default 'fade' check (transition_key in ('cut', 'fade', 'wipeleft', 'slideup')),
  theme_key text not null default 'editorial' check (theme_key in ('editorial', 'mono', 'warm', 'blueprint')),
  frame_style_key text not null default 'single' check (frame_style_key in ('none', 'single', 'double', 'offset')),
  duration_seconds numeric not null default 5,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'prepared',
  output_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_canva_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  template_key text not null,
  template_name text not null,
  template_url text not null,
  status text not null default 'completed' check (status in ('idle', 'processing', 'completed', 'failed')),
  slide_count integer not null default 0,
  clip_urls jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_template_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  template_key text not null check (template_key in ('clean-cut', 'magazine', 'spotlight', 'cinematic')),
  template_name text not null,
  music_key text not null check (music_key in ('track-01', 'track-02', 'track-03', 'track-04', 'track-05', 'track-06', 'track-07', 'track-08', 'track-09', 'track-10')),
  default_transition_key text not null check (default_transition_key in ('cut', 'fade', 'wipeleft', 'slideup')),
  default_theme_key text not null check (default_theme_key in ('editorial', 'mono', 'warm', 'blueprint')),
  default_frame_style_key text not null check (default_frame_style_key in ('none', 'single', 'double', 'offset')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_presets (
  template_key text primary key check (template_key in ('clean-cut', 'magazine', 'spotlight', 'cinematic')),
  label text not null,
  description text not null,
  transition_key text not null check (transition_key in ('cut', 'fade', 'wipeleft', 'slideup')),
  theme_key text not null check (theme_key in ('editorial', 'mono', 'warm', 'blueprint')),
  frame_style_key text not null check (frame_style_key in ('none', 'single', 'double', 'offset')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_assets_project_id on public.project_assets(project_id);
create index if not exists idx_project_assets_status on public.project_assets(project_id, generation_status);

alter table public.project_assets
  add column if not exists custom_prompt text,
  add column if not exists regeneration_count integer not null default 0,
  add column if not exists is_static_clip boolean not null default false;

alter table public.project_canva_exports
  add column if not exists template_url text not null default '';

alter table public.project_canva_exports drop constraint if exists project_canva_exports_template_key_check;

alter table public.project_template_configs
  add column if not exists template_name text not null default 'Clean Cut',
  add column if not exists music_key text not null default 'track-01',
  add column if not exists default_transition_key text not null default 'cut',
  add column if not exists default_theme_key text not null default 'editorial',
  add column if not exists default_frame_style_key text not null default 'none';

alter table public.project_template_configs
  drop constraint if exists project_template_configs_template_key_check;

alter table public.project_template_configs
  add constraint project_template_configs_template_key_check
  check (template_key in ('clean-cut', 'magazine', 'spotlight', 'cinematic'));

alter table public.project_template_configs
  drop constraint if exists project_template_configs_music_key_check;

alter table public.project_template_configs
  add constraint project_template_configs_music_key_check
  check (music_key in ('track-01', 'track-02', 'track-03', 'track-04', 'track-05', 'track-06', 'track-07', 'track-08', 'track-09', 'track-10'));

alter table public.template_presets
  add column if not exists label text not null default 'Clean Cut',
  add column if not exists description text not null default 'Minimal line styling for direct storytelling.',
  add column if not exists transition_key text not null default 'cut',
  add column if not exists theme_key text not null default 'editorial',
  add column if not exists frame_style_key text not null default 'none',
  add column if not exists sort_order integer not null default 0;

alter table public.template_presets
  drop constraint if exists template_presets_template_key_check;

alter table public.template_presets
  add constraint template_presets_template_key_check
  check (template_key in ('clean-cut', 'magazine', 'spotlight', 'cinematic'));

alter table public.template_presets
  drop constraint if exists template_presets_transition_key_check;

alter table public.template_presets
  add constraint template_presets_transition_key_check
  check (transition_key in ('cut', 'fade', 'wipeleft', 'slideup'));

alter table public.template_presets
  drop constraint if exists template_presets_theme_key_check;

alter table public.template_presets
  add constraint template_presets_theme_key_check
  check (theme_key in ('editorial', 'mono', 'warm', 'blueprint'));

alter table public.template_presets
  drop constraint if exists template_presets_frame_style_key_check;

alter table public.template_presets
  add constraint template_presets_frame_style_key_check
  check (frame_style_key in ('none', 'single', 'double', 'offset'));

alter table public.project_assets drop constraint if exists project_assets_prompt_key_check;

update public.project_assets
set
  prompt_key = case
    when prompt_key in ('smile', 'greeting', 'laughing', 'handshake', 'hugging', 'blow-a-kiss', 'custom', 'static') then prompt_key
    when prompt_key = 'brotherhood' then 'hugging'
    else null
  end,
  prompt_label = case
    when prompt_key = 'brotherhood' then '擁抱 Hugging'
    when prompt_key in ('smile', 'greeting', 'laughing', 'handshake', 'hugging', 'blow-a-kiss', 'custom', 'static') then prompt_label
    else null
  end,
  custom_prompt = case
    when prompt_key = 'custom' then custom_prompt
    else null
  end
where prompt_key is not null;

alter table public.project_assets
  add constraint project_assets_prompt_key_check
  check (prompt_key in ('smile', 'greeting', 'laughing', 'handshake', 'hugging', 'blow-a-kiss', 'custom', 'static'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists project_assets_set_updated_at on public.project_assets;
create trigger project_assets_set_updated_at
before update on public.project_assets
for each row
execute function public.set_updated_at();

drop trigger if exists render_jobs_set_updated_at on public.render_jobs;
create trigger render_jobs_set_updated_at
before update on public.render_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists project_canva_exports_set_updated_at on public.project_canva_exports;
create trigger project_canva_exports_set_updated_at
before update on public.project_canva_exports
for each row
execute function public.set_updated_at();

drop trigger if exists project_template_configs_set_updated_at on public.project_template_configs;
create trigger project_template_configs_set_updated_at
before update on public.project_template_configs
for each row
execute function public.set_updated_at();

drop trigger if exists template_presets_set_updated_at on public.template_presets;
create trigger template_presets_set_updated_at
before update on public.template_presets
for each row
execute function public.set_updated_at();

alter table public.projects disable row level security;
alter table public.project_assets disable row level security;
alter table public.render_jobs disable row level security;
alter table public.project_canva_exports disable row level security;
alter table public.project_template_configs disable row level security;
alter table public.template_presets disable row level security;

insert into storage.buckets (id, name, public)
values
  ('project-originals', 'project-originals', true),
  ('project-generated', 'project-generated', true),
  ('project-renders', 'project-renders', true)
on conflict (id) do nothing;

insert into public.template_presets (
  template_key,
  label,
  description,
  transition_key,
  theme_key,
  frame_style_key,
  sort_order
)
values
  ('clean-cut', 'Clean Cut', 'Minimal line styling for direct storytelling.', 'cut', 'editorial', 'none', 1),
  ('magazine', 'Magazine Grid', 'Editorial look with gentle fades and slim frames.', 'fade', 'mono', 'single', 2),
  ('spotlight', 'Spotlight', 'Warmer framing with stronger motion transitions.', 'wipeleft', 'warm', 'double', 3),
  ('cinematic', 'Cinematic Motion', 'Blueprint tones with dramatic slide transitions.', 'slideup', 'blueprint', 'offset', 4)
on conflict (template_key) do nothing;

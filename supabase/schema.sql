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
  prompt_key text check (prompt_key in ('smile', 'greeting', 'laughing', 'handshake', 'hugging', 'brotherhood', 'blow-a-kiss')),
  prompt_label text,
  generation_status text not null default 'uploaded' check (generation_status in ('uploaded', 'queued', 'processing', 'completed', 'failed')),
  kling_task_id text,
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

create index if not exists idx_project_assets_project_id on public.project_assets(project_id);
create index if not exists idx_project_assets_status on public.project_assets(project_id, generation_status);

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

alter table public.projects disable row level security;
alter table public.project_assets disable row level security;
alter table public.render_jobs disable row level security;

insert into storage.buckets (id, name, public)
values
  ('project-originals', 'project-originals', true),
  ('project-generated', 'project-generated', true),
  ('project-renders', 'project-renders', true)
on conflict (id) do nothing;

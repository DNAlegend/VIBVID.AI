-- MightyMak initial schema: profiles + credits, asset library, generations,
-- and a public storage bucket for uploaded asset files.
--
-- Client-generated text ids are kept as-is (the front-end already creates
-- stable ids like "ast-…" / "cat-…"), so every table is keyed on
-- (user_id, id) and RLS scopes all access to the signed-in user.

-- ---------------------------------------------------------------- profiles --
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  credits integer not null default 1200 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id);

-- Auto-provision a profile (with the 1,200-credit welcome boost) on signup.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atomic credit adjustment; returns the new balance, or null when the
-- adjustment would go negative (insufficient credits).
create function public.adjust_credits(delta integer) returns integer
language sql
as $$
  update public.profiles
     set credits = credits + delta, updated_at = now()
   where id = (select auth.uid()) and credits + delta >= 0
  returning credits;
$$;

-- -------------------------------------------------------------- categories --
create table public.categories (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  system boolean not null default false,
  created_at bigint not null, -- ms epoch, mirrors the client
  primary key (user_id, id)
);

alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories
  for update using ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories
  for delete using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------ assets --
create table public.assets (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('image', 'video', 'audio')),
  url text not null,
  poster_url text,
  category_id text,
  source text not null default 'upload' check (source in ('upload', 'generation', 'starter')),
  size_bytes bigint,
  class text check (class in ('character', 'dress', 'scene', 'dance', 'audio')),
  owner text check (owner in ('user', 'business')),
  parts jsonb,
  prompt_fragment text,
  accent text,
  created_at bigint not null,
  primary key (user_id, id)
);

create index assets_user_created_idx on public.assets (user_id, created_at desc);

alter table public.assets enable row level security;

create policy "assets_select_own" on public.assets
  for select using ((select auth.uid()) = user_id);
create policy "assets_insert_own" on public.assets
  for insert with check ((select auth.uid()) = user_id);
create policy "assets_update_own" on public.assets
  for update using ((select auth.uid()) = user_id);
create policy "assets_delete_own" on public.assets
  for delete using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------- generations --
create table public.generations (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt text not null,
  status text not null default 'rendering' check (status in ('rendering', 'succeeded', 'failed')),
  progress integer not null default 0,
  tier text not null,
  duration_sec integer not null,
  aspect_ratio text not null,
  audio boolean not null default true,
  model_id text,
  modality text not null default 'video' check (modality in ('video', 'image')),
  ref_asset_id text,
  video_url text,
  poster_url text,
  credits_cost integer not null default 0,
  error text,
  elements jsonb,
  direction text,
  created_at bigint not null,
  primary key (user_id, id)
);

create index generations_user_created_idx on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

create policy "generations_select_own" on public.generations
  for select using ((select auth.uid()) = user_id);
create policy "generations_insert_own" on public.generations
  for insert with check ((select auth.uid()) = user_id);
create policy "generations_update_own" on public.generations
  for update using ((select auth.uid()) = user_id);
create policy "generations_delete_own" on public.generations
  for delete using ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------- storage --
-- Public bucket for uploaded asset files; each user writes under their own
-- uid/ folder, anyone can read (the app serves these URLs directly).
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

create policy "assets_bucket_read" on storage.objects
  for select using (bucket_id = 'assets');
create policy "assets_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "assets_bucket_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "assets_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid()::text));

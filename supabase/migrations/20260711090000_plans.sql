-- Plans: the prompt-engineering surface before Make. One row per planning
-- session; the Director's ideas live in a jsonb array (each idea carries its
-- provenance links: sentAt when handed to Make, jobId once generated).
create table public.plans (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brief text not null,
  ideas jsonb not null default '[]',
  created_at bigint not null,
  primary key (user_id, id)
);

create index plans_user_created_idx on public.plans (user_id, created_at desc);

alter table public.plans enable row level security;

create policy "plans_select_own" on public.plans
  for select using ((select auth.uid()) = user_id);
create policy "plans_insert_own" on public.plans
  for insert with check ((select auth.uid()) = user_id);
create policy "plans_update_own" on public.plans
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "plans_delete_own" on public.plans
  for delete using ((select auth.uid()) = user_id);

-- Generations remember which plan idea they came from (the visible history).
alter table public.generations add column if not exists plan_id text;
alter table public.generations add column if not exists idea_id text;

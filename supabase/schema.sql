create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id text primary key,
  name text not null,
  role text not null check (role in ('child', 'parent')),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  member_id text not null,
  date date not null,
  points integer not null default 0,
  category text not null default '기타',
  fixed boolean not null default false,
  series_id text not null default '',
  repeat_days integer[] not null default '{}',
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id text primary key,
  title text not null,
  member_id text not null,
  points_required integer not null default 0,
  status text not null default 'available' check (status in ('available', 'requested', 'used')),
  updated_at timestamptz not null default now()
);

create table if not exists public.cheers (
  id text primary key,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
alter table public.members enable row level security;
alter table public.tasks enable row level security;
alter table public.rewards enable row level security;
alter table public.cheers enable row level security;

drop policy if exists "app_state_select_all" on public.app_state;
create policy "app_state_select_all"
on public.app_state
for select
to anon, authenticated
using (true);

drop policy if exists "app_state_insert_all" on public.app_state;
create policy "app_state_insert_all"
on public.app_state
for insert
to anon, authenticated
with check (true);

drop policy if exists "app_state_update_all" on public.app_state;
create policy "app_state_update_all"
on public.app_state
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "app_state_delete_all" on public.app_state;
create policy "app_state_delete_all"
on public.app_state
for delete
to anon, authenticated
using (true);

drop policy if exists "members_select_all" on public.members;
create policy "members_select_all"
on public.members
for select
to anon, authenticated
using (true);

drop policy if exists "members_insert_all" on public.members;
create policy "members_insert_all"
on public.members
for insert
to anon, authenticated
with check (true);

drop policy if exists "members_update_all" on public.members;
create policy "members_update_all"
on public.members
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "members_delete_all" on public.members;
create policy "members_delete_all"
on public.members
for delete
to anon, authenticated
using (true);

drop policy if exists "tasks_select_all" on public.tasks;
create policy "tasks_select_all"
on public.tasks
for select
to anon, authenticated
using (true);

drop policy if exists "tasks_insert_all" on public.tasks;
create policy "tasks_insert_all"
on public.tasks
for insert
to anon, authenticated
with check (true);

drop policy if exists "tasks_update_all" on public.tasks;
create policy "tasks_update_all"
on public.tasks
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "tasks_delete_all" on public.tasks;
create policy "tasks_delete_all"
on public.tasks
for delete
to anon, authenticated
using (true);

drop policy if exists "rewards_select_all" on public.rewards;
create policy "rewards_select_all"
on public.rewards
for select
to anon, authenticated
using (true);

drop policy if exists "rewards_insert_all" on public.rewards;
create policy "rewards_insert_all"
on public.rewards
for insert
to anon, authenticated
with check (true);

drop policy if exists "rewards_update_all" on public.rewards;
create policy "rewards_update_all"
on public.rewards
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "rewards_delete_all" on public.rewards;
create policy "rewards_delete_all"
on public.rewards
for delete
to anon, authenticated
using (true);

drop policy if exists "cheers_select_all" on public.cheers;
create policy "cheers_select_all"
on public.cheers
for select
to anon, authenticated
using (true);

drop policy if exists "cheers_insert_all" on public.cheers;
create policy "cheers_insert_all"
on public.cheers
for insert
to anon, authenticated
with check (true);

drop policy if exists "cheers_update_all" on public.cheers;
create policy "cheers_update_all"
on public.cheers
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "cheers_delete_all" on public.cheers;
create policy "cheers_delete_all"
on public.cheers
for delete
to anon, authenticated
using (true);

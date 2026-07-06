create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

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

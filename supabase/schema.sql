-- WEB-HKR Room Inspection — Supabase Free schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Uses Free plan only. No Storage buckets. No paid add-ons.

create table if not exists public.inspections (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  room_number text not null,
  room_type text not null default '',
  inspection_number integer not null check (inspection_number in (1, 2)),
  inspection_date date,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inspections_user_room_number_idx
  on public.inspections (user_id, room_number, inspection_number);

create index if not exists inspections_user_updated_idx
  on public.inspections (user_id, updated_at desc);

create index if not exists inspections_user_room_idx
  on public.inspections (user_id, room_number);

alter table public.inspections enable row level security;

drop policy if exists "inspections_select_own" on public.inspections;
drop policy if exists "inspections_insert_own" on public.inspections;
drop policy if exists "inspections_update_own" on public.inspections;
drop policy if exists "inspections_delete_own" on public.inspections;

create policy "inspections_select_own"
  on public.inspections
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "inspections_insert_own"
  on public.inspections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "inspections_update_own"
  on public.inspections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "inspections_delete_own"
  on public.inspections
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.inspections from anon;
grant select, insert, update, delete on table public.inspections to authenticated;

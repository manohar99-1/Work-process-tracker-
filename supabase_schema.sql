-- =============================================
-- NestUp Work Process Tracker — Supabase Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text not null,
  role text not null check (role in ('admin', 'member')),
  skills text[] default '{}',
  created_at timestamptz default now()
);

-- Work items
create table public.work_items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'blocked' check (status in ('blocked', 'in-progress', 'done')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  required_skills text[] default '{}',
  assigned_to uuid references public.profiles(id) on delete set null,
  blocked_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Dependencies between work items
create table public.dependencies (
  id uuid default gen_random_uuid() primary key,
  predecessor_id uuid not null references public.work_items(id) on delete cascade,
  successor_id uuid not null references public.work_items(id) on delete cascade,
  type text not null check (type in ('full', 'partial')),
  threshold integer not null default 100 check (threshold >= 1 and threshold <= 100),
  created_at timestamptz default now(),
  unique(predecessor_id, successor_id)
);

-- Trigger: auto-update updated_at on work_items
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger work_items_updated_at
  before update on public.work_items
  for each row execute function update_updated_at();

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.work_items enable row level security;
alter table public.dependencies enable row level security;

-- Profiles: users can read all, update own
create policy "profiles_read_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Work items: all authenticated users can read; admin can write
create policy "work_items_read" on public.work_items for select using (auth.role() = 'authenticated');
create policy "work_items_insert" on public.work_items for insert with check (auth.role() = 'authenticated');
create policy "work_items_update" on public.work_items for update using (auth.role() = 'authenticated');
create policy "work_items_delete" on public.work_items for delete using (auth.role() = 'authenticated');

-- Dependencies: all authenticated users
create policy "deps_read" on public.dependencies for select using (auth.role() = 'authenticated');
create policy "deps_insert" on public.dependencies for insert with check (auth.role() = 'authenticated');
create policy "deps_delete" on public.dependencies for delete using (auth.role() = 'authenticated');

-- Seed demo admin user (run AFTER creating auth user in Supabase Dashboard)
-- INSERT INTO public.profiles (id, email, name, role, skills)
-- VALUES ('YOUR-ADMIN-UUID', 'admin@nestup.com', 'Admin User', 'admin', ARRAY['React','Node','Python']);

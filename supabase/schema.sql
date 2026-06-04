-- Supabase schema for Create tiny static landing page called Nexus Deploy Sm
create extension if not exists pgcrypto;

create table if not exists public.create_tiny_static_landing_page_called_nexus_dep_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.create_tiny_static_landing_page_called_nexus_dep_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.create_tiny_static_landing_page_called_nexus_dep_workspaces(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  amount numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.create_tiny_static_landing_page_called_nexus_dep_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.create_tiny_static_landing_page_called_nexus_dep_workspaces(id) on delete cascade,
  actor text not null default 'Agent Nexus',
  event text not null,
  created_at timestamptz not null default now()
);

alter table public.create_tiny_static_landing_page_called_nexus_dep_workspaces enable row level security;
alter table public.create_tiny_static_landing_page_called_nexus_dep_items enable row level security;
alter table public.create_tiny_static_landing_page_called_nexus_dep_activity enable row level security;

create policy "create_tiny_static_landing_page_called_nexus_dep_workspaces_read" on public.create_tiny_static_landing_page_called_nexus_dep_workspaces for select using (true);
create policy "create_tiny_static_landing_page_called_nexus_dep_items_read" on public.create_tiny_static_landing_page_called_nexus_dep_items for select using (true);
create policy "create_tiny_static_landing_page_called_nexus_dep_activity_read" on public.create_tiny_static_landing_page_called_nexus_dep_activity for select using (true);

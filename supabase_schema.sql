-- ============================================================
-- TimeTracker - Schema SQL para Supabase
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- Perfiles de usuario (extiende auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz default now()
);

-- Workspaces (espacios de trabajo)
create table public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

-- Miembros del workspace
create table public.workspace_members (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- Clientes
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  name text not null,
  email text,
  created_at timestamptz default now()
);

-- Proyectos
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  client_id uuid references public.clients on delete set null,
  name text not null,
  color text default '#6366f1',
  archived boolean default false,
  created_at timestamptz default now()
);

-- Etiquetas
create table public.tags (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  name text not null,
  color text default '#94a3b8'
);

-- Entradas de tiempo (core)
create table public.time_entries (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  duration integer, -- segundos
  billable boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tags enable row level security;
alter table public.time_entries enable row level security;

-- Profiles: cada usuario ve y edita el suyo
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Helper: ¿es el usuario miembro del workspace?
create function public.is_workspace_member(ws_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- Workspaces: solo miembros
create policy "workspaces_select" on public.workspaces for select using (public.is_workspace_member(id));
create policy "workspaces_update" on public.workspaces for update using (public.is_workspace_member(id));

-- Workspace members: miembros del mismo workspace
create policy "ws_members_select" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "ws_members_insert" on public.workspace_members for insert with check (auth.uid() = user_id);

-- Clients
create policy "clients_select" on public.clients for select using (public.is_workspace_member(workspace_id));
create policy "clients_insert" on public.clients for insert with check (public.is_workspace_member(workspace_id));
create policy "clients_update" on public.clients for update using (public.is_workspace_member(workspace_id));
create policy "clients_delete" on public.clients for delete using (public.is_workspace_member(workspace_id));

-- Projects
create policy "projects_select" on public.projects for select using (public.is_workspace_member(workspace_id));
create policy "projects_insert" on public.projects for insert with check (public.is_workspace_member(workspace_id));
create policy "projects_update" on public.projects for update using (public.is_workspace_member(workspace_id));
create policy "projects_delete" on public.projects for delete using (public.is_workspace_member(workspace_id));

-- Tags
create policy "tags_all" on public.tags for all using (public.is_workspace_member(workspace_id));

-- Time entries: cada usuario gestiona las suyas
create policy "entries_select" on public.time_entries for select using (
  user_id = auth.uid() or public.is_workspace_member(workspace_id)
);
create policy "entries_insert" on public.time_entries for insert with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
create policy "entries_update" on public.time_entries for update using (user_id = auth.uid());
create policy "entries_delete" on public.time_entries for delete using (user_id = auth.uid());

-- ============================================================
-- Trigger: crear perfil + workspace al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_ws_id uuid;
begin
  -- Crear perfil
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);

  -- Crear workspace personal
  insert into public.workspaces (name)
  values (coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s Workspace')
  returning id into new_ws_id;

  -- Añadir como owner
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

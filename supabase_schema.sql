-- ============================================================
-- MyTrack - Schema SQL para Supabase v2
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- Perfiles de usuario
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  email text,
  job_title text,           -- "Consultor Marketing", "Jefe de Proyecto", etc.
  hourly_rate numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- Workspaces
create table public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  working_hours_per_day integer default 8,
  alert_threshold_days integer default 1, -- días sin imputar antes de alertar
  created_at timestamptz default now()
);

-- Miembros del workspace
create table public.workspace_members (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'employee' check (role in ('admin','manager','employee')),
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

-- Proyectos (solo managers pueden crear)
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  client_id uuid references public.clients on delete set null,
  name text not null,
  color text default '#7B68EE',
  archived boolean default false,
  budget_hours numeric(10,2),
  created_at timestamptz default now()
);

-- Tareas (solo managers pueden crear)
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects on delete cascade,
  name text not null,
  description text,
  estimated_hours numeric(10,2),
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

-- Entradas de tiempo
create table public.time_entries (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  task_id uuid references public.tasks on delete set null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  duration integer,
  billable boolean default true,
  created_at timestamptz default now()
);

-- Notificaciones
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  type text not null check (type in ('unlogged_time','budget_warning','weekly_summary','task_assigned')),
  title text not null,
  message text not null,
  read boolean default false,
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
alter table public.tasks enable row level security;
alter table public.tags enable row level security;
alter table public.time_entries enable row level security;
alter table public.notifications enable row level security;

-- Helper: miembro del workspace
create function public.is_workspace_member(ws_id uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.workspace_members where workspace_id = ws_id and user_id = auth.uid());
$$;

-- Helper: es manager o admin
create function public.is_manager(ws_id uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.workspace_members where workspace_id = ws_id and user_id = auth.uid() and role in ('admin','manager'));
$$;

-- Profiles
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Workspaces
create policy "workspaces_select" on public.workspaces for select using (public.is_workspace_member(id));
create policy "workspaces_update" on public.workspaces for update using (public.is_manager(id));

-- Workspace members
create policy "ws_members_select" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "ws_members_insert" on public.workspace_members for insert with check (auth.uid() = user_id);
create policy "ws_members_update" on public.workspace_members for update using (public.is_manager(workspace_id));

-- Clients
create policy "clients_all_members" on public.clients for select using (public.is_workspace_member(workspace_id));
create policy "clients_managers_write" on public.clients for insert with check (public.is_manager(workspace_id));
create policy "clients_managers_update" on public.clients for update using (public.is_manager(workspace_id));
create policy "clients_managers_delete" on public.clients for delete using (public.is_manager(workspace_id));

-- Projects
create policy "projects_all_members" on public.projects for select using (public.is_workspace_member(workspace_id));
create policy "projects_managers_write" on public.projects for insert with check (public.is_manager(workspace_id));
create policy "projects_managers_update" on public.projects for update using (public.is_manager(workspace_id));
create policy "projects_managers_delete" on public.projects for delete using (public.is_manager(workspace_id));

-- Tasks
create policy "tasks_select" on public.tasks for select using (
  exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))
);
create policy "tasks_managers_write" on public.tasks for insert with check (
  exists (select 1 from public.projects p where p.id = project_id and public.is_manager(p.workspace_id))
);
create policy "tasks_managers_update" on public.tasks for update using (
  exists (select 1 from public.projects p where p.id = project_id and public.is_manager(p.workspace_id))
);
create policy "tasks_managers_delete" on public.tasks for delete using (
  exists (select 1 from public.projects p where p.id = project_id and public.is_manager(p.workspace_id))
);

-- Time entries
create policy "entries_select_own" on public.time_entries for select using (
  user_id = auth.uid() or public.is_manager(workspace_id)
);
create policy "entries_insert" on public.time_entries for insert with check (
  user_id = auth.uid() and public.is_workspace_member(workspace_id)
);
create policy "entries_update" on public.time_entries for update using (user_id = auth.uid() or public.is_manager(workspace_id));
create policy "entries_delete" on public.time_entries for delete using (user_id = auth.uid() or public.is_manager(workspace_id));

-- Notifications
create policy "notifications_own" on public.notifications for all using (user_id = auth.uid());

-- ============================================================
-- Trigger: crear perfil + workspace al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare new_ws_id uuid;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);

  insert into public.workspaces (name)
  values (coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)) || '''s Workspace')
  returning id into new_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, new.id, 'admin');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

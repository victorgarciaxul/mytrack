-- ============================================================
-- EcoFin - Módulo de Control Económico-Financiero
-- Añadir al schema de MyTrack (Supabase > SQL Editor)
-- ============================================================

-- Proyectos financieros
create table public.eco_proyectos (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  codigo_proyecto text not null,
  codigo_contrato text,
  nombre_contrato text not null,
  cliente text not null,
  anio integer not null default extract(year from now())::integer,
  presupuesto_base numeric(14,2) default 0,
  ampliaciones numeric(14,2) default 0,
  estado text default 'activo' check (estado in ('activo','cerrado','preparado')),
  created_at timestamptz default now()
);

-- Entradas mensuales por categoría
create table public.eco_entradas (
  id uuid default gen_random_uuid() primary key,
  proyecto_id uuid references public.eco_proyectos on delete cascade,
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  categoria text not null check (
    categoria in ('facturacion','coste_personal','gastos_personal','produccion','plan_medios')
  ),
  importe numeric(14,2) not null default 0,
  created_at timestamptz default now(),
  unique(proyecto_id, anio, mes, categoria)
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.eco_proyectos enable row level security;
alter table public.eco_entradas enable row level security;

-- eco_proyectos: todos los miembros leen, solo managers escriben
create policy "eco_proyectos_select" on public.eco_proyectos
  for select using (public.is_workspace_member(workspace_id));

create policy "eco_proyectos_insert" on public.eco_proyectos
  for insert with check (public.is_manager(workspace_id));

create policy "eco_proyectos_update" on public.eco_proyectos
  for update using (public.is_manager(workspace_id));

create policy "eco_proyectos_delete" on public.eco_proyectos
  for delete using (public.is_manager(workspace_id));

-- eco_entradas: hereda permisos del proyecto padre
create policy "eco_entradas_select" on public.eco_entradas
  for select using (
    exists (
      select 1 from public.eco_proyectos p
      where p.id = proyecto_id and public.is_workspace_member(p.workspace_id)
    )
  );

create policy "eco_entradas_insert" on public.eco_entradas
  for insert with check (
    exists (
      select 1 from public.eco_proyectos p
      where p.id = proyecto_id and public.is_manager(p.workspace_id)
    )
  );

create policy "eco_entradas_update" on public.eco_entradas
  for update using (
    exists (
      select 1 from public.eco_proyectos p
      where p.id = proyecto_id and public.is_manager(p.workspace_id)
    )
  );

create policy "eco_entradas_delete" on public.eco_entradas
  for delete using (
    exists (
      select 1 from public.eco_proyectos p
      where p.id = proyecto_id and public.is_manager(p.workspace_id)
    )
  );

-- Esquema para PostgreSQL / Supabase. Ejecuta este archivo completo (Supabase → SQL Editor).
-- Los nombres de columna son los del frontend en snake_case (los conectores convierten camelCase ↔ snake_case).

create table if not exists permits (
  numero_arriendo bigint primary key,
  nombres text not null, rut text not null, direccion text, metraje text, descripcion text,
  estado text not null, deuda numeric(14,0) not null default 0,
  calle text, lat double precision, lon double precision,
  source text not null default 'api', fetched_at timestamptz not null default now()
);
create index if not exists permits_estado_idx on permits (estado, deuda desc);
create index if not exists permits_calle_idx on permits (calle);

create table if not exists inspections (
  id uuid primary key, code text unique not null,
  permit_number bigint not null, permit_name text, permit_rut text, direccion text,
  started_at timestamptz not null, finished_at timestamptz not null,
  inspector_name text, inspector_id text,
  checks jsonb not null default '{}', notes text default '',
  photos jsonb not null default '[]',        -- en producción guarda las fotos en Storage y aquí solo las rutas
  gps jsonb, outcome text not null check (outcome in ('aprobada','observaciones','multa')),
  fine_id uuid, demo boolean default false
);
create index if not exists inspections_permit_idx on inspections (permit_number, finished_at desc);

create table if not exists fines (
  id uuid primary key, folio text unique not null,
  inspection_id uuid not null, inspection_code text not null,
  permit_number bigint not null, permit_name text, permit_rut text, direccion text,
  items jsonb not null default '[]', total_utm numeric(8,2) not null, utm_value numeric(12,2) not null, total_clp numeric(14,0) not null,
  reincident boolean not null default false, seizure boolean not null default false,
  status text not null default 'emitida' check (status in ('emitida','pagada','anulada')),
  issued_at timestamptz not null, inspector_name text, inspector_id text, notes text default '', demo boolean default false
);
create index if not exists fines_permit_idx on fines (permit_number, issued_at desc);

create table if not exists snapshots (date date primary key, al_dia int not null, atrasado int not null, desactivado int not null, deuda numeric(14,0) not null);
create table if not exists settings (id int primary key default 1 check (id = 1), value jsonb not null);

-- Folio correlativo atómico (evita folios repetidos aunque haya varios inspectores)
create sequence if not exists folio_seq;
create or replace function next_folio() returns text language sql as $$
  select 'M-' || extract(year from now())::int || '-' || lpad(nextval('folio_seq')::text, 6, '0')
$$;

-- ── Verificación pública del QR: devuelve SOLO campos no sensibles (sin RUT, dirección ni fotos) ──
create or replace function verify_inspection(p_code text) returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'inspection', jsonb_build_object('id', i.id, 'code', i.code, 'permitNumber', i.permit_number, 'outcome', i.outcome, 'finishedAt', i.finished_at, 'inspectorId', i.inspector_id),
    'fine', case when f.id is null then null else jsonb_build_object('folio', f.folio, 'totalClp', f.total_clp, 'status', f.status) end)
  from inspections i left join fines f on f.id = i.fine_id where i.code = p_code
$$;

-- ── Supabase: seguridad por filas (RLS). En PostgreSQL puro, protege estas tablas desde tu API ──
alter table permits enable row level security;
alter table inspections enable row level security;
alter table fines enable row level security;
alter table snapshots enable row level security;
alter table settings enable row level security;

-- Solo usuarios autenticados (inspectores) leen y escriben. Afina según tu modelo de roles
-- (por ejemplo, exigir (auth.jwt() -> 'app_metadata' ->> 'role') = 'inspector').
do $$ declare t text; begin
  foreach t in array array['permits','inspections','fines','snapshots','settings'] loop
    execute format('drop policy if exists inspectors_all on %I', t);
    execute format('create policy inspectors_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

revoke all on permits, inspections, fines, snapshots, settings from anon;
grant execute on function verify_inspection(text) to anon, authenticated;
grant execute on function next_folio() to authenticated;

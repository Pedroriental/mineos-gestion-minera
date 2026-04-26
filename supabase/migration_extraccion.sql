-- Tabla para Reportes de Extracción (Mina)
create table if not exists reportes_extraccion (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  turno text not null check (turno in ('dia','noche','completo')),
  vertical text,
  mina text,
  responsable text,
  hora_inicio time,
  hora_fin time,
  eventos jsonb,
  sacos_extraidos integer not null default 0,
  numero_disparo text,
  observaciones text,
  registrado_por uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table reportes_extraccion enable row level security;

create policy "Autenticados pueden leer extraccion"
  on reportes_extraccion for select to authenticated using (true);

create policy "Autenticados pueden insertar extraccion"
  on reportes_extraccion for insert to authenticated with check (true);

create policy "Autenticados pueden actualizar extraccion"
  on reportes_extraccion for update to authenticated using (true);

create policy "Autenticados pueden eliminar extraccion"
  on reportes_extraccion for delete to authenticated using (true);

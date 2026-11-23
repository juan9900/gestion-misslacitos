-- =====================================================================
-- Miss Lacitoss · base de datos en Supabase
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- 1) Quién puede entrar: SOLO las cuentas que estén en esta lista.
create table if not exists public.miembros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre  text not null default '',
  creado  timestamptz not null default now()
);

-- 2) Todos los datos de la app. Cada fila es un pedido, una clienta,
--    un producto, un movimiento de dinero o los ajustes.
--    Nunca se borran filas: se marcan con borrado = true, así ningún
--    teléfono "resucita" algo que se borró en otro.
create table if not exists public.registros (
  coleccion       text not null check (coleccion in ('productos','clientas','pedidos','movs','compras','interesadas','ajustes')),
  id              text not null,
  data            jsonb not null default '{}'::jsonb,
  borrado         boolean not null default false,
  actualizado     timestamptz not null default now(),
  actualizado_por uuid,
  primary key (coleccion, id)
);
create index if not exists registros_actualizado_idx on public.registros (actualizado);

-- Si la tabla ya existía de antes, esto actualiza la lista de colecciones permitidas
-- (se agregaron 'compras' e 'interesadas').
alter table public.registros drop constraint if exists registros_coleccion_check;
alter table public.registros add constraint registros_coleccion_check
  check (coleccion in ('productos','clientas','pedidos','movs','compras','interesadas','ajustes'));

-- La hora la pone el servidor (no el teléfono), para sincronizar bien.
create or replace function public.ml_tocar() returns trigger
language plpgsql as $$
begin
  new.actualizado := clock_timestamp();
  new.actualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists ml_tocar on public.registros;
create trigger ml_tocar before insert or update on public.registros
  for each row execute function public.ml_tocar();

-- 3) Reglas de seguridad (RLS). Sin esto, cualquiera con el enlace
--    podría leer los teléfonos de las clientas.
create or replace function public.ml_es_miembro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros where user_id = auth.uid());
$$;
revoke all on function public.ml_es_miembro() from public, anon;
grant execute on function public.ml_es_miembro() to authenticated;

alter table public.registros enable row level security;
alter table public.miembros  enable row level security;

drop policy if exists ml_leer    on public.registros;
drop policy if exists ml_crear   on public.registros;
drop policy if exists ml_cambiar on public.registros;
create policy ml_leer    on public.registros for select to authenticated using (public.ml_es_miembro());
create policy ml_crear   on public.registros for insert to authenticated with check (public.ml_es_miembro());
create policy ml_cambiar on public.registros for update to authenticated using (public.ml_es_miembro()) with check (public.ml_es_miembro());
-- (No hay regla de DELETE a propósito: nadie puede borrar filas desde la app.)

drop policy if exists ml_verme on public.miembros;
create policy ml_verme on public.miembros for select to authenticated using (user_id = auth.uid());

revoke all on public.registros from anon;
revoke all on public.miembros  from anon;
grant select, insert, update on public.registros to authenticated;
grant select on public.miembros to authenticated;

-- =====================================================================
-- 4) DESPUÉS de crear las dos cuentas en Authentication → Users,
--    cambia los correos y ejecuta solo esta parte:
-- =====================================================================
-- insert into public.miembros (user_id, nombre)
--   select id, 'Dueña' from auth.users where email = 'CORREO_DE_ELLA'
--   on conflict (user_id) do nothing;
-- insert into public.miembros (user_id, nombre)
--   select id, 'Luis' from auth.users where email = 'luisfgr11@gmail.com'
--   on conflict (user_id) do nothing;

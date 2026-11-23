-- =====================================================================
-- Miss Lacitoss · avisos en el teléfono (Web Push)
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- La tarea diaria (al final) se programa SOLO después de comprobar que un aviso de prueba llega.
-- =====================================================================
create extension if not exists pg_net;

-- Claves VAPID: las crea la función "avisos" la primera vez. Nadie más que el servidor las puede leer
-- (RLS activo y sin ninguna regla, y sin permisos para anon ni authenticated).
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  vapid jsonb not null,
  publica text not null,
  ultimo_envio date,
  creado timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- Teléfonos que activaron los avisos. Cada cuenta ve y borra solo los suyos.
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sub jsonb not null,
  creado timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists ml_subs_ver on public.push_subs;
drop policy if exists ml_subs_crear on public.push_subs;
drop policy if exists ml_subs_cambiar on public.push_subs;
drop policy if exists ml_subs_borrar on public.push_subs;
create policy ml_subs_ver on public.push_subs for select to authenticated using (user_id = auth.uid());
create policy ml_subs_crear on public.push_subs for insert to authenticated with check (user_id = auth.uid() and public.ml_es_miembro());
create policy ml_subs_cambiar on public.push_subs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.ml_es_miembro());
create policy ml_subs_borrar on public.push_subs for delete to authenticated using (user_id = auth.uid());
revoke all on public.push_subs from anon;
grant select, insert, update, delete on public.push_subs to authenticated;
-- el servidor (función "avisos") necesita permisos explícitos: el proyecto no da acceso automático a tablas nuevas
grant select, insert, update on public.push_config to service_role;
grant select, delete on public.push_subs to service_role;
grant select on public.miembros to service_role;

-- $ con formato venezolano: 1.234,50
create or replace function public.ml_dinero(c numeric) returns text
language sql immutable as $f$ select '$' || translate(to_char(c / 100.0, 'FM999,999,990.00'), ',.', '.,') $f$;

-- Resumen del día (hora de Caracas). Usa la misma cuenta de "debe" que la app.
create or replace function public.ml_resumen() returns jsonb
language sql stable security definer set search_path = public as $f$
with hoy as (select ((now() at time zone 'America/Caracas')::date)::text as d),
ped as (select id, data from public.registros where coleccion = 'pedidos' and not borrado),
pag as (
  select data->>'pedidoId' as pid, sum((data->>'monto')::numeric) as s
  from public.registros
  where coleccion = 'movs' and not borrado and data->>'tipo' = 'ing' and coalesce(data->>'pedidoId', '') <> ''
  group by 1),
calc as (
  select p.id,
         coalesce((p.data->>'entregado')::boolean, false) as entregado,
         nullif(p.data->>'entrega', '') as entrega,
         coalesce(p.data->>'etapa', '') as etapa,
         greatest(0, coalesce((p.data->>'total')::numeric, 0) - coalesce((p.data->>'pagoPrevio')::numeric, 0) - coalesce(g.s, 0)) as debe
  from ped p left join pag g on g.pid = p.id)
select jsonb_build_object(
  'hoy', (select d from hoy),
  'entregas_hoy', (select count(*) from calc, hoy where not entregado and entrega = hoy.d),
  'atrasados', (select count(*) from calc, hoy where not entregado and entrega < hoy.d),
  'listos', (select count(*) from calc where not entregado and etapa = 'listo'),
  'pendientes', (select count(*) from calc where not entregado),
  'deuda', (select coalesce(sum(debe), 0) from calc),
  'deudoras', (select count(*) from calc where debe > 0),
  'interesadas', (select count(*) from public.registros where coleccion = 'interesadas' and not borrado
                    and not coalesce((data->>'respondida')::boolean, false) and coalesce(data->>'cerrada', '') = ''),
  'compras', (select count(*) from public.registros where coleccion = 'compras' and not borrado
                    and not coalesce((data->>'hecho')::boolean, false)))
$f$;

-- Reclama el envío de hoy (una sola vez al día, desde las 7 am de Caracas) y arma el texto.
-- Solo cantidades y totales: el aviso se ve en la pantalla bloqueada.
create or replace function public.ml_push_reclamar() returns jsonb
language plpgsql security definer set search_path = public as $f$
declare
  ahora timestamp := now() at time zone 'America/Caracas';
  r jsonb; partes text[] := '{}'; n int;
begin
  if extract(hour from ahora) < 7 then return jsonb_build_object('enviar', false, 'motivo', 'antes de las 7'); end if;
  update public.push_config set ultimo_envio = ahora::date
   where id = 1 and (ultimo_envio is null or ultimo_envio < ahora::date);
  if not found then return jsonb_build_object('enviar', false, 'motivo', 'ya se envió hoy o faltan claves'); end if;
  r := public.ml_resumen();
  n := (r->>'entregas_hoy')::int;
  if n > 0 then partes := partes || (case when n = 1 then 'Hoy entregas 1 pedido' else 'Hoy entregas ' || n || ' pedidos' end); end if;
  n := (r->>'atrasados')::int;
  if n > 0 then partes := partes || (n || case when n = 1 then ' pedido atrasado' else ' pedidos atrasados' end); end if;
  n := (r->>'interesadas')::int;
  if n > 0 then partes := partes || (n || case when n = 1 then ' interesada sin responder' else ' interesadas sin responder' end); end if;
  if cardinality(partes) = 0 then return jsonb_build_object('enviar', false, 'motivo', 'nada pendiente hoy'); end if;
  if (r->>'deuda')::numeric > 0 then partes := partes || ('te deben ' || public.ml_dinero((r->>'deuda')::numeric)); end if;
  return jsonb_build_object('enviar', true, 'texto', array_to_string(partes, ' · '), 'resumen', r);
end $f$;

revoke all on function public.ml_resumen() from public, anon, authenticated;
revoke all on function public.ml_push_reclamar() from public, anon, authenticated;
grant execute on function public.ml_resumen() to service_role;
grant execute on function public.ml_push_reclamar() to service_role;

-- =====================================================================
-- Tarea diaria: 11:00 UTC = 7:00 am en Venezuela. Ejecutar SOLO esta parte
-- cuando la función "avisos" esté desplegada y un aviso de prueba haya llegado.
-- =====================================================================
-- select cron.unschedule(jobid) from cron.job where jobname = 'ml-avisos-diarios';
-- select cron.schedule('ml-avisos-diarios', '0 11 * * *', $c$
--   select net.http_post(
--     url := 'https://iblrgjsybhphrkcxwdmw.supabase.co/functions/v1/avisos',
--     headers := '{"Content-Type": "application/json"}'::jsonb,
--     body := '{"modo": "diario"}'::jsonb)
-- $c$);

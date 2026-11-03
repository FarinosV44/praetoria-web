-- Correcciones de la auditoría de seguridad (3/11/2026).

-- M5: el rol de autenticación resuelve sus tablas por su propio search_path, no por un parámetro de
-- arranque de la conexión, que el pooler de Supabase (Supavisor, modo transacción) no aplica.
alter role portal_auth set search_path = identidad;

-- M2: el resultado del antivirus solo lo escribe el analizador, nunca la aplicación ni el personal.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'portal_scan') then
    create role portal_scan nologin noinherit nobypassrls;
  end if;
end $$;
revoke update on portal.documentos from portal_app;
grant update (estado, motivo, revisado_por, revisado_at) on portal.documentos to portal_app;
grant usage on schema portal to portal_scan;
grant select (id, storage_key, mime, sha256, analisis) on portal.documentos to portal_scan;
grant update (analisis) on portal.documentos to portal_scan;
alter table portal.documentos add column if not exists analizado_at timestamptz;
grant update (analizado_at) on portal.documentos to portal_scan;
create policy analizar_leer on portal.documentos for select to portal_scan using (true);
create policy analizar on portal.documentos for update to portal_scan using (true) with check (true);

-- M2: no se valida un documento infectado ni (si el antivirus es obligatorio) uno sin analizar.
-- La obligación se activa por base de datos: portal.ajustes('antivirus_obligatorio') = 'true'.
create table if not exists portal.ajustes (clave text primary key, valor text not null);
grant select on portal.ajustes to portal_app, portal_scan;
alter table portal.ajustes enable row level security;
create policy leer_ajustes on portal.ajustes for select to portal_app, portal_scan using (true);

create or replace function portal.t_documento_cuarentena() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
declare obligatorio boolean;
begin
  if new.estado = 'valido' and new.estado is distinct from old.estado then
    if new.analisis = 'infectado' then
      raise exception 'Este archivo está bloqueado por el antivirus y no se puede validar' using errcode = '42501';
    end if;
    select coalesce((select valor = 'true' from portal.ajustes where clave = 'antivirus_obligatorio'), false) into obligatorio;
    if obligatorio and new.analisis <> 'limpio' then
      raise exception 'Este archivo aún no ha superado el análisis antivirus' using errcode = '42501';
    end if;
  end if;
  if new.analisis is distinct from old.analisis then
    new.analizado_at := now();
    perform portal.registrar_evento(new.solicitud_id, 'documento_analizado',
      jsonb_build_object('documento', new.id, 'resultado', new.analisis), false);
  end if;
  return new;
end $$;
drop trigger if exists documento_cuarentena on portal.documentos;
create trigger documento_cuarentena before update on portal.documentos for each row execute function portal.t_documento_cuarentena();
grant execute on function portal.t_documento_cuarentena() to portal_app, portal_scan;

-- Bajo: el personal no reescribe lo que el cliente envió (descripción y contraparte) sin dejar rastro.
create or replace function portal.t_solicitud_contenido_cliente() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if portal.es_personal() and old.estado <> 'borrador'
     and (new.descripcion is distinct from old.descripcion or new.contraparte is distinct from old.contraparte) then
    raise exception 'El despacho no modifica lo que escribió el cliente: usa una nota o un mensaje' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists solicitud_contenido_cliente on portal.solicitudes;
create trigger solicitud_contenido_cliente before update on portal.solicitudes for each row execute function portal.t_solicitud_contenido_cliente();
grant execute on function portal.t_solicitud_contenido_cliente() to portal_app;

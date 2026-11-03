-- 0007 · Asesor de seguridad de Supabase (lint 0011): toda función con search_path fijo,
-- para que no resuelva nombres según el rol o la sesión que la llame.
alter function portal.uid() set search_path = portal, pg_temp;
alter function portal.es_notificador() set search_path = portal, pg_temp;
alter function portal.t_perfil() set search_path = portal, pg_temp;
alter function portal.t_requisito_antes() set search_path = portal, pg_temp;
alter function portal.t_mensaje_antes() set search_path = portal, pg_temp;
alter function portal.t_nota_antes() set search_path = portal, pg_temp;
alter function portal.t_eventos_inmutables() set search_path = portal, pg_temp;

-- El registro de migraciones solo lo usa el propietario de la base de datos (sin acceso de la aplicación).
alter table migraciones.aplicadas enable row level security;
revoke all on schema migraciones from public;

-- 0018 · Datos procesales del expediente, vistas guardadas, análisis documental y propuestas de la IA.
-- Solo añade. Una propuesta de la IA no cambia nada por sí misma: crear la tarea o el plazo lo confirma una persona, y un plazo
-- propuesto nace como fecha sugerida y sin verificar. Las decisiones quedan registradas.

alter table portal.expedientes
  add column organo text check (length(organo) <= 200),
  add column numero_autos text check (length(numero_autos) <= 80),
  add column procedimiento_id uuid references portal.bib_procedimientos(id);
grant update (organo, numero_autos, procedimiento_id) on portal.expedientes to portal_app;

-- Filtros persistentes y vistas guardadas: de cada persona, invisibles para las demás.
create table portal.vistas_guardadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.personal(user_id) on delete cascade,
  pantalla text not null check (pantalla ~ '^[a-z_]{2,40}$'),
  nombre text not null check (length(nombre) between 1 and 60),
  consulta text not null default '' check (length(consulta) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, pantalla, nombre)
);
alter table portal.vistas_guardadas enable row level security;
create policy propias on portal.vistas_guardadas for all to portal_app using (user_id = portal.uid()) with check (user_id = portal.uid() and portal.es_personal());
grant select, insert, delete on portal.vistas_guardadas to portal_app;

-- Análisis de un documento hecho por la IA a petición de una persona. Es una lectura de apoyo, no un hecho del expediente.
create table portal.doc_analisis (
  documento_id uuid primary key references portal.documentos(id) on delete cascade,
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  tipo text not null check (length(tipo) <= 60),
  resumen text not null check (length(resumen) <= 20000),
  datos jsonb not null default '{}' check (jsonb_typeof(datos) = 'object'),
  modelo text,
  autor_id uuid not null references portal.personal(user_id),
  created_at timestamptz not null default now()
);
create index doc_analisis_solicitud on portal.doc_analisis (solicitud_id);
alter table portal.doc_analisis enable row level security;
create policy leer on portal.doc_analisis for select to portal_app using (portal.personal_ve(solicitud_id) and exists (select 1 from portal.documentos d where d.id = documento_id));
create policy crear on portal.doc_analisis for insert to portal_app with check (portal.personal_escribe(solicitud_id) and exists (select 1 from portal.documentos d where d.id = documento_id and d.solicitud_id = doc_analisis.solicitud_id));
create policy actualizar on portal.doc_analisis for update to portal_app using (portal.personal_escribe(solicitud_id)) with check (portal.personal_escribe(solicitud_id));
grant select, insert on portal.doc_analisis to portal_app;
grant update (tipo, resumen, datos, modelo, autor_id, created_at) on portal.doc_analisis to portal_app;

create table portal.ia_propuestas (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  documento_id uuid references portal.documentos(id) on delete cascade,
  tipo text not null check (tipo in ('tarea', 'plazo')),
  titulo text not null check (length(titulo) between 3 and 200),
  fecha date,
  fundamento text check (length(fundamento) <= 600),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'descartada')),
  decidido_por uuid references portal.personal(user_id),
  decidido_at timestamptz,
  created_at timestamptz not null default now()
);
create index ia_propuestas_solicitud on portal.ia_propuestas (solicitud_id, estado);
alter table portal.ia_propuestas enable row level security;
create policy leer on portal.ia_propuestas for select to portal_app using (portal.personal_ve(solicitud_id));
create policy crear on portal.ia_propuestas for insert to portal_app with check (portal.personal_escribe(solicitud_id));
grant select, insert on portal.ia_propuestas to portal_app;

-- Aceptar crea la tarea o el plazo sugerido sin verificar; descartar solo lo anota. Ambas cosas, una sola vez y auditadas.
create function portal.ia_propuesta_decidir(p_id uuid, p_aceptar boolean, p_fecha date) returns uuid language plpgsql security definer
set search_path = portal, pg_temp as $$
declare p portal.ia_propuestas; evento uuid; f date;
begin
  select * into p from portal.ia_propuestas where id = p_id for update;
  if not found or not portal.personal_escribe(p.solicitud_id) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p.estado <> 'pendiente' then raise exception 'Esta propuesta ya se decidió'; end if;
  if p_aceptar then
    f := coalesce(p_fecha, p.fecha);
    if f is null then raise exception 'Indica la fecha antes de aceptar'; end if;
    insert into portal.agenda_eventos (propietario_id, titulo, tipo, inicio, todo_el_dia, solicitud_id, avisos_min, documento_id, plazo_fuente, origen_fecha)
      values (portal.uid(), p.titulo, p.tipo, (f::text || ' 09:00')::timestamp at time zone 'Europe/Madrid', true, p.solicitud_id,
        case when p.tipo = 'plazo' then array[10080, 1440, 60] else array[0] end, p.documento_id,
        case when p.documento_id is null then 'Propuesta de la IA' else null end, case when p.tipo = 'plazo' then 'sugerida' else 'manual' end)
      returning id into evento;
  end if;
  update portal.ia_propuestas set estado = case when p_aceptar then 'aceptada' else 'descartada' end, decidido_por = portal.uid(), decidido_at = now() where id = p_id;
  insert into portal.ia_auditoria (user_id, accion, solicitud_id, detalle) values (portal.uid(), 'propuesta_' || case when p_aceptar then 'aceptada' else 'descartada' end, p.solicitud_id,
    jsonb_build_object('propuesta', p_id, 'tipo', p.tipo, 'evento', evento));
  return evento;
end $$;
revoke execute on function portal.ia_propuesta_decidir(uuid, boolean, date) from public;
grant execute on function portal.ia_propuesta_decidir(uuid, boolean, date) to portal_app;

-- 0013 · Biblioteca jurídica del despacho (#92) y catálogo de procedimientos (#93).
-- Los modelos son escritos PROPIOS del despacho que se suben aquí; el catálogo solo trae nombres de materias
-- y procedimientos (no hay ningún escrito inventado). Separado de la documentación de los expedientes.
--   · clase «maestro», «historico_anonimizado», «clausula», «estilo»: se comparten con el equipo SOLO cuando
--     la superadministración los aprueba tras revisar que no queda información identificable;
--   · clase «caso_privado»: escrito de un asunto concreto; solo lo ven la superadministración y su autor;
--   · cada versión es inmutable (archivo original + texto extraído); retirar un modelo lo marca obsoleto, no lo borra.

create table portal.bib_materias (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  nombre text not null check (length(nombre) between 2 and 80),
  orden int not null default 100,
  activa boolean not null default true
);

create table portal.bib_procedimientos (
  id uuid primary key default gen_random_uuid(),
  materia_id text not null references portal.bib_materias(id),
  nombre text not null check (length(nombre) between 3 and 160),
  orden int not null default 100,
  activo boolean not null default true,
  unique (materia_id, nombre)
);

create table portal.bib_modelos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(titulo) between 3 and 200),
  materia_id text references portal.bib_materias(id),
  procedimiento_id uuid references portal.bib_procedimientos(id),
  tipo_escrito text check (length(tipo_escrito) <= 80),
  variante text check (length(variante) <= 120),
  clase text not null default 'caso_privado' check (clase in ('maestro', 'historico_anonimizado', 'caso_privado', 'clausula', 'estilo')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'revision', 'aprobado', 'obsoleto')),
  etiquetas text[] not null default '{}',
  organo text check (length(organo) <= 160),
  posicion text check (posicion in ('actor', 'demandado', 'recurrente', 'neutral')),
  fecha_normativa date,
  autor_id uuid not null references portal.personal(user_id),
  solicitud_origen uuid references portal.solicitudes(id) on delete set null,
  anonimizado_por uuid references portal.personal(user_id),
  anonimizado_at timestamptz,
  aprobado_por uuid references portal.personal(user_id),
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bib_modelos_proc on portal.bib_modelos (procedimiento_id);

create table portal.bib_versiones (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references portal.bib_modelos(id) on delete cascade,
  version int not null,
  origen text not null check (origen in ('archivo', 'pegado')),
  storage_key text,
  nombre_original text check (length(nombre_original) <= 200),
  mime text,
  tamano int,
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  texto text not null default '' check (length(texto) <= 600000),
  avisos jsonb not null default '[]',            -- posibles datos identificables detectados
  nota text check (length(nota) <= 500),
  subido_por uuid not null references portal.personal(user_id),
  subido_at timestamptz not null default now(),
  unique (modelo_id, version),
  check ((origen = 'archivo') = (storage_key is not null))
);
create index bib_versiones_texto on portal.bib_versiones using gin (to_tsvector('spanish', texto));

-- Último uso de una versión concreta en un asunto (rastro para #94/#95).
create table portal.bib_usos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references portal.bib_versiones(id),
  solicitud_id uuid not null references portal.solicitudes(id) on delete cascade,
  user_id uuid not null references portal.personal(user_id),
  at timestamptz not null default now()
);

-- ── Quién ve qué ──────────────────────────────────────────────────────────────────────
create function portal.bib_puede_ver(m portal.bib_modelos) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select portal.es_global()
      or (portal.es_personal() and m.autor_id = portal.uid())
      or (coalesce(portal.rol_actual(), '') in ('abogado', 'apoyo', 'lectura') and m.estado = 'aprobado' and m.clase <> 'caso_privado')
$$;
create function portal.bib_ve_modelo(p_modelo uuid) returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select exists (select 1 from portal.bib_modelos m where m.id = p_modelo and portal.bib_puede_ver(m))
$$;
create function portal.bib_puede_subir() returns boolean language sql stable security definer
set search_path = portal, pg_temp as $$
  select coalesce(portal.rol_actual(), '') in ('administrador', 'abogado', 'apoyo')
$$;

alter table portal.bib_materias enable row level security;
alter table portal.bib_procedimientos enable row level security;
alter table portal.bib_modelos enable row level security;
alter table portal.bib_versiones enable row level security;
alter table portal.bib_usos enable row level security;

create policy leer on portal.bib_materias for select to portal_app using (portal.es_personal());
create policy gestionar on portal.bib_materias for all to portal_app using (portal.es_global()) with check (portal.es_global());
create policy leer on portal.bib_procedimientos for select to portal_app using (portal.es_personal());
create policy gestionar on portal.bib_procedimientos for all to portal_app using (portal.es_global()) with check (portal.es_global());

create policy leer on portal.bib_modelos for select to portal_app using (portal.bib_puede_ver(bib_modelos));
create policy crear on portal.bib_modelos for insert to portal_app with check (portal.bib_puede_subir() and autor_id = portal.uid());
-- Metadatos: el autor mientras no está aprobado; la superadministración siempre.
create policy editar on portal.bib_modelos for update to portal_app
  using (portal.es_global() or (autor_id = portal.uid() and estado in ('pendiente', 'revision') and portal.bib_puede_subir()))
  with check (portal.es_global() or (autor_id = portal.uid() and estado in ('pendiente', 'revision')));

create policy leer on portal.bib_versiones for select to portal_app using (portal.bib_ve_modelo(modelo_id));
create policy crear on portal.bib_versiones for insert to portal_app with check (
  portal.bib_puede_subir() and exists (select 1 from portal.bib_modelos m where m.id = modelo_id and (portal.es_global() or m.autor_id = portal.uid())));
create policy leer on portal.bib_usos for select to portal_app using (portal.personal_ve(solicitud_id));
create policy crear on portal.bib_usos for insert to portal_app with check (portal.personal_escribe(solicitud_id) and portal.bib_ve_modelo((select modelo_id from portal.bib_versiones where id = version_id)));

grant select on portal.bib_materias, portal.bib_procedimientos to portal_app;
grant insert, update, delete on portal.bib_materias, portal.bib_procedimientos to portal_app;
grant select, insert on portal.bib_modelos, portal.bib_versiones, portal.bib_usos to portal_app;
grant update (titulo, materia_id, procedimiento_id, tipo_escrito, variante, clase, etiquetas, organo, posicion, fecha_normativa, estado) on portal.bib_modelos to portal_app;

-- ── Reglas que no dependen de la interfaz ─────────────────────────────────────────────
create function portal.t_bib_modelo() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.autor_id := portal.uid(); new.estado := 'pendiente'; new.created_at := now();
    new.aprobado_por := null; new.aprobado_at := null; new.anonimizado_por := null; new.anonimizado_at := null;
  else
    new.id := old.id; new.autor_id := old.autor_id; new.created_at := old.created_at; new.solicitud_origen := old.solicitud_origen;
    new.anonimizado_por := old.anonimizado_por; new.anonimizado_at := old.anonimizado_at;
    new.aprobado_por := old.aprobado_por; new.aprobado_at := old.aprobado_at;
    if new.estado is distinct from old.estado then
      if new.estado = 'aprobado' then
        if not portal.es_global() then raise exception 'Solo la superadministración aprueba modelos' using errcode = '42501'; end if;
        -- Solo a través de bib_aprobar(), que exige confirmar la revisión de la anonimización.
        if coalesce(current_setting('portal.aprobando', true), '') <> new.id::text then
          raise exception 'Aprueba el modelo con la confirmación de anonimización' using errcode = '42501';
        end if;
        new.aprobado_por := portal.uid(); new.aprobado_at := now();
        new.anonimizado_por := portal.uid(); new.anonimizado_at := now();
      elsif old.estado = 'aprobado' and new.estado <> 'obsoleto' and not portal.es_global() then
        raise exception 'Sin permiso' using errcode = '42501';
      end if;
    end if;
    -- Un modelo aprobado que cambia de clase vuelve a revisión
    if old.estado = 'aprobado' and new.clase is distinct from old.clase and new.estado = 'aprobado' then
      new.estado := 'revision'; new.aprobado_por := null; new.aprobado_at := null;
    end if;
  end if;
  -- El procedimiento tiene que ser de la materia indicada
  if new.procedimiento_id is not null then
    select materia_id into new.materia_id from portal.bib_procedimientos where id = new.procedimiento_id;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger bib_modelo before insert or update on portal.bib_modelos for each row execute function portal.t_bib_modelo();

create function portal.t_bib_version() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  new.subido_por := portal.uid(); new.subido_at := now();
  select coalesce(max(version), 0) + 1 into new.version from portal.bib_versiones where modelo_id = new.modelo_id;
  if new.storage_key is not null and new.storage_key <> ('biblioteca/' || new.modelo_id::text || '/' || new.id::text) then
    raise exception 'Ruta de almacenamiento no válida' using errcode = '42501';
  end if;
  -- Una versión nueva de un modelo aprobado vuelve a revisión: lo aprobado es lo que se revisó.
  update portal.bib_modelos set estado = 'revision', aprobado_por = null, aprobado_at = null, updated_at = now()
   where id = new.modelo_id and estado = 'aprobado';
  return new;
end $$;
create trigger bib_version before insert on portal.bib_versiones for each row execute function portal.t_bib_version();

-- Aprobar para la biblioteca común: exige declarar que se ha revisado la anonimización (datos directos, indirectos y metadatos).
create function portal.bib_aprobar(p_modelo uuid, p_anonimizacion_revisada boolean) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare m portal.bib_modelos;
begin
  if not portal.es_global() then raise exception 'Solo la superadministración aprueba modelos' using errcode = '42501'; end if;
  select * into m from portal.bib_modelos where id = p_modelo for update;
  if not found then raise exception 'Modelo inexistente'; end if;
  if not exists (select 1 from portal.bib_versiones where modelo_id = p_modelo) then raise exception 'El modelo no tiene ninguna versión'; end if;
  if m.clase = 'caso_privado' then raise exception 'Un escrito de caso privado no se comparte: cámbialo a modelo histórico anonimizado o a maestro tras anonimizarlo'; end if;
  if not p_anonimizacion_revisada then raise exception 'Confirma que has revisado que no quedan datos identificables'; end if;
  perform set_config('portal.aprobando', p_modelo::text, true);
  update portal.bib_modelos set estado = 'aprobado' where id = p_modelo;
  perform set_config('portal.aprobando', '', true);
end $$;
grant execute on function portal.bib_puede_ver(portal.bib_modelos), portal.bib_ve_modelo(uuid), portal.bib_puede_subir(), portal.bib_aprobar(uuid, boolean) to portal_app;

-- ── Catálogo inicial (#93): solo nombres de materias y procedimientos, editables ───────
insert into portal.bib_materias (id, nombre, orden) values
  ('familia', 'Familia', 10), ('civil', 'Civil y procesal', 20), ('administrativo', 'Administrativo y tributario', 30),
  ('laboral', 'Laboral y Seguridad Social', 40), ('mercantil', 'Mercantil y societario', 50), ('penal', 'Penal', 60),
  ('transporte', 'Transporte, CMR y DeCA', 70), ('extranjeria', 'Extranjería', 80), ('masc', 'MASC y negociación', 90),
  ('transversal', 'Contratos y escritos transversales', 100);
insert into portal.bib_procedimientos (materia_id, nombre, orden) select m, p, o from (values
  ('familia', 'Convenio regulador de mutuo acuerdo', 1), ('familia', 'Demanda de divorcio de mutuo acuerdo', 2), ('familia', 'Demanda de divorcio contencioso', 3),
  ('familia', 'Medidas paterno-filiales', 4), ('familia', 'Medidas provisionales y coetáneas', 5), ('familia', 'Modificación de medidas', 6),
  ('familia', 'Ejecución de alimentos y régimen de visitas', 7), ('familia', 'Liquidación de gananciales', 8), ('familia', 'Escritos de prueba, aclaración y subsanación (familia)', 9),
  ('civil', 'Demanda de desahucio por falta de pago', 1), ('civil', 'Demanda de desahucio por expiración del plazo', 2), ('civil', 'Reclamación de rentas', 3),
  ('civil', 'Oposición al desahucio', 4), ('civil', 'Procedimiento monitorio', 5), ('civil', 'Oposición al monitorio', 6), ('civil', 'Juicio cambiario', 7),
  ('civil', 'Oposición al juicio cambiario', 8), ('civil', 'Reclamación de cantidad', 9), ('civil', 'Demanda de juicio verbal', 10), ('civil', 'Demanda de juicio ordinario', 11),
  ('civil', 'Contestación a la demanda', 12), ('civil', 'Reconvención', 13), ('civil', 'Demanda de ejecución', 14), ('civil', 'Recurso de reposición (civil)', 15),
  ('civil', 'Recurso de apelación', 16), ('civil', 'Contrato de arrendamiento y anexos', 17), ('civil', 'Requerimiento extrajudicial', 18),
  ('administrativo', 'Escrito de alegaciones', 1), ('administrativo', 'Contestación a requerimiento o subsanación', 2), ('administrativo', 'Recurso de reposición', 3),
  ('administrativo', 'Recurso de alzada', 4), ('administrativo', 'Reclamación económico-administrativa (TEAR/TEAC)', 5), ('administrativo', 'Solicitud de suspensión', 6),
  ('administrativo', 'Aplazamiento o fraccionamiento', 7), ('administrativo', 'Procedimiento sancionador: alegaciones', 8), ('administrativo', 'Recurso contencioso-administrativo', 9),
  ('laboral', 'Papeleta de conciliación', 1), ('laboral', 'Demanda por despido', 2), ('laboral', 'Reclamación de cantidad (laboral)', 3),
  ('laboral', 'Impugnación de alta médica', 4), ('laboral', 'Prestaciones e incapacidad', 5), ('laboral', 'Accidente de trabajo', 6), ('laboral', 'Recurso de suplicación', 7),
  ('mercantil', 'Impugnación de acuerdos sociales', 1), ('mercantil', 'Convocatoria de junta', 2), ('mercantil', 'Reclamación mercantil', 3),
  ('penal', 'Escrito de personación', 1), ('penal', 'Denuncia o querella', 2), ('penal', 'Escrito de defensa o acusación', 3), ('penal', 'Recurso (penal)', 4),
  ('transporte', 'Reclamación a transportista o cargador', 1), ('transporte', 'Reclamación a aseguradora (transporte)', 2), ('transporte', 'Reservas y comunicaciones (CMR)', 3),
  ('extranjeria', 'Solicitud o subsanación (extranjería)', 1), ('extranjeria', 'Recurso (extranjería)', 2),
  ('masc', 'Requerimiento previo (MASC)', 1), ('masc', 'Propuesta de acuerdo', 2),
  ('transversal', 'Hoja de encargo', 1), ('transversal', 'Burofax', 2), ('transversal', 'Escrito de mero trámite', 3)
) as t(m, p, o);

revoke execute on function portal.t_bib_modelo(), portal.t_bib_version() from public;
revoke execute on all functions in schema portal from public;

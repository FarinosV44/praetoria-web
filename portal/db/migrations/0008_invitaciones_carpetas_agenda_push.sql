-- 0008 · Alta del personal por invitación, carpetas documentales, agenda del despacho con avisos
-- programados, suscripciones Web Push y bandeja de avisos internos (issues #55, #73, #74).

-- ── Invitaciones del personal ─────────────────────────────────────────────────────────
-- Solo se guarda el SHA-256 del enlace: el enlace en claro existe una vez, para su destinatario.
create table portal.invitaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identidad."user"(id) on delete cascade,
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  expira_at timestamptz not null,
  usada_at timestamptz,
  created_at timestamptz not null default now()
);
alter table portal.invitaciones enable row level security;   -- sin políticas: solo por funciones

create function portal.invitacion_valida(p_sha text) returns uuid language sql stable security definer
set search_path = portal, pg_temp as $$
  select i.user_id from portal.invitaciones i
   where i.token_sha256 = p_sha and i.usada_at is null and i.expira_at > now()
$$;

create function portal.usar_invitacion(p_sha text) returns uuid language plpgsql security definer
set search_path = portal, pg_temp as $$
declare u uuid;
begin
  update portal.invitaciones set usada_at = now()
   where token_sha256 = p_sha and usada_at is null and expira_at > now()
   returning user_id into u;
  if u is null then raise exception 'Invitación no válida o caducada' using errcode = '42501'; end if;
  -- Una invitación usada invalida cualquier otra pendiente del mismo usuario.
  update portal.invitaciones set usada_at = now() where user_id = u and usada_at is null;
  return u;
end $$;
grant execute on function portal.invitacion_valida(text), portal.usar_invitacion(text) to portal_app;

-- ── Carpetas documentales ─────────────────────────────────────────────────────────────
alter table portal.requisitos add column carpeta text not null default 'Documentación del cliente'
  check (length(carpeta) between 2 and 80);

-- ── Agenda ────────────────────────────────────────────────────────────────────────────
create table portal.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references portal.personal(user_id),
  titulo text not null check (length(btrim(titulo)) between 2 and 200),
  tipo text not null default 'tarea' check (tipo in ('cita', 'reunion', 'llamada', 'vista', 'plazo', 'tarea', 'seguimiento', 'recordatorio', 'personal')),
  inicio timestamptz not null,
  duracion_min int not null default 60 check (duracion_min between 0 and 1440),
  todo_el_dia boolean not null default false,
  solicitud_id uuid references portal.solicitudes(id),
  prioridad text not null default 'normal' check (prioridad in ('normal', 'alta')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'completado', 'cancelado')),
  nota text check (length(nota) <= 2000),
  repeticion text not null default 'ninguna' check (repeticion in ('ninguna', 'diaria', 'semanal', 'mensual')),
  repetir_hasta date,
  avisos_min int[] not null default '{}' check (array_length(avisos_min, 1) is null or array_length(avisos_min, 1) <= 6),
  -- Fechas procesales: el sistema no las calcula ni las da por definitivas; las verifica el abogado.
  plazo_fuente text check (length(plazo_fuente) <= 300),
  plazo_verificado_por uuid references portal.personal(user_id),
  plazo_verificado_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agenda_eventos_prop on portal.agenda_eventos (propietario_id, inicio);

create table portal.agenda_avisos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references portal.agenda_eventos(id) on delete cascade,
  user_id uuid not null references identidad."user"(id),
  ocurrencia timestamptz not null,
  antelacion_min int not null check (antelacion_min between 0 and 60 * 24 * 60),
  disparo_at timestamptz not null,
  estado text not null default 'programado' check (estado in ('programado', 'enviado', 'error', 'cancelado')),
  intentos int not null default 0,
  ultimo_error text,
  enviado_at timestamptz,
  canales text,
  created_at timestamptz not null default now()
);
-- Nunca dos avisos vigentes para el mismo evento, ocurrencia y antelación (sin duplicados al replanificar).
create unique index agenda_avisos_unico on portal.agenda_avisos (evento_id, ocurrencia, antelacion_min) where estado <> 'cancelado';
create index agenda_avisos_pendientes on portal.agenda_avisos (disparo_at) where estado = 'programado';

create table portal.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identidad."user"(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null check (length(p256dh) between 40 and 200),
  auth text not null check (length(auth) between 10 and 100),
  dispositivo text check (length(dispositivo) <= 200),
  created_at timestamptz not null default now(),
  ultimo_envio_ok timestamptz,
  revocada_at timestamptz
);
create index push_suscripciones_user on portal.push_suscripciones (user_id) where revocada_at is null;

create table portal.avisos_internos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identidad."user"(id) on delete cascade,
  aviso_id uuid references portal.agenda_avisos(id) on delete set null,
  evento_id uuid references portal.agenda_eventos(id) on delete cascade,
  created_at timestamptz not null default now(),
  leido_at timestamptz
);
create index avisos_internos_user on portal.avisos_internos (user_id, created_at desc);

create table portal.entregas_push (
  id bigserial primary key,
  aviso_id uuid references portal.agenda_avisos(id) on delete set null,
  suscripcion_id uuid references portal.push_suscripciones(id) on delete set null,
  resultado text not null,
  http_status int,
  created_at timestamptz not null default now()
);

-- Planifica los avisos de las ocurrencias de un evento en los próximos 120 días (máx. 200).
-- La repetición se calcula en hora de Madrid, de modo que respeta el cambio de horario.
create function portal.agenda_planificar(p_evento uuid) returns int language plpgsql security definer
set search_path = portal, pg_temp as $$
declare e record; occ timestamptz; n int := 0; i int := 0; a int; local timestamp;
begin
  select * into e from portal.agenda_eventos where id = p_evento;
  if not found then return 0; end if;
  update portal.agenda_avisos set estado = 'cancelado'
   where evento_id = p_evento and estado = 'programado';
  if e.estado <> 'pendiente' or coalesce(array_length(e.avisos_min, 1), 0) = 0 then return 0; end if;
  local := e.inicio at time zone 'Europe/Madrid';
  loop
    occ := (local + case e.repeticion when 'diaria' then make_interval(days => i) when 'semanal' then make_interval(weeks => i)
                                       when 'mensual' then make_interval(months => i) else interval '0' end) at time zone 'Europe/Madrid';
    exit when occ > now() + interval '120 days' or i > 200;
    exit when e.repetir_hasta is not null and (occ at time zone 'Europe/Madrid')::date > e.repetir_hasta;
    foreach a in array e.avisos_min loop
      -- Si la hora del aviso ya pasó pero el evento aún no ha llegado, se avisa enseguida.
      if occ > now() then
        insert into portal.agenda_avisos (evento_id, user_id, ocurrencia, antelacion_min, disparo_at)
        values (e.id, e.propietario_id, occ, a, greatest(occ - make_interval(mins => a), now()))
        on conflict (evento_id, ocurrencia, antelacion_min) where estado <> 'cancelado' do nothing;
        n := n + 1;
      end if;
    end loop;
    exit when e.repeticion = 'ninguna';
    i := i + 1;
  end loop;
  return n;
end $$;

create function portal.t_agenda_antes() returns trigger language plpgsql
set search_path = portal, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if not portal.es_personal() then raise exception 'Sin permiso' using errcode = '42501'; end if;
    new.propietario_id := portal.uid();
    new.version := 1;
    new.created_at := now();
  else
    new.id := old.id; new.propietario_id := old.propietario_id; new.created_at := old.created_at;
    if (new.inicio, new.repeticion, new.repetir_hasta, new.avisos_min, new.estado)
       is distinct from (old.inicio, old.repeticion, old.repetir_hasta, old.avisos_min, old.estado) then
      new.version := old.version + 1;
    end if;
    -- Cambiar la fecha de un plazo anula su verificación: hay que volver a comprobarla.
    if new.tipo = 'plazo' and new.inicio is distinct from old.inicio then
      new.plazo_verificado_por := null; new.plazo_verificado_at := null;
    end if;
  end if;
  if new.plazo_verificado_at is not null and (tg_op = 'INSERT' or old.plazo_verificado_at is null) then
    new.plazo_verificado_por := portal.uid(); new.plazo_verificado_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger agenda_antes before insert or update on portal.agenda_eventos for each row execute function portal.t_agenda_antes();

create function portal.t_agenda_despues() returns trigger language plpgsql security definer
set search_path = portal, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then perform portal.agenda_planificar(new.id); end if;
  return null;
end $$;
create trigger agenda_despues after insert or update on portal.agenda_eventos for each row execute function portal.t_agenda_despues();

-- Toma los avisos vencidos (proceso notificador). Bloquea filas para que dos ejecuciones no envíen el mismo.
create function portal.tomar_avisos_agenda(p_limite int) returns table (aviso_id uuid, user_id uuid, evento_id uuid, intentos int)
language plpgsql security definer set search_path = portal, pg_temp as $$
begin
  if not portal.es_notificador() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return query
    with t as (
      select a.id from portal.agenda_avisos a
       where a.estado = 'programado' and a.disparo_at <= now() and a.intentos < 5
       order by a.disparo_at limit p_limite for update skip locked
    )
    -- Reserva de 5 minutos: si el proceso cae sin cerrar el aviso, se reintenta al vencer la reserva.
    update portal.agenda_avisos a set intentos = a.intentos + 1, disparo_at = now() + interval '5 minutes'
      from t where a.id = t.id
    returning a.id, a.user_id, a.evento_id, a.intentos;
end $$;

create function portal.suscripciones_de(p_user uuid) returns table (id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = portal, pg_temp as $$
  select s.id, s.endpoint, s.p256dh, s.auth from portal.push_suscripciones s
   where portal.es_notificador() and s.user_id = p_user and s.revocada_at is null
$$;

create function portal.registrar_entrega(p_aviso uuid, p_sus uuid, p_resultado text, p_http int) returns void
language plpgsql security definer set search_path = portal, pg_temp as $$
begin
  if not portal.es_notificador() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into portal.entregas_push (aviso_id, suscripcion_id, resultado, http_status) values (p_aviso, p_sus, left(p_resultado, 120), p_http);
  if p_sus is not null and p_resultado = 'ok' then update portal.push_suscripciones set ultimo_envio_ok = now() where id = p_sus; end if;
  -- 404/410: la suscripción ya no existe en el servicio de push (permiso revocado o app desinstalada).
  if p_sus is not null and p_http in (404, 410) then update portal.push_suscripciones set revocada_at = now() where id = p_sus and revocada_at is null; end if;
end $$;

create function portal.cerrar_aviso(p_aviso uuid, p_ok boolean, p_canales text, p_error text) returns void
language plpgsql security definer set search_path = portal, pg_temp as $$
declare a record;
begin
  if not portal.es_notificador() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into a from portal.agenda_avisos where id = p_aviso;
  if p_ok then
    update portal.agenda_avisos set estado = 'enviado', enviado_at = now(), canales = p_canales, ultimo_error = null where id = p_aviso;
    insert into portal.avisos_internos (user_id, aviso_id, evento_id) values (a.user_id, a.id, a.evento_id);
  else
    update portal.agenda_avisos set estado = case when intentos >= 5 then 'error' else 'programado' end,
      disparo_at = case when intentos >= 5 then disparo_at else now() + make_interval(mins => 2 * intentos) end,
      ultimo_error = left(p_error, 300) where id = p_aviso;
  end if;
end $$;

-- Mantiene planificadas las repeticiones lejanas (ejecución diaria).
create function portal.agenda_replanificar_recurrentes() returns int language plpgsql security definer
set search_path = portal, pg_temp as $$
declare r record; n int := 0;
begin
  if not portal.es_notificador() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  for r in select id from portal.agenda_eventos where estado = 'pendiente' and repeticion <> 'ninguna' loop
    n := n + portal.agenda_planificar(r.id);
  end loop;
  return n;
end $$;

-- Posponer un aviso ya recibido: crea uno nuevo para dentro de p_minutos (máx. 7 días).
create function portal.posponer_aviso(p_aviso uuid, p_minutos int) returns void language plpgsql security definer
set search_path = portal, pg_temp as $$
declare a record;
begin
  select * into a from portal.agenda_avisos where id = p_aviso and user_id = portal.uid();
  if not found then raise exception 'Aviso no encontrado' using errcode = '42501'; end if;
  if p_minutos < 5 or p_minutos > 60 * 24 * 7 then raise exception 'Intervalo no válido'; end if;
  insert into portal.agenda_avisos (evento_id, user_id, ocurrencia, antelacion_min, disparo_at)
  values (a.evento_id, a.user_id, now() + make_interval(mins => p_minutos), 0, now() + make_interval(mins => p_minutos));
  update portal.avisos_internos set leido_at = coalesce(leido_at, now()) where aviso_id = p_aviso and user_id = portal.uid();
end $$;

-- ── RLS: cada profesional ve y gestiona solo su agenda, sus dispositivos y sus avisos ─
alter table portal.agenda_eventos enable row level security;
create policy propia on portal.agenda_eventos for all to portal_app
  using (propietario_id = portal.uid() and portal.es_personal())
  with check (propietario_id = portal.uid() and portal.es_personal());
alter table portal.agenda_avisos enable row level security;
create policy propios on portal.agenda_avisos for select to portal_app using (user_id = portal.uid());
create policy emisor on portal.agenda_avisos for select to portal_app using (portal.es_notificador());
alter table portal.push_suscripciones enable row level security;
create policy propias on portal.push_suscripciones for all to portal_app using (user_id = portal.uid()) with check (user_id = portal.uid());
alter table portal.avisos_internos enable row level security;
create policy propios on portal.avisos_internos for select to portal_app using (user_id = portal.uid());
create policy marcar on portal.avisos_internos for update to portal_app using (user_id = portal.uid()) with check (user_id = portal.uid());
alter table portal.entregas_push enable row level security;
create policy propias on portal.entregas_push for select to portal_app
  using (exists (select 1 from portal.agenda_avisos a where a.id = aviso_id and a.user_id = portal.uid()));

grant select, insert, update on portal.agenda_eventos to portal_app;
grant select on portal.agenda_avisos, portal.entregas_push to portal_app;
grant select, insert, update on portal.push_suscripciones to portal_app;
grant select, update (leido_at) on portal.avisos_internos to portal_app;
grant execute on function portal.tomar_avisos_agenda(int), portal.suscripciones_de(uuid), portal.registrar_entrega(uuid, uuid, text, int),
  portal.cerrar_aviso(uuid, boolean, text, text), portal.agenda_replanificar_recurrentes(), portal.posponer_aviso(uuid, int),
  portal.t_agenda_antes(), portal.t_agenda_despues() to portal_app;
revoke execute on function portal.agenda_planificar(uuid) from public;

-- Prueba de aislamiento del portal (#56): dos clientes ficticios (A y B) y una persona del despacho.
-- Se ejecuta entera dentro de una transacción que se deshace: no deja datos en la base.
-- Uso: pegar en el editor SQL de Supabase (o execute_sql) y comprobar que todas las filas tienen ok = true.
begin;
create temp table resultado (prueba text, ok boolean, detalle text) on commit drop;
grant all on resultado to authenticated, anon;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-4000-8000-000000000001','authenticated','authenticated','a@ficticio.test','x',now(),'{}','{"full_name":"Cliente A"}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-4000-8000-000000000002','authenticated','authenticated','b@ficticio.test','x',now(),'{}','{"full_name":"Cliente B"}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','cccccccc-0000-4000-8000-000000000003','authenticated','authenticated','s@ficticio.test','x',now(),'{}','{"full_name":"Abogado"}',now(),now());
insert into public.staff (user_id, role) values ('cccccccc-0000-4000-8000-000000000003','abogado');
insert into resultado select 'perfil automático al registrarse', count(*)=3, count(*)::text from public.profiles where id::text like '%-0000-4000-8000-00000000000%';

-- Cliente A
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.intakes (area, description) values ('laboral','Me han despedido y quiero revisar la carta y la indemnización.');
insert into resultado select 'A crea su solicitud en borrador', status='borrador', reference from public.intakes;
insert into storage.objects (bucket_id, name, owner_id) select 'intake-documents', id||'/doc-1.pdf', auth.uid()::text from public.intakes;
insert into resultado select 'A sube un fichero a su carpeta del bucket', count(*)=1, count(*)::text from storage.objects where bucket_id='intake-documents';
insert into public.intake_documents (intake_id, storage_path, original_name, mime_type, size_bytes)
  select id, id||'/doc-1.pdf','carta.pdf','application/pdf',1000 from public.intakes;
insert into resultado select 'A aporta un documento', count(*)=1, count(*)::text from public.intake_documents;
do $$ begin
  begin update public.intakes set status='aceptada'; insert into resultado values ('A no puede cambiar el estado', false, 'lo cambió');
  exception when insufficient_privilege then insert into resultado values ('A no puede cambiar el estado', true, sqlerrm); end;
end $$;
select public.submit_intake(id) from public.intakes;
insert into resultado select 'A envía: pendiente de revisión', status='pendiente_de_revision', status::text from public.intakes;
update public.intakes set description='intento de editar tras enviar';
insert into resultado select 'A no edita tras enviar', description not like 'intento%', description from public.intakes;
do $$ begin
  begin insert into public.intake_documents (intake_id, storage_path, original_name, mime_type, size_bytes)
    select id, id||'/doc-2.pdf','otro.pdf','application/pdf',1000 from public.intakes;
    insert into resultado values ('A no añade documentos tras enviar', false, 'añadió');
  exception when insufficient_privilege then insert into resultado values ('A no añade documentos tras enviar', true, sqlerrm); end;
end $$;
do $$ begin
  begin perform public.set_intake_status((select id from public.intakes limit 1),'aceptada');
    insert into resultado values ('A no usa la función del despacho', false, 'pudo');
  exception when insufficient_privilege then insert into resultado values ('A no usa la función del despacho', true, sqlerrm); end;
end $$;
insert into public.intake_messages (intake_id, body) select id, 'Adjunto la carta' from public.intakes;

-- Cliente B
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into resultado select 'B no ve la solicitud de A', count(*)=0, count(*)::text from public.intakes;
insert into resultado select 'B no ve documentos de A', count(*)=0, count(*)::text from public.intake_documents;
insert into resultado select 'B no ve ficheros de A en el bucket', count(*)=0, count(*)::text from storage.objects where bucket_id='intake-documents';
insert into resultado select 'B no ve mensajes de A', count(*)=0, count(*)::text from public.intake_messages;
insert into resultado select 'B no ve eventos de A', count(*)=0, count(*)::text from public.intake_events;
insert into resultado select 'B no ve el perfil de A', count(*)=1, count(*)::text from public.profiles;
do $$ declare v uuid; begin
  reset role; select id into v from public.intakes limit 1; set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}',true);
  begin insert into storage.objects (bucket_id, name, owner_id) values ('intake-documents', v||'/intruso.pdf', auth.uid()::text);
    insert into resultado values ('B no sube ficheros a la carpeta de A', false, 'subió');
  exception when insufficient_privilege then insert into resultado values ('B no sube ficheros a la carpeta de A', true, sqlerrm); end;
  begin insert into public.intake_documents (intake_id, storage_path, original_name, mime_type, size_bytes) values (v, v||'/intruso.pdf','x.pdf','application/pdf',10);
    insert into resultado values ('B no registra documentos en la solicitud de A', false, 'pudo');
  exception when insufficient_privilege then insert into resultado values ('B no registra documentos en la solicitud de A', true, sqlerrm); end;
  begin insert into public.intake_messages (intake_id, body) values (v, 'mensaje intruso');
    insert into resultado values ('B no escribe en el hilo de A', false, 'escribió');
  exception when insufficient_privilege then insert into resultado values ('B no escribe en el hilo de A', true, sqlerrm); end;
  begin perform public.submit_intake(v); insert into resultado values ('B no envía la solicitud de A', false, 'pudo');
  exception when others then insert into resultado values ('B no envía la solicitud de A', true, sqlerrm); end;
end $$;
update public.intakes set description='hackeado';
do $$ begin
  begin insert into public.company_members (company_id, user_id, verified) select gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000002', true;
    insert into resultado values ('B no se autoverifica en una empresa', false, 'pudo');
  exception when others then insert into resultado values ('B no se autoverifica en una empresa', true, sqlerrm); end;
end $$;

-- Visitante sin sesión
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  begin perform count(*) from public.intakes; insert into resultado values ('Sin sesión no se lee nada', false, 'leyó');
  exception when insufficient_privilege then insert into resultado values ('Sin sesión no se lee nada', true, sqlerrm); end;
  begin perform private.is_staff(); insert into resultado values ('Sin sesión no se llaman las funciones internas', false, 'pudo');
  exception when insufficient_privilege then insert into resultado values ('Sin sesión no se llaman las funciones internas', true, sqlerrm); end;
end $$;

-- Despacho
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}',true);
insert into resultado select 'El despacho ve la solicitud', count(*)=1, count(*)::text from public.intakes;
insert into resultado select 'El despacho ve el fichero', count(*)=1, count(*)::text from storage.objects where bucket_id='intake-documents';
insert into resultado select 'B no modificó la solicitud de A', count(*)=0, count(*)::text from public.intakes where description='hackeado';
insert into public.intake_messages (intake_id, body, internal) select id, 'Nota interna: revisar conflicto', true from public.intakes;
do $$ begin
  begin perform public.set_intake_status((select id from public.intakes limit 1), 'rechazada');
    insert into resultado values ('Rechazar exige motivo', false, 'sin motivo');
  exception when check_violation then insert into resultado values ('Rechazar exige motivo', true, sqlerrm); end;
end $$;
select public.set_intake_status(id, 'informacion_solicitada', 'Falta la nómina del último mes') from public.intakes;

-- De nuevo A
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into resultado select 'A no ve la nota interna', count(*)=1, string_agg(body, ' | ') from public.intake_messages;
insert into resultado select 'A ve el historial visible', count(*)>=4, string_agg(kind, ', ' order by id) from public.intake_events;
insert into public.intake_documents (intake_id, storage_path, original_name, mime_type, size_bytes)
  select id, id||'/nomina.pdf','nomina.pdf','application/pdf',2000 from public.intakes;
insert into resultado select 'A aporta lo pedido tras la solicitud de información', count(*)=2, count(*)::text from public.intake_documents;
do $$ begin
  begin delete from storage.objects where bucket_id='intake-documents';
    insert into resultado select 'A no borra ficheros aportados', count(*)=1, count(*)::text from storage.objects where bucket_id='intake-documents';
  exception when insufficient_privilege then insert into resultado values ('A no borra ficheros aportados', true, sqlerrm); end;
end $$;

reset role;
select prueba, ok, left(detalle, 90) as detalle from resultado;
rollback;

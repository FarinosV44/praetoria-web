-- 0004 · Catálogo inicial de tipos de asunto y plantillas documentales.
-- Son plantillas EDITABLES desde el panel del despacho (/despacho/plantillas/), no exigencias
-- universales: el abogado las adapta en cada solicitud. Minimización: no se piden datos de salud
-- ni otras categorías especiales por defecto; el abogado los solicita solo si hacen falta.

insert into portal.tipos_asunto (id, nombre, descripcion, area, orden) values
  ('despido', 'Me han despedido', 'Despido, carta de despido o fin de contrato que no esperabas.', 'laboral', 10),
  ('salarios', 'Me deben salarios o el finiquito', 'Nóminas sin pagar, horas extra, finiquito o liquidación incorrecta.', 'laboral', 20),
  ('accidente-laboral', 'He tenido un accidente de trabajo', 'Accidente en el trabajo o de camino, y sus consecuencias.', 'laboral', 30),
  ('divorcio', 'Divorcio o separación', 'Divorcio, separación, custodia, pensiones o reparto de bienes.', 'familia', 40),
  ('transporte', 'Transporte: portes impagados o mercancía', 'Portes sin cobrar, mercancía perdida, dañada o entregada con retraso.', 'transporte', 50),
  ('otro', 'Otro asunto', 'Cuéntanos qué ocurre y te diremos qué necesitamos.', 'general', 90);

create function pg_temp.plantilla(tipo text, nombre text, items jsonb) returns void language plpgsql as $$
declare pid uuid; it jsonb; n int := 0;
begin
  insert into portal.plantillas (tipo_asunto_id, nombre) values (tipo, nombre) returning id into pid;
  for it in select * from jsonb_array_elements(items) loop
    n := n + 10;
    insert into portal.plantilla_items (plantilla_id, titulo, explicacion, ejemplo, obligatorio, multiple, orden)
    values (pid, it->>'t', it->>'e', it->>'x', coalesce((it->>'o')::boolean, true), coalesce((it->>'m')::boolean, false), n);
  end loop;
end $$;

select pg_temp.plantilla('despido', 'Despido', '[
  {"t":"Carta de despido","e":"Es el documento que explica el motivo y la fecha del despido. De ella dependen los plazos para reclamar.","x":"La carta o el burofax que te entregó la empresa, por todas sus caras."},
  {"t":"Contrato de trabajo","e":"Nos permite comprobar tu categoría, jornada, antigüedad y condiciones pactadas.","x":"El contrato y, si las hay, prórrogas o modificaciones."},
  {"t":"Últimas nóminas","e":"Sirven para calcular el salario real y la posible indemnización.","x":"Las tres últimas nóminas. Puedes subir varios archivos.","m":true},
  {"t":"Informe de vida laboral","e":"Confirma tu antigüedad y tus periodos de alta. Se descarga en la sede electrónica de la Seguridad Social.","o":false},
  {"t":"Finiquito o liquidación","e":"Si te han ofrecido o firmado un finiquito, necesitamos verlo, esté firmado o no.","o":false},
  {"t":"Comunicaciones relevantes","e":"Correos, mensajes o avisos con la empresa relacionados con el despido.","x":"Capturas de pantalla o correos en PDF.","o":false,"m":true}
]');

select pg_temp.plantilla('salarios', 'Salarios y finiquito', '[
  {"t":"Contrato de trabajo","e":"Nos permite comprobar el salario y las condiciones pactadas."},
  {"t":"Nóminas del periodo que reclamas","e":"Son la base para calcular lo que te deben.","m":true},
  {"t":"Finiquito o liquidación","e":"Si te lo han entregado, aunque no lo hayas firmado.","o":false},
  {"t":"Registro de jornada u otra prueba de las horas","e":"Solo si reclamas horas extra.","o":false,"m":true},
  {"t":"Comunicaciones con la empresa","e":"Correos o mensajes en los que hayas reclamado el pago.","o":false,"m":true}
]');

select pg_temp.plantilla('accidente-laboral', 'Accidente de trabajo', '[
  {"t":"Parte de accidente de trabajo","e":"Si la empresa lo emitió, recoge cómo y cuándo ocurrió el accidente.","o":false},
  {"t":"Comunicaciones de la empresa","e":"Correos, cartas o mensajes de la empresa sobre el accidente.","o":false,"m":true},
  {"t":"Documentos de la mutua o del INSS","e":"Resoluciones o cartas de la mutua o de la Seguridad Social. Los informes médicos solo te los pediremos si hacen falta.","o":false,"m":true},
  {"t":"Nóminas anteriores al accidente","e":"Sirven para calcular prestaciones e indemnizaciones.","m":true},
  {"t":"Otras pruebas","e":"Fotografías del lugar o datos de testigos, si los tienes.","o":false,"m":true}
]');

select pg_temp.plantilla('divorcio', 'Divorcio o separación', '[
  {"t":"Libro de familia o certificado de matrimonio","e":"Acredita el matrimonio y, en su caso, los hijos en común."},
  {"t":"Información económica","e":"Nos ayuda a valorar pensiones y gastos: nóminas recientes o la última declaración de la renta.","m":true},
  {"t":"Vivienda e hipoteca","e":"Solo si hay vivienda o préstamo en común: escritura, recibo de hipoteca o contrato de alquiler.","o":false,"m":true},
  {"t":"Convenio o acuerdos previos","e":"Si ya existe un convenio regulador o una sentencia anterior.","o":false},
  {"t":"Otra documentación","e":"Cualquier documento que te pidamos más adelante.","o":false,"m":true}
]');

select pg_temp.plantilla('transporte', 'Transporte', '[
  {"t":"Orden de transporte o encargo","e":"Demuestra quién encargó el servicio y en qué condiciones."},
  {"t":"CMR o carta de porte","e":"Mejor si está firmada en destino y con las reservas anotadas, si las hubo.","m":true},
  {"t":"Facturas","e":"Las facturas pendientes de cobro o las de la mercancía afectada.","m":true},
  {"t":"Prueba de entrega","e":"Albaranes firmados u otra prueba de que la mercancía se entregó.","o":false,"m":true},
  {"t":"Correspondencia entre las partes","e":"Correos y mensajes con el cargador, el destinatario o la aseguradora.","o":false,"m":true},
  {"t":"Fotografías","e":"Si la mercancía llegó dañada, fotografías del estado en destino.","o":false,"m":true}
]');

select pg_temp.plantilla('otro', 'Otro asunto', '[
  {"t":"Documentos sobre tu asunto","e":"Si ya tienes algún documento relacionado, súbelo aquí. Después te diremos si necesitamos algo más.","o":false,"m":true}
]');

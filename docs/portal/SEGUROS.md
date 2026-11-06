# Seguros (gestor de seguros en la superadministración)

Menú **Seguros** del panel del despacho (`/admin/seguros/`). Es el «PRAETORIA gestor de seguros»
(repositorio FarinosV44/POLIZAS-SEGURO, issues #1–#11) integrado en esta aplicación: pólizas de empresas y
particulares, anualidades e histórico, documentos privados con lectura revisable, avisos de vencimiento y de
plazo de oposición, siniestros con asistente de cobertura, renegociación, exportación y copias.

## Subir pólizas: la IA lee, guarda y organiza

No hay que escribir datos a mano. En **Seguros › Subir pólizas** (o en la ficha de una póliza) se suben los
documentos —condiciones particulares y generales, suplementos, recibos, renovaciones; PDF o fotos, hasta 10 a la vez—
y la IA (`src/seguros/lib/ia/importacion.ts`):

1. Agrupa los documentos por póliza e identifica tomador (titular empresa o particular, con su NIF), tipo de seguro,
   aseguradora, número, objeto asegurado, fechas, prima, forma de pago, recibo, plazo de oposición, contactos y
   coberturas (garantías, exclusiones, franquicias, capitales).
2. Lo guarda organizado: crea el titular si no existe (lo reconoce por NIF o nombre), crea la póliza o completa la
   que ya existía (misma aseguradora y número), crea la anualidad (una renovación es una anualidad nueva) y adjunta
   los documentos con su tipo.
3. **Nada inventado**: solo guarda un dato si figura en el documento, con su página y una cita literal que se
   comprueba contra el texto del PDF. Si la cita no aparece o la lectura es dudosa, el dato queda **pendiente**.
   Lo ya guardado no se sobrescribe: si un documento dice otra cosa, se muestra como discrepancia.
4. Cada dato guarda su procedencia (documento y página), visible en la ficha.

**Lo que no está en la póliza se busca en internet** (`src/seguros/lib/ia/contactos.ts`): teléfono para declarar
siniestros, asistencia 24 horas y web de siniestros de esa aseguradora y ese tipo de seguro. Solo se guarda si la
página citada salió de verdad en la búsqueda y el teléfono es un número español válido; queda con su fuente y fecha
(«Encontrado en internet: aseguradora.es»). Se reutiliza 180 días por aseguradora y tipo de seguro.

Usa `ANTHROPIC_API_KEY` (la del portal). La búsqueda usa la herramienta de búsqueda web de la API de Anthropic, que
se factura aparte por búsqueda en la misma cuenta y debe estar permitida en la organización de la consola; si no lo
está, el resultado lo dice y el resto de datos se guardan igualmente.

## Expediente permanente de cada seguro

Cada póliza es un expediente que no se rehace al renovar: la póliza original, condiciones generales y particulares,
suplementos y modificaciones, renovaciones, recibos y justificantes, cartas y correos, documentación de siniestros
(informes, fotografías, reclamaciones), notas y escritos quedan en el **mismo seguro**, ordenados por tipo y fecha.

- **Expediente** (pestaña): cronología única (documentos, notas, comunicaciones enviadas y recibidas, modificaciones,
  recibos, periodos, siniestros y escritos) con búsqueda también dentro del texto de los documentos. Las notas propias
  se marcan como «sin acreditar».
- Un documento de siniestro se **vincula** al siniestro (`documento_siniestros`), sin copiar el archivo.
- Un recibo o una renovación nunca crean una póliza nueva: la IA los asigna al seguro y periodo existentes; solo
  las condiciones particulares, renovaciones y suplementos definen datos de un periodo (`definePeriodo`).
- **Condiciones**: «Condiciones aplicables el…» muestra el periodo, las modificaciones con efecto hasta esa fecha y los
  documentos de condiciones de ese periodo; también las modificaciones de periodos anteriores, avisando de que pueden
  seguir aplicando salvo que la renovación diga otra cosa. Sirve para consultar las condiciones de la fecha de un siniestro
  aunque después se haya renovado.

## Recibos, pagos y previsión

- Cada recibo guarda periodo, fecha prevista de cargo, **fecha real de pago**, importe, periodicidad, estado
  (`previsto`, `pendiente`, `pagado`, `devuelto`, `anulado`), el documento del recibo y el justificante. Un recibo
  emitido no es un pago: «pagado» exige fecha de pago (también en la base de datos).
- La IA extrae los recibos y justificantes que se suben (quedan «por revisar» hasta que alguien los confirma o
  corrige) y evita duplicados por número o por periodo e importe. La lista muestra la subida respecto al anterior.
- **Pagos** (`/admin/seguros/pagos/`): previsión mensual por seguro y titular, totales de este mes, próximos 3 meses,
  resto del año y 12 meses, en lista o calendario, filtrable por titular. Distingue **pagado**, **confirmado** (recibo
  emitido con fecha) y **estimado** (periodicidad + último importe, sin fecha exacta inventada); un recibo real
  sustituye a la estimación de su periodo, así que nada se cuenta dos veces.
- El panel muestra por fila titular, tipo y objeto, aseguradora, importe y periodicidad, **próximo cobro**,
  **vencimiento** y **fecha límite de oposición** por separado, estado y avisos; ordena por próximo cobro o
  vencimiento y agrupa por titular o tipo.

## Asistente de IA del seguro y escritos

- Pestaña **Asistente IA** de cada póliza: conversaciones propias del seguro (y, si se abren desde un asunto, de ese
  asunto). El servidor construye el contexto solo con ese expediente, después de comprobar el permiso del usuario,
  y elige las páginas relevantes de sus documentos (las del siniestro y las condiciones del periodo del hecho primero).
- Las respuestas citan documento, página y fecha; cada cita se **comprueba** contra el texto del PDF y se marca
  «cita comprobada» o «la cita no aparece en el documento». Separa condiciones vigentes hoy de las aplicables en la
  fecha del hecho, hechos documentados de notas propias y comunicaciones anteriores de posteriores.
- **Asuntos** (cada siniestro crea el suyo; se pueden abrir otros): resumen con qué ha ocurrido, última actuación,
  respuesta recibida, documentación pendiente y siguiente paso. Si no hay respuesta acreditada dice «No consta
  respuesta posterior a la última actuación» y nunca cierra el asunto por su cuenta. Al entrar documentos o
  comunicaciones nuevas el resumen se marca como desactualizado para regenerarlo.
- **Escritos** desde el chat (declarar un siniestro, contestar una petición, reclamar falta de respuesta, revisar una
  denegación, revisión de prima, comunicar una circunstancia): usa los datos del expediente; si falta un dato
  imprescindible lo pregunta y no redacta. El borrador se guarda en el seguro y su asunto
  (`/admin/seguros/polizas/<id>/escritos/<escrito>/`), con versiones, copia y descarga en Word o texto.
  **Generar no es enviar**: el envío (fecha, medio, destinatario, versión) y la respuesta se registran después y pasan
  al expediente como comunicaciones.
- Las respuestas se procesan en segundo plano (`after()`), con respaldo en el cron cada minuto. Límite: 200 consultas
  de IA por persona y día. Sin `ANTHROPIC_API_KEY` la pestaña dice «Asistente sin configurar» y no deja preguntar.

## Quién entra

- Solo **superadministración**: personal activo con rol `administrador` y, si `STAFF_MFA_REQUIRED` no es
  `false`, con doble factor. Lo comprueba el servidor en cada página, acción y descarga
  (`src/seguros/lib/auth/servidor.ts` → `requerirGlobal`). Para el resto, el menú no aparece, las páginas
  redirigen a `/admin/` y las descargas responden 404.
- No hay usuarios ni contraseñas propias: la primera vez que una persona de superadministración entra, se crea
  (o se vincula por correo) su cuenta interna del gestor, sin contraseña (`seguros/db/migrations/0005_portal.sql`).

## Datos

- Base de datos: esquema **`seguros`** del mismo proyecto de Supabase, con su propio rol **`seguros_app`**
  (`search_path = seguros`). Pool propia, separada de `portal_app`; los dos esquemas no se ven entre sí
  salvo por la lectura de dispositivos de avisos, que se hace con el rol notificador del portal.
- Documentos: bucket privado **`seguros-documentos`** de Supabase Storage, con la misma conexión del portal
  (`STORAGE_URL`, `STORAGE_SERVICE_KEY`). Se suben por `/api/seguros/subida/` (mismo origen, autorización de un
  solo uso, tipo real y hash comprobados) y se sirven solo por `/api/seguros/documentos/…` tras comprobar permisos.
- Fechas `YYYY-MM-DD` en Europe/Madrid e importes como texto decimal, solo en la pool de seguros (los tipos de
  `pg` del portal no se tocan).

## Avisos en la app de Praetoria

1. Cada persona instala Praetoria y activa los avisos en **App móvil** (`/admin/app/`), como para la agenda.
2. En cada ejecución del cron (`/api/interno/avisos/`, cada minuto), cada 10 minutos el gestor copia esos
   dispositivos (rol notificador: solo lee suscripciones), planifica, emite y envía los avisos, con cola
   idempotente y reintentos. Un fallo del gestor nunca detiene los avisos del despacho.
3. La notificación llega por el service worker del portal con el texto neutro de siempre («Tienes un aviso
   pendiente en Praetoria») y abre `/admin/seguros/avisos/<id>/` tras iniciar sesión.
4. En **Seguros › Avisos › Avisos en el móvil** se ve qué dispositivos reciben avisos y se envía una prueba real.
   Sin claves VAPID aparece «sin configurar»; no se simula ningún envío. Correo de respaldo opcional (SMTP del portal).

Reglas: un mes natural antes del vencimiento, antes del plazo de oposición solo si está confirmado con su
fuente, recordatorio y póliza vencida (detalle en POLIZAS-SEGURO `docs/AVISOS.md`).

## Configuración (Hostinger → variables de entorno)

| Variable | Obligatoria | Valor |
| --- | --- | --- |
| `DATABASE_URL_SEGUROS` | Sí | `postgresql://seguros_app.<ref>:<contraseña>@<pooler>:5432/postgres?sslmode=require&uselibpqcompat=true` (rol `seguros_app`). Puerto **5432** (pooler de sesión), no el 6543 de `DATABASE_URL_APP`: el motor de avisos usa un candado de sesión (`pg_try_advisory_lock`) para no ejecutarse dos veces a la vez, y el pooler de transacciones no lo conserva |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Para push | Las mismas del portal |
| `STORAGE_URL`, `STORAGE_SERVICE_KEY` | Sí | Las del portal (bucket `seguros-documentos`; otro con `SEGUROS_STORAGE_BUCKET`) |
| `ANTHROPIC_API_KEY` | Para IA | La del portal; modelo `ANTHROPIC_MODEL` o `IA_MODELO` |
| `SMTP_*` | No | Las del portal (correo de respaldo) |
| `MAX_UPLOAD_MB` | No (25) | Tamaño máximo por documento |

Sin `DATABASE_URL_SEGUROS`, la página Seguros muestra «Sin configurar» y el cron lo omite.

Migraciones del gestor (con `DATABASE_URL_SEGUROS` en `.env.local`): `npm run seguros:migrate`. Las 0001–0005 ya están
aplicadas en Supabase (la 0005, vinculación con el portal, el 05/11/2026 con autorización del propietario). La 0006
(subir pólizas con IA y contactos de internet) está aplicada. La **0007** (expediente, recibos, asuntos,
conversaciones y escritos; solo añade tablas y columnas, no borra nada) se aplica antes de desplegar esta versión.

**Comprobar**: entrar como superadministración → menú Seguros → «Ajustes › Estado y avisos» muestra la última
ejecución; «Avisos en el móvil» → «Comprobar y enviar prueba» debe hacer sonar el móvil.

## Pruebas (solo datos sintéticos)

```bash
SEGUROS_DATABASE_URL_TEST=postgres://…/polizas_test npm run seguros:test     # PostgreSQL real
CHROMIUM_PATH=… npx playwright test -c seguros/playwright.config.ts          # interfaz (pila local, ver el spec)
```

Capturas con datos ficticios: `docs/portal/capturas/seguros-*.png`.

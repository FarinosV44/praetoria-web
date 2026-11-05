# Seguros (gestor de seguros en la superadministración)

Menú **Seguros** del panel del despacho (`/admin/seguros/`). Es el «PRAETORIA gestor de seguros»
(repositorio FarinosV44/POLIZAS-SEGURO, issues #1–#11) integrado en esta aplicación: pólizas de empresas y
particulares, anualidades e histórico, documentos privados con lectura revisable, avisos de vencimiento y de
plazo de oposición, siniestros con asistente de cobertura, renegociación, exportación y copias.

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
aplicadas en Supabase (la 0005, vinculación con el portal, el 05/11/2026 con autorización del propietario).

**Comprobar**: entrar como superadministración → menú Seguros → «Ajustes › Estado y avisos» muestra la última
ejecución; «Avisos en el móvil» → «Comprobar y enviar prueba» debe hacer sonar el móvil.

## Pruebas (solo datos sintéticos)

```bash
SEGUROS_DATABASE_URL_TEST=postgres://…/polizas_test npm run seguros:test     # 77 pruebas, PostgreSQL real
CHROMIUM_PATH=… npx playwright test -c seguros/playwright.config.ts          # interfaz (pila local, ver el spec)
```

Capturas con datos ficticios: `docs/portal/capturas/seguros-*.png`.

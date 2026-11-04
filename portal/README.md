# Área de clientes de Praetoria Abogados (`portal/`)

Aplicación privada separada de la web pública. Arquitectura y decisiones: `docs/adr/0001-portal-del-cliente.md`.
Seguridad y pendientes antes de datos reales: `docs/portal/SEGURIDAD.md`.

**Estado:** desarrollo. No desplegado. Solo datos ficticios.

## Qué hace hoy (probado de extremo a extremo)

- **Clientes (móvil primero):** crear cuenta, confirmar correo, recuperar contraseña, perfil particular
  o empresa; solicitud en 4 pasos con borrador; lista «Documentación que necesitamos» con explicación de
  cada documento; subida de archivo o foto con progreso, reintento y confirmación solo tras guardar;
  versiones; mensajes con el despacho; historial; Mi inicio (estado, qué falta, qué hacer ahora),
  Mis solicitudes, Mis expedientes, Documentación pendiente, Mis documentos, Mensajes, Mi perfil.
- **Despacho (doble factor obligatorio):** bandeja (nuevas, en revisión, documentos por validar,
  falta documentación, pendiente de subsanar, expedientes), detalle de la solicitud, validar o pedir
  subsanación de cada archivo, cambiar estado de cada documento, pedir documentos adicionales,
  revisión de conflictos, aceptar y abrir expediente o no aceptar, responsable, nota visible al cliente,
  notas internas, historial de auditoría, clientes registrados y plantillas documentales editables.
- **Avisos** neutros por correo, agrupados; recordatorios de documentación obligatoria pendiente.

Estados de cada documento: Pendiente de aportar · Documento recibido · En revisión · Documento validado ·
Necesita subsanación · No aplicable. «Citas» no está construido y no aparece en el menú.

## Pila local (sin Docker)

Requisitos: PostgreSQL 16 (`/usr/lib/postgresql/16/bin`), un clon de `supabase/storage` compilado
(`npm ci && npm run build`, Node 24) y Node 22 para la aplicación. Rutas configurables en `scripts/dev-stack.sh`.

```bash
cp .env.example .env.local      # rellena valores locales (nunca reales)
scripts/dev-stack.sh reset      # Postgres + Storage + SMTP local, migraciones y bucket privado
npm run db:seed                 # abogada ficticia (SEED_PERSONAL_PASSWORD en .env.local)
npm run build && npm start      # http://localhost:3100
```

Los correos locales se guardan en `.dev/correo/*.json`.

## Pruebas

```bash
npm run typecheck
npm test                                            # reglas y RLS de la base de datos (rol real portal_app)
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e   # escenario de aceptación completo, A/B
scripts/copia.sh /ruta && scripts/restauracion-prueba.sh /ruta <sello>   # copia y restauración verificadas
```

## Operación

- `npm run db:migrate` (con `DATABASE_URL_ADMIN`; `PORTAL_APP_PASSWORD`/`PORTAL_AUTH_PASSWORD` activan los roles).
- `PERSONAL_PASSWORD=… npm run personal:alta -- --email=… --nombre=… --rol=abogado` da de alta al personal.
- Cron: `npm run notificaciones:enviar` cada 5 minutos y `npm run recordatorios` una vez al día
  (o `NOTIFICADOR_INTERVALO_SEG` con una sola instancia).

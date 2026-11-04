# ADR 0001 · Portal del cliente como aplicación privada separada

- **Estado:** propuesto (pendiente de aprobación del propietario para staging y producción)
- **Fecha:** 27/10/2026
- **Issues:** #1, #12, #16, #56, #57, #49, #15, #55

## Contexto

La web pública es Next.js 16 con `output: 'export'`: HTML estático que Hostinger sirve desde `dist/`.
Un sitio estático no puede autenticar usuarios, guardar archivos privados ni aplicar permisos. El
propietario ha fijado como prioridad absoluta el portal del cliente (autoalta, solicitud, documentación,
revisión del despacho y conversión en expediente) y, el 24/10, Supabase como base de datos y
almacenamiento.

## Decisión

```
 praetoriaabogados.es (Hostinger, estático)          app.praetoriaabogados.es (propuesto)
 ┌──────────────────────────┐   enlace «Área de    ┌────────────────────────────────────┐
 │ Web pública, SEO, blog   │ ─ clientes» (cuando ─▶│ portal/ · Next.js con servidor Node │
 │ Sin datos privados       │   se apruebe)         │  · sesiones (better-auth)           │
 └──────────────────────────┘                       │  · acciones y rutas API del servidor │
                                                    └───────┬──────────────────┬──────────┘
                                         rol portal_app     │ (RLS)            │ clave de servicio
                                         rol portal_auth    ▼                  ▼ (solo servidor)
                                              ┌───────────────────┐  ┌──────────────────────┐
                                              │ Postgres Supabase │  │ Supabase Storage     │
                                              │ esquemas identidad│  │ bucket privado       │
                                              │ y portal + RLS    │  │ portal-documentos    │
                                              └───────────────────┘  └──────────────────────┘
```

1. **Aplicación separada** en `portal/` del mismo repositorio, con su propio `package.json`, excluida del
   build, del `tsconfig` y del ESLint de la web pública. La web pública y su despliegue en Hostinger no
   cambian.
2. **Base de datos:** Postgres de Supabase. Esquema `portal` (solicitudes, expedientes, requisitos,
   documentos versionados, mensajes, notas internas, eventos, avisos) y esquema `identidad` (cuentas).
   Migraciones SQL versionadas en `portal/db/migrations`, aplicadas con `npm run db:migrate`.
3. **Permisos en dos capas:** el servidor comprueba la sesión y el rol, y además **toda** consulta se
   ejecuta con el rol `portal_app` (sin `BYPASSRLS`) dentro de una transacción con `app.user_id` fijado;
   las políticas RLS y los disparadores imponen el aislamiento entre clientes, la inmutabilidad de
   documentos y eventos, y las transiciones de estado válidas.
4. **Autenticación: better-auth dentro de la aplicación** (no Supabase Auth). Motivo: Supabase Auth
   (GoTrue) no se puede ejecutar ni probar en el entorno de desarrollo disponible (sin Docker Hub, sin
   descarga de binarios ni del proxy de Go), y la instrucción es no presentar nada sin probar. better-auth
   guarda sus tablas en el mismo Postgres de Supabase (esquema `identidad`), con verificación de correo
   obligatoria, recuperación, límites de intentos persistentes en base de datos, protección contra
   enumeración de correos, doble factor TOTP obligatorio para el personal y telemetría desactivada.
   **Es una desviación de la decisión del 24/10 («Supabase para autenticación») que el propietario debe
   confirmar.** Si se prefiere Supabase Auth, el cambio afecta a `src/lib/auth.ts`, a las páginas de
   acceso y a cómo se obtiene `app.user_id`; el modelo de datos y la RLS no cambian.
5. **Archivos:** Supabase Storage, bucket **privado**. Clave de objeto `solicitud/documento` (UUID, sin
   nombres de clientes). El navegador nunca habla con Storage: sube y descarga a través de
   `/api/documentos`, que valida sesión, origen, tamaño y tipo real (firma binaria), y la RLS decide si el
   documento existe para ese usuario. Cada descarga queda auditada.
6. **Solicitud ≠ expediente:** registrarse o enviar una solicitud no crea relación profesional. Solo el
   despacho, tras registrar la revisión de conflictos de intereses, convierte la solicitud en expediente
   (`portal.convertir_en_expediente`), que conserva documentos, mensajes e historial.
7. **Correo:** SMTP configurable. Los avisos son neutros (sin datos del asunto ni adjuntos), se agrupan
   para no duplicarse y se envían por un proceso (`npm run notificaciones:enviar`, cron) o por el propio
   servidor (`NOTIFICADOR_INTERVALO_SEG`).

## Despliegue propuesto (no ejecutado: requiere aprobación)

- **Supabase:** un proyecto **nuevo** para staging y otro para producción. **No reutilizar** credenciales
  expuestas anteriormente; si el proyecto existente se reutiliza, rotar antes la contraseña de la base de
  datos y las claves `service_role`/secretas.
- **Aplicación:** cualquier servicio con Node 22 persistente (Netlify con Next en servidor, o un Node de
  Hostinger) en `app.praetoriaabogados.es` (staging: `app-pruebas.…`). Requiere un registro DNS que **no
  se ha tocado**.
- **SMTP:** proveedor con SPF/DKIM del dominio.
- Variables: ver `portal/.env.example`. Ninguna es `NEXT_PUBLIC_`.

## Alternativas descartadas

- *Supabase Auth + supabase-js en el navegador:* exige anon key y RLS sobre PostgREST expuesto; añade
  superficie y no se puede probar aquí.
- *API en Netlify Functions con la web estática:* duplicaría la sesión en dos dominios y complicaría
  CSRF/cookies; el portal necesita páginas privadas renderizadas en servidor de todos modos.
- *Guardar archivos en Postgres:* infla copias y base de datos.

## Consecuencias

- Pila local de desarrollo **real** sin Docker: PostgreSQL 16, Supabase Storage (`storage-api` compilado
  desde su código fuente) y un capturador SMTP (`portal/scripts/dev-stack.sh`).
- Pendiente antes de datos reales: ver `docs/portal/SEGURIDAD.md`.

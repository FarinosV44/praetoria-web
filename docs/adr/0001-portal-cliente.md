# ADR 0001 · Portal del cliente: arquitectura, datos y seguridad

- **Estado:** propuesta, con la base de datos de pruebas ya creada (3/11/2026).
- **Issues:** #12 (arquitectura y permisos), #56 (alta y solicitud), #16 (portal), #57 (documentación), #55 (bandeja mínima).
- **Decide:** el propietario. Este documento no despliega nada en producción ni cambia DNS.

## Contexto

La web pública (Next.js con `output: 'export'`) es estática y se publica en Hostinger. No puede tener rutas de API, sesiones
ni secretos. El propietario ha decidido (27/10/2026) que lo primero del software es el **portal del cliente**: registrarse,
abrir una solicitud y aportar documentos con seguridad. Un alta no es la aceptación de un encargo.

## Decisión

```
praetoriaabogados.es  (Hostinger, estático)          portal.praetoriaabogados.es  (aplicación aparte)
  páginas, blog, formularios PHP actuales  ── CTA ──▶  Next.js con servidor, sesión por cookie
                                                        │  clave pública de Supabase + sesión del usuario
                                                        ▼
                                             Supabase · proyecto «praetoria-abogados» · Frankfurt (eu-central-1)
                                               Auth (correo verificado) · Postgres con RLS · Storage privado
```

1. **La web pública no cambia.** Solo enlazará al portal con un botón discreto cuando el portal esté aprobado.
2. **El portal es una aplicación separada** en `portal.praetoriaabogados.es`, con servidor (Next.js SSR). Se propone Netlify,
   que ya hace las previsualizaciones; Vercel es la alternativa. Requiere una entrada DNS: **pendiente de aprobación**.
3. **Supabase** en la organización «Praetoria», proyecto `praetoria-abogados`, región **Frankfurt** (datos en la UE).
4. **Autorización en la base de datos**, no solo en la aplicación: RLS en todas las tablas, ningún permiso para visitantes
   sin sesión, y el estado de una solicitud solo lo cambian funciones del despacho que dejan rastro.
5. **Migraciones en el repositorio** (`supabase/migrations/`), revisadas por PR como el resto del código, y una prueba de
   aislamiento reproducible (`supabase/tests/aislamiento_portal.sql`).

## Modelo de datos (MVP, aplicado en el proyecto)

| Tabla | Para qué | Quién la ve |
| --- | --- | --- |
| `profiles` | Nombre, tipo (persona/empresa) y teléfono; se crea al registrarse | Cada uno la suya; el despacho, todas |
| `staff` | Personal del despacho y su rol (superadmin, abogado, apoyo) | Cada miembro su fila; se da de alta por migración o superadmin |
| `companies`, `company_members` | Empresa cliente y representantes; el vínculo vale solo si el despacho lo verifica | Creador y miembros verificados; el despacho |
| `intakes` | Solicitud con referencia `SOL-AAMMDD-XXXXXX`, área, descripción, contraparte, fechas, urgencia, estado | Su titular; el despacho |
| `intake_documents` | Metadatos de cada documento; el fichero está en Storage. Entra en «cuarentena» | Su titular; el despacho |
| `intake_messages` | Hilo de la solicitud; las notas internas nunca se muestran al cliente | Titular (sin internas); el despacho |
| `intake_events` | Historial de auditoría (creada, documento aportado, enviada, estado cambiado) | Titular (solo eventos visibles); el despacho |

**Estados:** `borrador` → `pendiente_de_revision` → `informacion_solicitada` ⇄ … → `aceptada` / `rechazada` → `convertida`.
El cliente solo edita y aporta documentos en `borrador` o `informacion_solicitada`. Rechazar o pedir información exige motivo.

**Storage:** bucket privado `intake-documents`, 20 MB por fichero, solo PDF, JPG, PNG, HEIC, WEBP y DOCX. Ruta
`<id_solicitud>/<uuid>-<nombre>`. Sin políticas de modificación ni borrado: lo aportado no se sobrescribe; una corrección es
un documento nuevo (#57). Las descargas serán con URL firmada de pocos minutos.

## Pruebas hechas (3/11/2026)

30 comprobaciones con dos clientes ficticios y una persona del despacho, todas correctas, en una transacción deshecha
(no queda ningún dato). Entre ellas: B no ve ni modifica nada de A (tablas, ficheros, mensajes, historial), nadie sin sesión
lee nada ni llama a funciones internas, el cliente no cambia el estado ni edita tras enviar, no ve notas internas y no se
autoverifica como representante. El asesor de seguridad de Supabase solo señala las tres acciones públicas a propósito
(`submit_intake`, `set_intake_status`, `verify_company_member`), que comprueban permisos dentro.

## Pendiente antes de datos reales (no se hace sin aprobación)

- **Plan de Supabase:** el plan gratuito pausa el proyecto si no se usa y no incluye copias diarias. Para datos de clientes
  hace falta el plan de pago, con copias y sin pausas. Coste a confirmar por el propietario.
- **Entornos:** este proyecto queda como **pruebas** (solo datos ficticios). Producción será un proyecto aparte o una rama.
- **Correo:** configurar SMTP propio del dominio para la verificación y la recuperación (el SMTP de Supabase está limitado).
- **Antiabuso:** captcha en el registro (Turnstile o hCaptcha) y límites de peticiones.
- **MFA** obligatorio para el personal.
- **Antivirus:** los documentos quedan en «cuarentena» hasta un análisis automático (función en servidor, servicio por elegir)
  o la revisión del despacho.
- **RGPD y secreto profesional:** contrato de encargado con Supabase, registro de actividades, plazos de conservación y
  texto de privacidad del portal.
- **DNS** del subdominio y **alta del primer superadministrador**.

## Siguientes pasos

1. Aprobación de este ADR (hosting del portal y plan).
2. Aplicación del portal: registro, verificación, «Mi solicitud» (borrador y envío), subida de documentos desde el móvil.
3. Bandeja mínima del despacho (#55): solicitudes pendientes, pedir información, aceptar o rechazar.
4. Checklist documental por tipo de asunto (#57), partiendo de `docs/checklists-documentales.json`.

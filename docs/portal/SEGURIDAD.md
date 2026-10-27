# Portal del cliente · seguridad, privacidad y lo que falta antes de datos reales

Estado a 27/10/2026. **No se han usado datos reales ni se ha desplegado nada.** Todo lo probado se ha
probado con identidades y documentos ficticios en la pila local.

## Controles implementados y probados

| Control | Dónde | Prueba |
| --- | --- | --- |
| Aislamiento entre clientes (lectura, escritura, mensajes, eventos, documentos) | RLS en `0003_reglas_y_rls.sql`, rol `portal_app` sin bypass | `tests/db/aislamiento.test.ts` (10) y E2E 6 |
| Identificadores manipulados en URL y API → 404 indistinguible | páginas + `/api/documentos` | E2E 6 |
| Storage privado: sin URL pública ni acceso sin clave de servicio | bucket `public=false`, `scripts/storage-setup.ts` | E2E 6 |
| Verificación de correo obligatoria; sin enumeración de correos al registrarse o recuperar | `src/lib/auth.ts` | E2E 1 y 6 |
| Doble factor TOTP obligatorio para el personal | `requerirPersonal()` | E2E 3 y 5 |
| Límites de intentos (acceso, registro, recuperación, TOTP) en base de datos; 60 subidas/hora por usuario | better-auth `rateLimit`, disparador de documentos | — (configuración) |
| Tipo real del archivo por firma binaria; PDF con JavaScript/acciones rechazado; 20 MB | `src/lib/archivos.ts` | E2E 2 |
| Versiones: nunca se borra ni modifica un documento aportado | disparadores | BD 5 |
| Eventos de auditoría inalterables (también para el administrador) | disparador | BD 8 |
| Notas internas invisibles para el cliente | RLS | E2E 4 |
| Avisos por correo sin datos del asunto ni adjuntos; agrupados | `avisos-core.ts`, índice único parcial | E2E 4, BD 9 |
| Comprobación de origen en subidas; cookies `SameSite`/`Secure` en https; CSP, `nosniff`, `frame-ancestors 'none'`, `noindex` | rutas y `next.config.ts` | — |
| Aceptar exige revisión de conflictos registrada | `convertir_en_expediente` | BD 7, E2E 5 |
| Copia y restauración verificada (datos + objetos) | `scripts/copia.sh`, `scripts/restauracion-prueba.sh` | ejecutada en local |

## Pendiente antes de cargar documentación real (bloqueante)

1. **Antivirus/cuarentena.** No hay motor antivirus en este entorno: los documentos quedan marcados
   «Sin análisis antivirus» y el panel lo muestra. Hay que integrar un escáner (ClamAV en el servidor o
   un servicio) antes de datos reales.
2. **Credenciales nuevas.** Proyecto Supabase nuevo o rotación completa de las credenciales expuestas.
3. **Revisión jurídica de privacidad:** capa informativa del registro (versión `2026-10-27`), política
   específica del portal, base jurídica, plazos de conservación, encargados del tratamiento (Supabase,
   alojamiento, SMTP), transferencias internacionales y región de Supabase (UE), y **análisis de
   necesidad de EIPD** (RGPD art. 35): se tratarán datos laborales, económicos y, a petición del abogado,
   posiblemente de salud.
4. **Copias en producción:** PITR/copias de Supabase **más** copia de objetos de Storage (Supabase no
   los incluye), cifradas y fuera del proveedor, con una restauración de prueba documentada.
5. **CSP sin `'unsafe-inline'` en scripts** (nonces) y cabecera HSTS en el dominio final.
6. **Permisos por responsable:** hoy todo el personal activo ve todas las solicitudes (despacho
   pequeño). Si se quiere limitar al abogado asignado, es un cambio de política RLS.
7. **Invitación de clientes existentes y contactos autorizados por interfaz:** el modelo y la RLS
   (`portal.accesos`, con revocación) están probados; falta la pantalla de invitación.

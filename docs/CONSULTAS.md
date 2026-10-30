# Recepción de consultas (#3)

## Recorrido de una consulta

Desde el 29/10/2026 todo funciona en Hostinger, sin Netlify: la web y la recepción de formularios salen del mismo
repositorio y de la misma publicación (`main`).

```
Formulario /contacto/ ──POST JSON──▶ /api/consulta (public/api/consulta.php; .htaccess quita la extensión)
   │  validación en el navegador          │ 1. validación en servidor (mismas reglas: src/lib/consulta.ts,
   │  (mismas reglas)                     │    listas en public/api/catalogo.php, generado desde ellas)
   │                                      │ 2. antispam: campo trampa + mínimo 3 s desde que se cargó
   │                                      │ 3. asigna responsable por área
   │                                      ▼
   │                          Correo a juanfarinos@icav.es (site.email) por la API de Resend (dominio autenticado),
   │                          o con mail() de Hostinger si no hay clave o Resend falla; remitente
   │                          web@praetoriaabogados.es y «Responder a» el correo de quien consulta.
   │                          Copia de seguridad en ~/consultas-web/AAAA-MM.jsonl (fuera de public_html).
   ◀── 200 {ok, id} solo si el correo se aceptó para su envío · 422 errores por campo · 502 fallo de entrega
```

El asunto del correo indica el área (y «Lucía López» en Laboral). Las solicitudes de llamada llegan con el asunto
«URGENTE · Solicitud de llamada». Para cambiar el destinatario, se cambia `email` en `src/lib/site.ts` y se regenera
el catálogo (`node scripts/formularios/catalogo.mjs`; `npm run check` falla si no está al día).

Sin JavaScript, el mismo formulario se envía de forma clásica a `/api/consulta`. Si todo va bien redirige a `/gracias/`; si hay errores, muestra una página con la lista para volver atrás sin perder lo escrito.

## Reglas

| Campo | Regla |
| --- | --- |
| Nombre | Obligatorio, de 2 a 100 caracteres |
| Área | Obligatoria y **sin opción preelegida**, para que nada se clasifique solo y mal. Incluye «No sé qué área corresponde» |
| Consulta | De 20 a 2000 caracteres |
| Forma de contacto | Obligatoria, sin opción preelegida: llamada, correo o WhatsApp |
| Teléfono | **Obligatorio si se elige llamada o WhatsApp**. Entre 9 y 15 cifras |
| Correo | **Obligatorio si se elige correo**. Formato válido, máximo 254 caracteres |
| Asunto (servicio) | Opcional, viene de un CTA (`?servicio=`). Debe pertenecer al área elegida |
| Transporte: papel, tipo de incidencia, importe orientativo y fecha | Opcionales, **solo en el área de transporte** (en otra se descartan). Valores de lista; la fecha debe ser real y no futura. Sirve para priorizar a mano: no se calculan plazos |
| Privacidad | Hay que aceptarla |
| Cuerpo de la petición | Máximo 12 KB. No se admiten adjuntos |

La validación en el navegador es accesible:
- Resumen de errores con enlaces a cada campo, que recibe el foco.
- Cada campo con error lleva `aria-invalid` y su mensaje enlazado con `aria-describedby`.
- Las etiquetas indican cuándo un campo pasa a ser obligatorio.

**No se muestra éxito antes de tiempo**. La confirmación aparece en la propia página solo cuando el servidor responde que ha aceptado el envío del aviso. Si falla la red o la entrega, se avisa, se conservan los datos y el botón pasa a «Reintentar el envío». Un doble clic no duplica el envío, y los reintentos de una misma consulta llevan el mismo identificador.

**`/gracias/`** solo se usa en el envío sin JavaScript, tiene `noindex` y no se considera conversión: la medición de #9 se basará en la respuesta del servidor, no en visitar esa página.

## Contactos

Todos se configuran en `src/lib/site.ts`:

- **General**: 607 527 719 (`tel:+34607527719`, WhatsApp `34607527719`) y `juanfarinos@icav.es`. Coincide con el teléfono publicado en decaprofesional.es/contacto, según la consulta del 23/10 que recoge la issue. Ningún enlace de la web usa otro número.
- **Área laboral**: 649 181 290 (`tel:+34649181290`, WhatsApp `34649181290`). **Llamadas y WhatsApp** (autorizado en #28; antes, solo llamadas). Sin correo propio. Atiende Lucía López, que figura como responsable interna de las consultas laborales.
- **Mensajes predefinidos de WhatsApp**: centralizados en `mensajes`. Todos mencionan a Praetoria y el servicio jurídico, y ninguno el soporte de DeCA.

Corrección: el artículo sobre DeCA Conecta remitía a `info@praetoriaabogados.es` para consultas jurídicas. Se ha sustituido por `juanfarinos@icav.es`, el correo confirmado. **Si `info@` es un buzón real y atendido, puede volver a ponerse.**

## Pruebas

- `scripts/formularios/php.test.mjs` (13 pruebas, incluido el envío por Resend contra una API simulada, ejecutan los `.php` reales con PHP de línea de órdenes; el correo se
  sustituye por un registro local con `PRAETORIA_ENTREGA_URL`):
  - entrega correcta con área y responsable, y Laboral asignada a Lucía López;
  - llamada o WhatsApp sin teléfono, correo ausente o inválido, área sin elegir, privacidad, mensaje corto y campos largos;
  - cuerpo excesivo (413), campo trampa y envío rápido, que no se entregan;
  - fallo de la entrega, que responde 502;
  - formulario clásico sin JavaScript, con redirección a `/gracias/` y página de errores;
  - servicio, datos de transporte, fecha y atribución;
  - solicitud de llamada, y que `comun.php` y `catalogo.php` no hacen nada por sí solos.
- `tests/e2e/contacto.spec.ts` (8 pruebas en navegador): usan **la recepción real** (`out/api/*.php`), servida por
  `scripts/qa/serve.mjs` con PHP, contra un registro local que sustituye al correo y puede simular fallos.

## Envío por Resend (30/10/2026)

Con `mail()` de Hostinger los avisos no llegaban a `juanfarinos@icav.es` (Hostinger aceptaba el envío, pero el correo
no se entregaba: el dominio no autoriza a ese servidor). Por eso el envío va por **Resend** cuando hay clave:

1. Cuenta en resend.com (plan gratuito: 3.000 correos al mes, 100 al día).
2. *Domains → Add domain*: `praetoriaabogados.es`. Añadir en la zona DNS de Hostinger los registros que indique
   Resend (DKIM y los de envío en el subdominio `send`). No se tocan los registros MX ni el correo existente.
3. *API Keys → Create*: permiso solo de envío (*Sending access*), limitado a ese dominio.
4. En el Administrador de archivos de Hostinger, **junto a `public_html`** (no dentro), crear `praetoria-config.php`:
   ```php
   <?php return ['resend_api_key' => 're_...'];
   ```
   No va al repositorio (es público; está en `.gitignore`). Las publicaciones desde GitHub no lo borran.
5. Enviar una consulta de prueba. Los envíos se ven en Resend → *Emails*.

Si la clave falta o Resend falla, se intenta con `mail()`; si los dos fallan, la web responde 502 y ofrece reintentar.
Cada consulta queda además en `~/consultas-web/AAAA-MM.jsonl`.

## Pendiente

- [ ] Prueba de teléfonos en un móvil real: `tel:+34607527719` y `tel:+34649181290`.

## Solicitud de llamada (#33)

`/que-me-llame-un-abogado/` envía a `POST /api/llamada` (`public/api/llamada.php`, reglas en `src/lib/llamada.ts`).
Campos: nombre y teléfono (obligatorios), área, motivo (lista cerrada), fecha de la citación o del plazo (puede ser
futura, hasta dos años), localidad, forma segura de contacto (sin mensajes; con discreción si otra persona ve el
teléfono), horario y una descripción breve opcional. Se envía por correo con el asunto «URGENTE · Solicitud de llamada»
(y «Lucía López» si es laboral) y el campo `prioridad: URGENTE`. Igual que en las consultas: campo trampa y tiempo mínimo,
un solo envío a la vez con el mismo id en los reintentos, y confirmación en pantalla solo cuando el servidor ha
aceptado el envío. Aviso fijo: «Solicitud de contacto prioritario, sujeta a disponibilidad. El envío no confirma
asistencia ni suspende plazos». Nunca se promete atención inmediata ni un plazo de respuesta; para un peligro, 112.
Pruebas: `scripts/formularios/php.test.mjs` y `tests/e2e/penal.spec.ts`.

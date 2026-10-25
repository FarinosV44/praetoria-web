# Medición de embudos (#9)

Se usa la integración existente: el aviso de cookies y `NEXT_PUBLIC_GA_ID`, con Google Analytics 4. No se añade otra plataforma.

## Principios

- **Sin consentimiento no se mide nada.**
  - No se carga Analytics y `medir()` no hace nada.
  - No se guarda la atribución, y si se rechaza después, se borra.
  - Las consultas funcionan igual con o sin Analytics: lo comprueba una prueba.
- **Sin datos personales en la analítica.**
  - Los parámetros pasan por una lista cerrada de claves (`area`, `servicio`, `tipo_pagina`, `ubicacion`, `destino`, `landing`, `origen`).
  - Los valores deben ser cortos y seguros: minúsculas, sin espacios, `@`, `?` ni `=`.
  - Nombre, correo, teléfono, mensaje y respuestas de los cuestionarios no tienen ninguna vía de llegar a Analytics. Lo comprueban una prueba unitaria y una e2e.
- **Un clic no es una consulta, y una consulta no es un cliente.**
  - WhatsApp y teléfono son microconversiones separadas.
  - La conversión es `form_success`.
  - La cualificación y la contratación salen del CRM (#13).

## Diccionario de eventos

| Evento | Cuándo | Parámetros |
| --- | --- | --- |
| `service_view` | Al ver una página de área o de servicio (también en navegación interna) | `tipo_pagina` (`area` o `servicio`), `area`, `servicio`, `landing` |
| `cta_click` | Clic en cualquier enlace al formulario (`/contacto/…`) | `destino=formulario`, `servicio` y `area` (del enlace), `landing` (página actual), `ubicacion` |
| `whatsapp_click` | Clic en un enlace de WhatsApp (siempre al número general) | `destino=general`, `landing`, `ubicacion` |
| `phone_click` | Clic en un enlace `tel:` | `destino` (`general` o `laboral` para Lucía López), `landing`, `ubicacion` |
| `form_start` | Primera interacción con el formulario de consulta, **una vez** por carga | `area`, `servicio` (si ya están elegidos) |
| `form_success` | **Solo** cuando la función confirma que Netlify Forms aceptó la consulta. **Una vez** por consulta (id) | `area`, `servicio` |

Valores de `ubicacion`: `cabecera`, `barra_movil`, `cabecera_pagina`, `recorrido`, `lista_servicios`, `lateral_articulo`, `banda_final`, `cuestionario`, `pie` y `contenido`. Permiten comparar qué CTA funciona.

**Qué no cuenta como conversión.**
- Visitar `/gracias/`: solo la ve quien envía sin JavaScript, tiene `noindex` y no dispara eventos.
- Un envío que falla: si Netlify Forms responde con error, no hay `form_success`. En el reintento correcto se cuenta una sola vez.
- Un doble clic: el formulario bloquea el segundo envío y los reintentos llevan el mismo `id`.
- El envío sin JavaScript no genera eventos, pero la consulta sí llega a Netlify Forms y aparece en el informe.

## Atribución en la consulta

Campos que se guardan con la consulta en Netlify Forms. Se sanean y, si no son válidos, se descartan sin bloquear el envío.

| Campo | Qué es | Con consentimiento | Sin consentimiento |
| --- | --- | --- | --- |
| `servicio` | El asunto elegido o que llega desde un CTA (`?servicio=`) | sí | sí (funcional) |
| `origen` | La página de la web desde la que se llegó al formulario. Se guarda en memoria, sin almacenamiento | sí | sí (funcional) |
| `landing` | La primera página de la visita | sí | **no** |
| `utm_source`, `utm_medium`, `utm_campaign` | La campaña de la primera página: minúsculas, `[a-z0-9_-.]`, hasta 60 caracteres | sí | **no** |

Las URL no llevan relatos: solo ids de servicio o área. Las respuestas de los cuestionarios viajan por `sessionStorage`. Las políticas de privacidad y de cookies se han actualizado para explicarlo.

## KPIs

| KPI | Definición | Fuente | Estado |
| --- | --- | --- | --- |
| Consultas confirmadas | Consultas aceptadas por Netlify Forms, sin duplicados por `id` | Exportación de Netlify Forms → `npm run medicion:informe` | Listo |
| Tasa de conversión por servicio | `form_success` / `service_view` del servicio | GA4 (solo con consentimiento: es una muestra, no un total) | Listo al publicar |
| CTA que funcionan | `cta_click` por `ubicacion` y `servicio`, y su relación con `form_success` | GA4 | Listo al publicar |
| Microconversiones | `whatsapp_click` y `phone_click` por `destino` y `landing` | GA4 | Listo al publicar. **No son consultas** |
| Consultas cualificadas | Consultas que el despacho marca como pertinentes | CRM (#13) | Pendiente |
| Presupuestos | Consultas con presupuesto enviado | CRM (#13) | Pendiente |
| Contrataciones | Presupuestos aceptados | CRM (#13) | Pendiente |

Para unir las consultas con el CRM se usa el `id` de cada consulta, que se guarda en Netlify Forms. Nunca se usan los datos personales en la analítica.

## Informe de ejemplo (datos ficticios)

`npm run medicion:informe -- <export.csv> --md` agrega la exportación CSV de Netlify Forms. Solo lee las columnas sin datos personales y descarta los reenvíos con el mismo `id`. Con `tests/fixtures/consultas-ejemplo.csv` (personas, correos y teléfonos ficticios) produce lo siguiente; una prueba comprueba que esos datos no aparecen en el resultado:

### Consultas confirmadas

Total: **3** (1 reenvíos duplicados descartados)

#### Por mes

| mes | Consultas |
| --- | ---: |
| 2026-11 | 2 |
| 2026-12 | 1 |

#### Por area

| area | Consultas |
| --- | ---: |
| Laboral | 2 |
| Transporte y logística | 1 |

#### Por servicio

| servicio | Consultas |
| --- | ---: |
| Despidos e impugnación | 1 |
| Reclamación de portes impagados | 1 |
| Salarios y finiquitos | 1 |

#### Por responsable

| responsable | Consultas |
| --- | ---: |
| Lucía López (649 181 290) | 2 |
| Juan José Farinós Ibáñez (607 527 719) | 1 |

#### Por preferencia

| preferencia | Consultas |
| --- | ---: |
| Correo | 1 |
| Llamada | 1 |
| WhatsApp | 1 |

#### Por origen

| origen | Consultas |
| --- | ---: |
| /abogado-laboralista-valencia/ | 1 |
| /impugnar-despido/ | 1 |
| /reclamacion-portes-impagados/ | 1 |

#### Por landing

| landing | Consultas |
| --- | ---: |
| (sin dato) | 1 |
| /abogado-laboralista-valencia/ | 1 |
| /despido-valencia-que-hacer/ | 1 |

#### Por utm_source

| utm_source | Consultas |
| --- | ---: |
| (sin dato) | 1 |
| google | 1 |
| newsletter | 1 |

#### Por utm_medium

| utm_medium | Consultas |
| --- | ---: |
| (sin dato) | 1 |
| cpc | 1 |
| email | 1 |

#### Por utm_campaign

| utm_campaign | Consultas |
| --- | ---: |
| (sin dato) | 2 |
| laboral-otono | 1 |


## Límites de Netlify Forms (comprobar en el panel)

- **Número de envíos al mes según el plan.** Netlify cambió sus planes en 2025, así que hay que comprobar el límite en *Billing* antes de publicar. Si se supera, los envíos pueden no aceptarse: la función respondería con error y la web ofrecería reintentar o llamar, sin dar la consulta por recibida.
- **Spam.** Los envíos que el filtro de Netlify marca como spam no aparecen en la lista principal ni en la exportación. Hay que revisar la pestaña de spam de vez en cuando.
- **Duplicados.** Netlify no los elimina. El informe los descarta por `id`.
- **Avisos por correo.** Se configuran en el panel: pendiente de acceso (ver `docs/CONSULTAS.md`).

## Pruebas

- **Unitarias** (`src/lib/medicion.test.mts`, `scripts/medicion/informe.test.mjs`):
  - la lista de claves y valores de la analítica deja fuera los datos personales;
  - las rutas y UTM se sanean;
  - la consulta descarta la atribución no válida sin bloquear el envío;
  - el informe agrega sin datos personales y descarta duplicados.
- **e2e** (`tests/e2e/consentimiento-medicion.spec.ts`, build con `NEXT_PUBLIC_GA_ID`; Google no se contacta):
  - **Aceptado:**
    - `phone_click` de Lucía, `whatsapp_click`, `cta_click` con servicio y `form_start` una vez;
    - un primer envío fallido sin conversión y el reintento con **una** `form_success`;
    - ningún dato personal en los eventos;
    - la consulta llega con origen, landing y UTM saneados;
    - `service_view` en la navegación interna.
  - **Rechazado:** no se carga Analytics, no se registra ningún evento, y la consulta llega con origen pero sin landing ni UTM.
  - **`/gracias/` visitada directamente:** sin conversión.
- Se ejecutan con `npm run test:e2e:ga`.

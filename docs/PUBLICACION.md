# Publicación de la web pública (Fase 1)

Estado a 24/10/2026, sobre la rama `publicacion/fase-1` (por encima de la PR #29). WordPress sigue en producción,
el DNS no se ha tocado y no se ha fusionado nada en `main`. Este documento prepara la decisión de publicación; no la toma.


## 0. Estado en Netlify (24/10/2026, 17:00)

- Proyecto `eclectic-sopapillas-6aabb3`, equipo «praetoria web» (`farinosv44`), **plan Free**: 300 créditos al mes, sin
  recarga ni pagos. Consumo hasta ahora: unos 30 créditos (dos despliegues de producción del proyecto).
- **La rama de producción del proyecto es `publicacion/fase-1`** (no `main`): https://eclectic-sopapillas-6aabb3.netlify.app.
  Cada `push` a esta rama es un despliegue de producción de Netlify y gasta 15 créditos; los cambios solo de
  documentación se suben con `[skip netlify]`. El día de la publicación se cambia la rama de producción a `main`.
- **Visibilidad privada** (decisión del propietario): solo la ve el equipo de Netlify con la sesión iniciada.
- Formularios detectados: `contacto` y `contacto-laboral`. Avisos por correo a `juanfarinos@icav.es`, con asunto
  «[Praetoria web] Consulta - ATENCION GENERAL» y «[Praetoria web] Consulta - AREA LABORAL».

Comprobado en el despliegue real:

| Comprobación | Resultado |
| --- | --- |
| 223 URLs antiguas (estado final, destino y si redirige) | 223/223. Había 5 fallos (etiquetas en árabe) que solo aparecían en Netlify; corregidos publicando también la ruta codificada |
| `X-Robots-Tag: noindex, nofollow`, `<meta name="robots" noindex>`, `robots.txt` sin `Sitemap:` | OK |
| 404 real y caché de `/media/` | OK |
| Despliegue de la función `consulta` | OK (había un fallo: Netlify desplegaba también el archivo de pruebas como función) |
| Envío de una consulta | **No probado con éxito**: la función recibe y valida, pero Netlify Forms responde 401 al entregarla porque el proyecto es privado. La página muestra el error, conserva los datos y ofrece reintentar, como está previsto. Se probará el día de la publicación (sitio público) o antes, si el propietario hace pública la previsualización |

No se ha podido comprobar el código del primer salto (301) desde el navegador; sí el destino final. `npm run seo:check`
lo comprueba con el motor oficial de Netlify en local.

## 1. Alojamiento y despliegue: Netlify (revisado sobre el código actual)

Lo que el repositorio necesita realmente, y por qué encaja con Netlify:

| Pieza | Dónde | Depende de |
| --- | --- | --- |
| Web estática (Next.js `output: 'export'`, 72 páginas) | `out/` | Cualquier alojamiento estático |
| Recepción de consultas: `POST /api/consulta` | `netlify/functions/consulta.mts` (Netlify Functions v2) | **Netlify** |
| Registro y aviso por correo de cada consulta | Netlify Forms, formularios `contacto` y `contacto-laboral` (`public/__forms.html`) | **Netlify** |
| 219 redirecciones de la migración SEO, validadas con el motor oficial de Netlify | `out/_redirects` | Sintaxis Netlify |
| Cabeceras (seguridad, caché) e indexación por contexto (`SITE_INDEXABLE`) | `netlify.toml` | **Netlify** |

Conclusión: **Netlify, conectado al repositorio de GitHub**. Netlify compila con su propio sistema (no usa GitHub
Actions), así que el bloqueo de facturación de Actions no impide ni los despliegues ni las previsualizaciones.
Cambiar a Vercel o Cloudflare obligaría a reescribir la recepción de consultas, el registro de formularios y las
redirecciones; no aporta nada para la primera versión.

**Plan de Netlify (decisión tuya, implica gasto o no).** Las cuentas nuevas usan planes por créditos. El gratuito da
300 créditos al mes como límite duro; cada despliegue de producción consume 15, el tráfico 20 por GB y 2 por cada
10 000 peticiones. Los envíos de formularios y las previsualizaciones no consumen créditos. **Si se agotan, Netlify
pausa la web** («Site not available») hasta el mes siguiente. Para la web de un despacho conviene un plan de pago con
recarga, o vigilar el consumo en el gratuito y limitar los despliegues de producción. Si la cuenta del despacho es
antigua y conserva un plan anterior, sus límites son otros: comprobarlo al conectarla.
Fuentes: [cómo funcionan los créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/),
[cambios de precios de abril de 2026](https://www.netlify.com/changelog/2026-04-14-pricing-updates-april-2026/).

Revisión de la configuración antigua: el `netlify.toml` y la función son los de las PR actuales, no los de `main`
(Astro). En esta revisión se ha corregido un fallo real: la función entregaba la consulta a `process.env.URL`, que es
la dirección principal del sitio; en una previsualización, o con el dominio ya añadido en Netlify antes del cambio de
DNS, esa dirección apunta a otro despliegue o a WordPress y la consulta se perdía con error 502. Ahora entrega al mismo
despliegue que atiende la petición (prueba en `consulta.test.mts`).

## 2. Lista corta

### A. Bloqueos reales para publicar

1. **Probar la recepción en Netlify.** Netlify ya está conectado; falta un envío con éxito, que requiere el sitio
   público (la previsualización es privada por decisión del propietario: Netlify Forms rechaza la entrega con 401).
   En una previsualización: enviar una consulta general y una laboral con datos ficticios y comprobar que aparecen en
   *Forms → contacto* y *Forms → contacto-laboral* y que llega el aviso por correo. Si Netlify no aceptara la entrega
   desde la función, la alternativa preparada es enviar el correo con un proveedor (requiere su clave) o guardar en
   Netlify Blobs (ver `docs/CONSULTAS.md`).
2. **Revisión completa en la previsualización** (móvil y escritorio) y aprobación del contenido por tu parte.
3. ~~Prueba de las 223 URLs antiguas en Netlify~~: hecha, 223/223 (apartado 0).
4. **Política de privacidad (tu revisión jurídica)**. Está actualizada al funcionamiento real (Netlify, formularios
   por área, analítica con consentimiento), pero falta decidir dos puntos que no debo redactar por ti:
   - transferencias internacionales: Netlify, Inc. y Google son de EE. UU. (marco de privacidad de datos UE-EE. UU. o
     cláusulas contractuales tipo);
   - base jurídica: hoy cita consentimiento e interés legítimo; para responder a una consulta previa a un encargo suele
     encajar mejor la aplicación de medidas precontractuales a petición del interesado (art. 6.1.b RGPD).
5. **Unir las PR en `main`** con tu autorización (ver apartado 4): Netlify publica la rama de producción.

### B. Mejoras que pueden hacerse después de publicar

- Correo de acuse al usuario. Hoy la confirmación es en pantalla (y la página `/gracias/` sin JavaScript) solo cuando
  la consulta se ha recibido de verdad. Netlify Forms no envía acuses al remitente; requiere un proveedor de correo.
- Auditoría editorial de los 40 artículos (#10): restos de relleno de palabras clave en algunos textos antiguos
  (p. ej. «despido Valencia»), emojis en títulos internos, dos guías DeCA y dos de regularización muy parecidas.
- 10 artículos con imagen pendiente (composición tipográfica, `docs/BLOG-MATRIZ.md`).
- Backlog SEO con datos de Search Console/DinoRANK (#11) y medición (#9, ya implementada a falta de datos reales).
- Rendimiento: puntuaciones de 81–93 en móvil con simulación; el margen restante es JavaScript de Next (TBT), no
  imágenes. No afecta al uso; se puede reducir después.

### C. Acciones de publicación que requieren tu intervención

| # | Acción | Dónde | Tiempo |
| --- | --- | --- | --- |
| C1 | Conectar `FarinosV44/praetoria-web` a Netlify (cuenta del despacho), elegir plan (apartado 1) y activar *Branch deploys* para `publicacion/fase-1` | Netlify | 10 min |
| C2 | Activar la detección de formularios (*Forms → Enable form detection*; en sitios nuevos viene desactivada) y volver a desplegar | Netlify | 2 min |
| C3 | Avisos por correo: `contacto` → `juanfarinos@icav.es`; `contacto-laboral` → correo de Lucía López (**falta la dirección**) y, si quieres, copia a `juanfarinos@icav.es` | Netlify → Forms → Notifications | 5 min |
| C4 | Revisar la previsualización y aprobar contenido, privacidad (A4) y publicación | Navegador | — |
| C5 | Copia de WordPress (archivos y base de datos) y de la zona DNS; bajar TTL a 300 s 24 h antes | Hostinger | 30 min |
| C6 | Autorizar la unión de las PR en `main` | GitHub | — |
| C7 | Día del cambio: dominio en Netlify, `SITE_INDEXABLE=true` en producción, A/CNAME en Hostinger (sin tocar MX ni TXT) | Netlify, Hostinger | `docs/seo/LANZAMIENTO.md` |
| C8 | Search Console: enviar el sitemap y vigilar 404 y redirecciones (días 1, 7, 14 y 30) | Search Console | — |
| C9 | (Opcional) Resolver la facturación de GitHub Actions si quieres que las comprobaciones corran también en GitHub | GitHub | — |

## 3. Comprobaciones: locales frente a GitHub

**GitHub Actions:** los dos trabajos (`build-y-comprobaciones` y `navegador`) **no llegan a ejecutarse**. GitHub
indica: «The job was not started because recent account payments have failed or your spending limit needs to be
increased». No son fallos del código ni comprobaciones aprobadas: no hay resultado. No se han relanzado ni se ha
tocado la facturación ni las protecciones.

**Locales** (misma batería que ejecutaría Actions, en este repositorio, 24/10/2026):

| Comprobación | Resultado |
| --- | --- |
| `tsc --noEmit`, `npm run lint`, `npm run build` | OK |
| `npm run check`: enlaces, anclas, recursos, metadatos, JSON-LD, idioma, sitemap, peso; migración SEO (223 URLs, motor de Netlify); matriz de servicios; registro de imágenes; 49 pruebas unitarias | OK |
| `npm run test:e2e:ga`: formularios de extremo a extremo con la función real, embudos, laboral, transporte, móvil, consentimiento y medición, imágenes | OK (todas) |
| Build de producción con `SITE_INDEXABLE=true`: `robots.txt` con `Sitemap:`, 70 URLs en el sitemap, canonical a `https://praetoriaabogados.es/…`, `noindex` solo en `/gracias/`, 404 y `__forms.html` | OK |
| Accesibilidad automática (axe) en las 72 páginas, móvil y escritorio: errores graves o críticos | 0 |
| Desbordamiento horizontal en móvil (412 px) en las 72 páginas | 0 (corregido el artículo en árabe) |
| Teléfonos, WhatsApp y correo en toda la web | Solo 607 527 719 (general), 649 181 290 (laboral) y juanfarinos@icav.es |
| Lighthouse móvil (simulación) | Accesibilidad 100; rendimiento 81–93; CLS ≤ 0,05 |

**Sin comprobar todavía** (necesita Netlify): entrega real a Netlify Forms, avisos por correo, cabeceras reales,
redirecciones servidas y certificado.

## 4. Decisión final de publicación (preparada)

Validación que falta: A1–A4 de la lista anterior. Con ellas, la publicación es reversible en minutos (DNS con TTL corto
y WordPress intacto 30 días).

Cómo llevar el código a `main` (necesita tu autorización):

1. **Recomendada:** fusionar en orden la pila de PR (#19 → #20 → … → #29 → fase 1), reorientando cada una a `main`
   al fusionar la anterior. Conserva el historial de revisión de cada issue.
2. Alternativa: una sola PR de `publicacion/fase-1` a `main` con todo; más rápida, menos trazable.

Si las protecciones de `main` exigen las comprobaciones de GitHub y estas no pueden ejecutarse por la facturación,
hay tres salidas, todas tuyas: resolver la facturación (C9), fusionar como administrador dejando constancia de las
comprobaciones locales y de Netlify, o aceptar la previsualización de Netlify como comprobación de publicación.
Ninguna se ha ejecutado.

## 5. Fase 2 (planificada, no requisito para publicar)

Panel interno y portal de clientes con Supabase (autenticación, base de datos y almacenamiento privado) y
autorización comprobada en servidor y con políticas de acceso. Se reutilizan los issues existentes:
#12 arquitectura, roles y permisos · #13 captación · #15 clientes, expedientes, tareas y plazos · #16 portal,
solicitudes y subida segura de documentación · #17 automatizaciones · #14 edición de contenidos. La web pública no
incluye subida de documentos: el formulario lo indica y la política de privacidad también.

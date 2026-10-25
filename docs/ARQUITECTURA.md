# Arquitectura de la web

## El problema de la web anterior

- Dos menús que se solapaban sin criterio: «Servicios» (civil, mercantil, familia) y «Ámbitos de especialización» (transporte, arte, Hacienda), y en la portada los seis mezclados en un mismo bloque.
- Tres nombres de marca a la vez: Praetoria Abogados, Praetoria División Jurídica y PRAETORIA Jurídica.
- El blog de la portada mostraba solo artículos de DECA Profesional, así que el despacho parecía la web de un software.
- 39 de 40 artículos estaban en la categoría genérica «Derecho»; las demás categorías estaban duplicadas («transporte y logistica», «TRANSPORTE Y LOGISTICA», «logistica y transporte»…).
- Páginas duplicadas (`/sobre-praetoria/` era una copia antigua de la portada; `/despacho-juridico-valencia/` era la portada con otra dirección), un bloque de testimonios vacío y una tira de frases repetida en todas las páginas.

## La nueva organización

Un único criterio: **a quién se dirige cada área**.

```
Inicio
├── Empresas y autónomos
│   ├── Transporte y logística ........ /logistica-y-transporte-internacional/
│   │   └── El DECA digital (guías legales + herramientas)
│   ├── Mercantil y sociedades ........ /derecho-mercantil/
│   └── Hacienda y Seguridad Social ... /abogado-hacienda-y-seguridad-social-en-valencia/
├── Particulares y familias
│   ├── Civil, herencias y vivienda ... /derecho-civil/
│   ├── Familia y divorcio ............ /familia/
│   │   └── Divorcio en l'Horta Nord .. /abogado-divorcio-horta-nord-valencia/
│   └── Arte y patrimonio ............. /arte-y-patrimonio/
├── Blog ............................... /blog/  (+ /blog/categoria/<tema>/)
├── El despacho ........................ /el-despacho/  (+ /abogado-el-puig/)
└── Contacto ........................... /contacto/
```

- **Marca única:** Praetoria División Jurídica (la sociedad titular sigue siendo PRAETORIA SL).
- **Áreas y blog conectados:** cada artículo pertenece a una categoría temática; cada categoría enlaza con su área y cada área muestra sus artículos. El lector que llega a un artículo desde Google encuentra el área donde se le puede ayudar.
- **DECA en su sitio:** los 16 artículos de DECA viven en la categoría «Transporte y DECA» y en una sección propia dentro del área de transporte, separados en *guías legales* (11) y *herramientas* (5, sobre DeCA Profesional). En la portada el DECA ocupa un solo bloque.
- **Portada:** el índice de las seis áreas es lo primero que se ve; después, el abogado, las tres entradas urgentes (carta de Hacienda, divorcio de mutuo acuerdo, porte impagado), el bloque DECA, el despacho y los últimos artículos de temas distintos.

### Categorías del blog

| Categoría | Artículos | Área enlazada |
| --- | --- | --- |
| Transporte y DECA | 20 | Transporte y logística |
| Civil, herencias y vivienda | 6 | Civil |
| Extranjería | 4 | (solo blog) |
| Hacienda y Seguridad Social | 3 | Hacienda y Seguridad Social |
| Cómo elegir abogado | 3 | (solo blog) |
| Laboral | 2 | (solo blog) |
| Mercantil y sociedades | 1 | Mercantil |
| Familia | 1 | Familia |

## Direcciones (URLs)

**Se conservan las direcciones de todas las páginas de contenido**: las seis áreas, las tres landings (Hacienda, divorcio, El Puig), los 40 artículos y las páginas legales mantienen exactamente la misma URL, y conservan el título y la descripción que tenían en WordPress. Esto reduce el riesgo de perder posicionamiento, pero no lo garantiza: Google reevalúa una web cuando cambian su plantilla y su enlazado interno. El inventario completo, URL por URL, y su validación están en [`docs/seo/`](seo/README.md); el seguimiento posterior, en [`docs/seo/LANZAMIENTO.md`](seo/LANZAMIENTO.md).

Solo cambian estas, con redirección 301 en `public/_redirects`:

| Antes | Ahora |
| --- | --- |
| `/ambitos-de-especializacion/` | `/areas/` |
| `/sobre-mi/` | `/el-despacho/` |
| `/sobre-praetoria/` | `/el-despacho/` |
| `/despacho-juridico-valencia/` | `/` |
| `/category/...` | Su categoría nueva en `/blog/categoria/...` (la antigua «Derecho» → `/blog/`) |
| `/tag/...` | El artículo de la etiqueta, o la categoría que agrupa la mayoría de sus artículos |
| `/feed/`, `/<artículo>/feed/` | `/rss.xml`, el propio artículo |
| Imágenes migradas en `/wp-content/uploads/` | Su versión nueva en `/media/` |

Lo que no tiene equivalente (autores, rutas internas de WordPress, imágenes de banco no migradas, etiquetas sin artículos) responde 404 en lugar de redirigirse a la portada.

## SEO técnico incluido

- Títulos y descripciones recuperados de WordPress (ThinkRank SEO) en las URLs que se conservan; ver [`docs/seo/README.md`](seo/README.md).
- Datos estructurados: `LegalService` (despacho), `Person` (abogado), `BlogPosting`, `BreadcrumbList` y `FAQPage` en las páginas con preguntas frecuentes.
- `sitemap.xml` (la misma dirección que tenía el de WordPress), `robots.txt`, RSS, URLs canónicas, Open Graph.
- Imágenes convertidas a WebP (de 26 MB a 3 MB) con tamaños fijados para evitar saltos de maquetación.
- Sin cookies salvo que se active Google Analytics, y en ese caso con consentimiento previo.

## Cambios de contenido que conviene revisar

1. **Dos artículos casi iguales sobre el DECA obligatorio** (`deca-obligatorio-en-2026-guia-legal-para-transportistas-y-cargadores` y `deca-obligatorio-en-2026-guia-para-transportistas-y-empresas-de-transporte`) compiten por la misma búsqueda. Recomendable fusionarlos en uno y redirigir el otro.
2. **Página de Hacienda:** la web anterior listaba títulos de artículos que no existían («Recurrir una sanción de Hacienda», «Providencia de apremio de la TGSS»…). Se han convertido en texto descriptivo; son buenos temas para escribir.
3. **Laboral y extranjería** tienen artículos pero no página de área. Si son servicios que quieres ofrecer, se pueden crear; si no, quedan como contenido divulgativo del blog.
4. **Testimonios:** el bloque estaba vacío y se ha sustituido por enlaces a las reseñas de Google.
5. **Fotografías no migradas:** las fotos de la oficina en obras, las imágenes de banco de imágenes y el logotipo blanco de «Consulting & Education» (pertenece a otra marca). Siguen en el export original si las necesitas.
6. **Política de privacidad:** se ha cambiado Hostinger por Netlify como proveedor de alojamiento y formularios, y se explica que los cuestionarios no envían datos.
7. **Nombre del área civil:** pasa a ser «Civil, herencias y vivienda» porque es lo que realmente tratan sus artículos (alquileres, desahucios, herencias).

# Migración SEO: inventario y validación

Este directorio documenta qué pasa con cada URL de la web de WordPress al cambiar a la web nueva, y cómo se comprueba.

| Archivo | Qué es |
| --- | --- |
| `inventario-urls.csv` | Matriz URL antigua → URL nueva, una fila por URL. **Generado**: no se edita a mano. |
| `fuentes/wordpress-rastreo-2026-10-23.json` | Rastreo de la web de WordPress en producción: las 56 URLs de su sitemap y 12 rutas de control, con estado HTTP, título, meta descripción, canonical, robots e idioma reales. |
| `fuentes/wordpress-export-2026-10-23.json` | Resumen del export de la API de WordPress: páginas, artículos, categorías, etiquetas e imágenes, con sus IDs. |
| `fuentes/etiquetas-sin-redireccion.json` | Etiquetas que se dejan en 404 y por qué. |
| `LANZAMIENTO.md` | Lista de comprobación de publicación, vuelta atrás y seguimiento. |

## Comandos

```bash
npm run build            # genera dist/ (no indexable salvo SITE_INDEXABLE=true)
npm run seo:check        # valida redirecciones, sitemap, canonical e indexabilidad; falla si hay errores
npm run seo:inventario   # lo mismo y además reescribe inventario-urls.csv
npm run seo:redirects    # regenera public/_redirects desde las fuentes
npm test                 # pruebas del intérprete de reglas de Netlify
```

## Qué contiene la matriz (estado al 23/10/2026)

233 filas: 16 páginas y 40 artículos del sitemap de WordPress, 10 categorías, 77 etiquetas, 70 archivos subidos, 2 variantes sin barra final, el feed, 6 rutas de control y 10 páginas nuevas sin equivalente anterior.

| Resultado | Filas | Criterio |
| --- | --- | --- |
| Misma URL, 200 | 56 | Las 14 páginas que conservan dirección y los 40 artículos. |
| 301 a equivalente | 108 | Páginas fusionadas (`/sobre-mi/` → `/el-despacho/`…), categorías → su categoría nueva, etiquetas → su artículo o categoría, feeds, imágenes migradas. |
| 404 previsto | 59 | Imágenes de banco no migradas, etiquetas sin artículos, rutas internas de WordPress y URLs que ya eran 404. |

**Por qué estos 404 y no redirecciones genéricas:** enviar a la portada o al blog algo que no tiene equivalente es lo que Google trata como *soft 404*. Las etiquetas se redirigen a su único artículo o a la categoría que agrupa al menos el 60 % de sus artículos; si están repartidas, al blog.

**DinoRANK habla de 75 URLs y la web nueva genera 66 páginas.** No son conjuntos comparables: las 66 incluyen páginas nuevas (áreas, categorías del blog, gracias, 404) y las 75 de DinoRANK probablemente incluyen archivos de categoría y etiqueta, que en WordPress eran indexables. Sin el CSV de DinoRANK no se puede saber cuáles son; la matriz ya contiene todas las categorías y etiquetas para cruzarlas en cuanto llegue.

## Títulos y descripciones recuperados

Las descripciones de la primera versión de la web nueva se habían redactado a partir del primer párrafo, porque el export de la API no traía los datos de ThinkRank SEO. Ahora se recuperan del rastreo de producción:

- **Artículos:** 37 de 40 recuperan su título SEO (campo `seoTitle`) y su descripción. Los 3 restantes usaban la descripción genérica del sitio en WordPress; conservan la redactada en la migración.
- **Áreas y landings:** recuperan título y descripción, cambiando «Praetoria Abogados / PRAETORIA» por la marca única y completando tres descripciones que WordPress guardaba cortadas a media palabra.
- **Legales y blog:** usaban la descripción genérica; conservan la nueva.

Las columnas `title_wp`/`title_nuevo` y `description_wp`/`description_nueva` del CSV permiten revisar cada caso. Mejorar esos textos es trabajo de la auditoría editorial (#10), no de la migración.

## Qué está comprobado y qué no

**Comprobado en local** (y en la CI en cada PR):

- Ningún destino de redirección inexistente, ninguna cadena, ningún bucle.
- Ninguna regla tapada por una página que exista en la misma ruta.
- Las 56 URLs del sitemap de WordPress responden 200 o 301 a un equivalente en un solo salto.
- El sitemap nuevo solo contiene URLs que responden 200 directamente, y no incluye `/gracias/` ni `/404/`.
- Cada página tiene canonical a su propia URL en `https://praetoriaabogados.es`.
- Un build normal es no indexable (meta noindex, cabecera `X-Robots-Tag` y robots.txt sin sitemap), y uno con `SITE_INDEXABLE=true` es indexable.

**Comprobado con el motor de redirecciones oficial de Netlify** (`@netlify/redirect-matcher`, el que usa `netlify dev`, compilado a WebAssembly). La validación resuelve cada una de las 223 URLs antiguas con la simulación propia y con este motor, y falla si no coinciden. Gracias a eso se detectó y corrigió que las reglas de las etiquetas en árabe, escritas codificadas (`%d8…`), no habrían funcionado nunca: Netlify compara la ruta ya decodificada. También se confirmó que:

- el comodín `*` incluye la ruta exacta (`/category/x/*` cubre `/category/x/`);
- la barra final es opcional en el origen de la regla;
- se distinguen mayúsculas (`/SOBRE-MI/` no se redirige; WordPress solo generaba minúsculas).

**Pendiente de un deploy preview en Netlify** (requiere conectar el repositorio; ver `LANZAMIENTO.md`):

- Cabeceras reales (`X-Robots-Tag`, caché), código 404 real de la página de error y redirección de `www` y `http` al dominio principal.
- Peticiones HTTP reales a todas las filas del CSV contra el preview. Hay un script preparado: `node scripts/seo/probar-preview.mjs https://<preview>.netlify.app`.

**Pendiente de datos externos:**

- Tráfico por URL (Search Console / DinoRANK). La columna `trafico` lo indica en cada fila.
- Enlaces externos entrantes a URLs que no estén en el sitemap.

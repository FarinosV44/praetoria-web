# Praetoria División Jurídica · praetoriaabogados.es

Web del despacho de Juan José Farinós Ibáñez (ICAV 13.981), migrada desde WordPress/Elementor a una web estática hecha con [Astro](https://astro.build). Todo el contenido vive en este repositorio: textos, artículos, imágenes y configuración.

La decisión de cómo se ha reorganizado la web, y el mapa de direcciones antiguas y nuevas, están en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Qué hay en cada carpeta

| Ruta | Qué contiene |
| --- | --- |
| `src/data/site.ts` | Teléfono, correo, dirección, áreas de práctica, categorías del blog y menú. **Cambia aquí un dato y se actualiza en toda la web.** |
| `src/data/areas-content.ts` | Textos de las cinco páginas de área (transporte, mercantil, civil, familia, arte). |
| `src/content/blog/` | Los artículos del blog, uno por archivo Markdown (`.md`). |
| `src/content/legal/` | Aviso legal, privacidad y cookies. |
| `src/pages/` | Páginas con diseño propio: inicio, Hacienda, divorcio, El Puig, el despacho, contacto, blog. |
| `src/components/` | Piezas reutilizables: cabecera, pie, listados, bloque DECA, preguntas frecuentes… |
| `src/styles/global.css` | Colores, tipografías y estilos generales. |
| `public/media/` | Fotografías (WebP) y logotipo. |
| `public/_redirects` | Redirecciones 301 desde las direcciones antiguas de WordPress. |

## Tareas habituales

### Publicar un artículo nuevo

1. Crea un archivo en `src/content/blog/`, por ejemplo `src/content/blog/mi-nuevo-articulo.md`. El nombre del archivo será la dirección: `praetoriaabogados.es/mi-nuevo-articulo/`.
2. Empieza el archivo con esta cabecera y escribe debajo el texto en Markdown:

```markdown
---
title: "Título del artículo"
description: "Resumen de 140-160 caracteres para Google."
date: 2026-11-02
category: transporte        # transporte | mercantil | hacienda | civil-vivienda | familia | laboral | extranjeria | elegir-abogado
deca: guia                  # opcional, solo artículos del DECA: guia | herramienta
tags: ["reclamaciones transporte"]
---

Primer párrafo...

## Un subtítulo
```

3. Guarda y sube el cambio a GitHub (desde la propia web de GitHub vale: botón *Add file → Create new file*). La web se publica sola en un par de minutos.

El artículo aparecerá automáticamente en el blog, en su categoría, en la página del área correspondiente y en el RSS. Para dejarlo en borrador añade `draft: true`.

### Cambiar un texto de un área

Edita `src/data/areas-content.ts`. Cada área tiene su `h1`, `lede` (entradilla), `intro`, `services` y `closing`.

### Añadir una foto

Súbela a `public/media/` en formato `.webp` o `.jpg` (máximo 1600 px de ancho) y enlázala como `/media/nombre-de-la-foto.webp`.

## Trabajar en local

Requiere Node.js 22.

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # genera la web en dist/
npm run check        # tras build: enlaces internos, migración SEO y pruebas
```

## Publicación

**La web no está publicada.** WordPress sigue en producción. El procedimiento completo, con la copia de seguridad, el cambio de DNS sin tocar el correo, la vuelta atrás y el seguimiento a 7, 14 y 30 días, está en [`docs/seo/LANZAMIENTO.md`](docs/seo/LANZAMIENTO.md).

Ningún build es indexable salvo que se active expresamente con la variable `SITE_INDEXABLE=true`, y eso solo se hace en producción el día del cambio. Los deploy previews y la dirección provisional `*.netlify.app` llevan `noindex` y así no compiten con WordPress en Google.

Para el formulario de contacto: en Netlify, *Site configuration → Forms → Form notifications*, añade un aviso por correo a `juanfarinos@icav.es` para el formulario **contacto**.

Google Analytics es opcional: *Environment variables* → `PUBLIC_GA_ID = G-XXXXXXX`. Con la variable puesta aparece el aviso de cookies, y Analytics solo se carga si el visitante acepta.

## Migración SEO

El inventario de las URLs de WordPress, con su destino, las redirecciones y su validación, está en [`docs/seo/`](docs/seo/README.md). Las redirecciones se generan con `npm run seo:redirects`; no se edita `public/_redirects` a mano.

## Formularios

- **Contacto** (`/contacto/`): lo gestiona Netlify Forms (incluye filtro antispam). Los envíos se ven en el panel de Netlify y llegan por correo si configuras el aviso del paso 3.
- **Hacienda** y **divorcio**: los cuestionarios funcionan dentro del navegador del visitante y preparan un resumen que él mismo envía por WhatsApp o correo. No guardan datos en ningún servidor.

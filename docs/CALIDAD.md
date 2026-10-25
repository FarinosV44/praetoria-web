# Comprobaciones de calidad (#4)

Todo lo de esta página se ejecuta en la CI en cada PR (`.github/workflows/ci.yml`) y se puede lanzar en local.

| Comando | Qué comprueba | Dónde está |
| --- | --- | --- |
| `npm run typecheck` | TypeScript estricto (`strict`, `noUncheckedIndexedAccess`) | `tsconfig.json` |
| `npm run lint` | ESLint con las reglas de Next (Core Web Vitals, TypeScript, hooks de React) | `eslint.config.mjs` |
| `npm run build` | Next falla si un Markdown no cumple el esquema o si un área y un artículo comparten slug | `src/lib/content.ts`, `src/app/[slug]/page.tsx` |
| `npm run qa:site` | Calidad del HTML generado (ver abajo) | `scripts/qa/check-site.mjs` |
| `npm run seo:check` | Migración SEO: 223 URLs de WordPress contra el motor de Netlify, redirecciones, sitemap, canonical e indexabilidad | `scripts/seo/` ([detalle](seo/README.md)) |
| `npm test` | Pruebas unitarias, con casos negativos, del comprobador del sitio y del intérprete de redirecciones | `scripts/**/*.test.mjs` |
| `npm run test:e2e:ga` | Pruebas en navegador (Chromium, escritorio y móvil) sobre una build normal y otra con Analytics | `tests/e2e/`, `playwright.config.ts` |

## `qa:site`: calidad del HTML generado

1. **Enlaces y recursos internos**: cada `href`, `src`, `srcset`, hoja de estilo, icono y `og:image` apunta a un archivo que existe.
2. **Anclas**: `#id` y `/ruta/#id` existen en la página de destino.
3. **Estructura**: un único `<title>`, una meta description de al menos 50 caracteres, la canonical a la propia URL, un único `<h1>`, `alt` en todas las imágenes y ningún id repetido.
4. **JSON-LD**: es válido y tiene los campos que exige cada tipo (`LegalService`, `BlogPosting`, `BreadcrumbList`, `FAQPage`, `Person`).
5. **Idioma**: `<html lang>` coincide con el idioma del contenido y `og:locale` es coherente.
6. **Sitemap**: contiene exactamente las páginas indexables (todas salvo `/gracias/` y la 404) y sin duplicados.
7. **Borradores**: un artículo con `draft: true` no aparece en la salida, ni en el sitemap ni en el RSS.
8. **Colisiones**: ningún artículo usa el slug de una ruta propia (`src/app/<carpeta>/`). Next serviría la ruta propia y el artículo quedaría oculto sin avisar.
9. **Peso por página (gzip)**: HTML ≤ 40 KB, CSS ≤ 20 KB y JavaScript ≤ 160 KB (sin contar el `nomodule`). Hoy la página más pesada lleva 141 KB de JavaScript. El presupuesto es el control automático del coste de Next que documenta [MIGRACION-NEXT.md](MIGRACION-NEXT.md).

Cada comprobación tiene su prueba negativa en `scripts/qa/check-site.test.mjs`: una mini-web con exactamente ese defecto que debe hacer fallar el comprobador, y una mini-web sana que debe pasar (18 pruebas).

## Pruebas en navegador (`tests/e2e/`)

- **Divorcio**: el caso sencillo lleva al precio cerrado, el foco pasa al resultado y el mensaje de WhatsApp incluye las respuestas. El caso con hijos lleva a la valoración personalizada. Volver atrás conserva la selección y volver a pulsarla avanza. «Empezar de nuevo» funciona.
- **Hacienda**: avisa de los campos que faltan, prepara el resumen, mueve el foco y «Corregir» conserva los datos.
- **Contacto**: el formulario lleva el marcado de Netlify Forms. La recepción real se prueba en #3.
- **Teclado**: el primer Tab llega a «Saltar al contenido»; el submenú se abre con Enter y se cierra con Escape.
- **404**: una ruta inexistente responde con código 404 y la página de error. El servidor de pruebas imita a Netlify: `scripts/qa/serve.mjs`.
- **Móvil**: el menú abre, despliega y se cierra al navegar. La barra fija de Llamar/WhatsApp no tapa ningún elemento enfocado, y su enlace llama al teléfono general.
- **Cookies**, con la build con `NEXT_PUBLIC_GA_ID`: Analytics no se carga antes de decidir ni al rechazar, sí al aceptar; la elección se recuerda y se puede reabrir.
- **Sin errores de JavaScript** en las páginas principales, incluido el artículo en árabe.

Se ha comprobado que estas pruebas detectan regresiones de verdad: con los dos fallos corregidos en #18 reintroducidos a propósito (el cuestionario bloqueado al volver atrás y la barra fija tapando el foco), fallan exactamente las dos pruebas correspondientes.

En local, si el Chromium de Playwright no está instalado, se puede usar otro: `CHROMIUM_PATH=/ruta/al/chrome npm run test:e2e`.

## Otras decisiones de #4

- **Idioma del documento**: los dos artículos en francés y árabe declaran `<html lang="fr">` y `<html lang="ar">`, y `og:locale` `fr_FR` y `ar_AR`. La cabecera, el pie y la barra móvil, que siguen en español, llevan `lang="es"`. La dirección de derecha a izquierda se aplica solo al artículo en árabe, para no invertir la navegación. Lo hace `scripts/postbuild.mjs`, porque el layout raíz de Next es común a todas las páginas.
- **hreflang**: no se añade. Esos artículos no son traducciones de una página en español, y hreflang solo debe unir versiones equivalentes.
- **Caché de `/media/`**: antes era `immutable` durante un año, con nombres de archivo sin huella, así que una foto sustituida con el mismo nombre no se habría actualizado. Ahora es `max-age=86400, must-revalidate`: el navegador revalida al día. `/_next/static/` sí lleva huella en el nombre y mantiene el año `immutable`.
- **Imagen de la CI**: fijada en `ubuntu-24.04`, porque `ubuntu-latest` pasará a Ubuntu 26.

## Pendiente

- La CI de GitHub Actions no arranca por la facturación de la cuenta (#19). Todo lo anterior se ha ejecutado en local con el mismo resultado.
- Cabeceras reales (`Cache-Control`, `X-Robots-Tag`): solo se pueden verificar en un deploy preview de Netlify, con `scripts/seo/probar-preview.mjs`.

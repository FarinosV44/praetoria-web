# Migración de Astro a Next.js (#18)

Decisión del propietario del 23/10/2026: la web pasa a Next.js, TypeScript y Tailwind CSS. Este documento recoge cómo se ha hecho, qué se ha comprobado y cómo volver atrás.

## Decisiones técnicas

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Versiones | Next.js 16.4.3 (App Router), React 19, TypeScript 6 estricto, Tailwind CSS 4.3, fijadas en `package-lock.json` | Versiones estables vigentes al migrar. Se consultó la [guía oficial de exportación estática](https://nextjs.org/docs/app/guides/static-exports), actualizada el 9/8/2026. |
| Modo de render | **Exportación estática** (`output: 'export'`, `trailingSlash: true`) | Cada página es un HTML completo e indexable en `out/<ruta>/index.html`, igual que con Astro. No hace falta servidor y se conservan exactamente las mismas URLs. |
| Componentes | De servidor por defecto. Solo son de cliente el menú, el aviso de cookies y los cuestionarios de Hacienda y divorcio | Es lo único con interacción. |
| Contenido | Los mismos Markdown de `src/content/`, leídos en el build con `gray-matter` y validados con `zod`, con el mismo esquema que tenía Astro. Se renderizan con `unified` (remark-gfm, rehype-slug) | Ni un solo artículo ha cambiado. Si una cabecera es incorrecta, el build falla. |
| Rutas | `src/app/[slug]/` sirve áreas y artículos con `generateStaticParams` y `dynamicParams = false` | Cualquier otra ruta es un 404 real, sin páginas vacías con código 200. El build falla si un área y un artículo tienen el mismo slug. |
| Sitemap y RSS | `src/app/sitemap.ts` y `src/app/rss.xml/route.ts` con `force-static` | El sitemap pasa a `/sitemap.xml`, que es la misma dirección que tenía el de WordPress. Excluye `/gracias/` y la 404. |
| Redirecciones y cabeceras | Siguen en `public/_redirects` y `netlify.toml` | `redirects()` y `headers()` de `next.config` **no funcionan** en exportación estática. Las reglas ya están validadas con el motor oficial de Netlify (#2). |
| Hosting | Netlify sirve `out/` como sitio estático. `NETLIFY_NEXT_PLUGIN_SKIP=true` evita que el adaptador de Next de Netlify intente tratarlo como app con servidor | Sin cambio de proveedor ni de configuración de dominio. |
| Páginas sobrantes | `scripts/postbuild.mjs` elimina `out/404/` y `out/_not-found/` | Next las genera como páginas normales y Netlify las serviría con código 200 (*soft 404*). Netlify usa `out/404.html` para las rutas inexistentes. |
| Estilos | Tokens de marca en `@theme` de Tailwind (`text-ink`, `bg-stone`, `border-line`, `font-serif`…). Los estilos de cada componente se han portado desde Astro a la capa `components`, con la clase raíz de cada componente como ámbito (`scripts/migracion/portar-estilos-astro.py`) | Paridad visual exacta como punto de partida. El rediseño de #5 se hace sobre esta base. |
| Fuentes | De momento siguen cargándose de Google Fonts, como en Astro | `next/font/google` las descargaría durante el build. En #5 se alojan en la propia web. |
| Formularios | El formulario de contacto conserva el marcado de Netlify Forms en el HTML generado | Netlify detecta los formularios en el HTML publicado, así que con exportación estática debería seguir funcionando. **No se da por comprobado**: la recepción real y la validación en servidor son la issue #3. |
| Variable de Analytics | `PUBLIC_GA_ID` pasa a llamarse `NEXT_PUBLIC_GA_ID` | Next solo expone al navegador las variables con prefijo `NEXT_PUBLIC_`. |
| Panel futuro | La web pública no usa nada que exija servidor | El panel interno (#12) podrá ser una aplicación separada o pasar a otro modo de render sin afectar a las URLs públicas. Se decidirá en #12. |

## Qué se ha comprobado

**Paridad de contenido** (`node scripts/migracion/paridad.mjs <salida_astro> out`): las **65 páginas** coinciden en todos los campos, sin ninguna diferencia. Se comparan el título, la descripción, la canonical, robots, el idioma, `og:title`, `og:description`, `og:image`, el H1, el texto visible completo de `<main>`, los enlaces internos, las imágenes, los tipos de JSON-LD y los formularios. Se ha comprobado que el comparador detecta cambios provocados a propósito en el texto y en los enlaces.

**Paridad visual**: capturas de inicio, área de transporte, artículo y contacto, en escritorio (1366 px) y móvil (390 px). Diferencia de píxeles entre 0,00 % y 0,63 %; lo que queda son diferencias de suavizado del texto en los formularios. Para llegar ahí se corrigieron dos diferencias:

- La base de Tailwind quitaba el subrayado a los enlaces.
- Una regla de la página de área se aplicaba también a la lista de artículos anidada. Astro aislaba esos estilos por componente.

**Comportamiento** (pruebas de humo en navegador). Funcionan:

- El cuestionario de divorcio: 5 preguntas, el foco pasa al resultado, el mensaje de WhatsApp lleva las respuestas, «Empezar de nuevo» funciona y volver atrás conserva la selección.
- El resumen de Hacienda: avisa de los campos que faltan, el foco pasa al resumen y «Corregir» conserva los datos.
- El menú móvil: abre, actualiza `aria-expanded`, despliega los submenús y se cierra al navegar.
- El teclado: el primer Tab va a «Saltar al contenido», Enter abre el submenú y Escape lo cierra.
- El aviso de cookies con Analytics configurado, en los dos sentidos: Analytics no se carga antes de decidir ni si se rechaza, la elección se recuerda y «Configurar cookies» reabre el aviso.
- No hay errores de JavaScript.

**Errores que ya existían en Astro y se han corregido**:

- En el cuestionario de divorcio, al volver a una pregunta y pulsar la opción que ya estaba marcada, no se avanzaba. Ahora se usa `click` en lugar de `change`.
- En móvil, al recibir el foco, un elemento podía quedar tapado por la barra fija de Llamar/WhatsApp. Se añade `scroll-padding-bottom` y la prueba recorre todos los elementos enfocables de una página.

**Comprobaciones de siempre** sobre `out/`: enlaces internos, las 223 URLs de la migración SEO contrastadas con el motor de Netlify, sitemap, canonical e indexabilidad en los dos modos. También pasan el typecheck y el lint sin avisos.

## Rendimiento: el coste de Next

Lighthouse en móvil, con limitación real de red y CPU (`--throttling-method=devtools`), en la portada:

| | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- |
| Astro | 1,5 s | 1,5 s | 0 ms | 0 |
| Next.js | 2,2–2,3 s | 2,2–2,3 s | 0 ms | 0 |

Astro enviaba la página sin JavaScript externo. Next App Router necesita el runtime de React para hidratar, unos 138 KB comprimidos en navegadores modernos (más 38 KB que solo descargan navegadores antiguos). El LCP sigue dentro del umbral «bueno» de Google (menos de 2,5 s), pero con poco margen. Hay que vigilarlo: la issue #4 añade un control de rendimiento a la CI, y #5 aloja las fuentes en la propia web.

Las mediciones son en local. Las fuentes de Google estaban bloqueadas en el entorno de pruebas, igual para las dos versiones, y no hay cifras de campo: CrUX y Search Console solo existirán con la web publicada.

## Vuelta atrás

- La rama `astro-final` conserva el último estado en Astro, con todo #2 incluido. Para volver basta con desplegar esa rama (o fusionarla de nuevo en main). `netlify.toml` de esa versión publica `dist/`.
- Ninguna URL ha cambiado y las redirecciones son las mismas, así que volver a Astro no afecta al SEO.
- Nada se ha publicado: WordPress sigue en producción.

# Publicación en Hostinger desde GitHub (`main`)

Desde el 25/10/2026, praetoriaabogados.es lo sirve Hostinger, que compila la rama `main` de este repositorio
en cada `push`. Desde el 29/10/2026 no se usa Netlify: Hostinger también recibe los formularios (PHP) y la
comprobación de cada PR la hace la CI de GitHub (`.github/workflows/ci.yml`).

| Pieza | Dónde |
| --- | --- |
| Web estática (`out/`) | Hostinger (LiteSpeed/Apache). Configuración: comando `npm run build`, carpeta `out` (también se copia a `dist/`), Node 22 |
| Redirecciones de la migración, www → dominio, 404 y cabeceras | `out/.htaccess`, generado por `scripts/hostinger/htaccess.mjs` desde `out/_redirects` |
| Consultas y solicitudes de llamada | `public/api/consulta.php` y `llamada.php` en el propio dominio (`/api/consulta`, `/api/llamada`), que validan y envían el aviso por correo a info@praetoriaabogados.es. Detalle en [`CONSULTAS.md`](CONSULTAS.md) |
| Comprobación de las PR | CI de GitHub (build, pruebas unitarias y PHP, pruebas en navegador) |

`npm run build` (`scripts/build.mjs`) detecta el build de Hostinger: si `SITE_INDEXABLE` no viene fijada,
el build es indexable y se genera el `.htaccess` (que también enruta `/api/consulta` y `/api/llamada` a sus `.php`). Para un build local de pruebas:
`SITE_INDEXABLE=false npm run build`.

Build en Hostinger: webpack (`next build --webpack`) y un solo proceso de generación (`NEXT_BUILD_CPUS=1`); con Turbopack el build fallaba allí al arrancar su proceso de PostCSS.

Comprobado en el dominio real (25/10/2026, 19:55): portada y páginas nuevas, redirecciones de muestra de cada tipo (páginas, etiquetas, categorías paginadas, feeds, árabe, imágenes de WordPress), 404 reales, `robots.txt` con sitemap, Penal con `noindex`, y una consulta y una solicitud de llamada de prueba recibidas en Netlify Forms.

Comprobado en local con Apache 2.4 y el `.htaccess` generado: 223/223 URLs antiguas con su estado y destino previstos.

Ya no hay despliegue en Netlify. Si el proyecto de Netlify sigue conectado a GitHub, conviene desconectarlo o
borrarlo para que no consuma créditos.

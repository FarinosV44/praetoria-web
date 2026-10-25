# Publicación en Hostinger desde GitHub (`main`)

Desde el 25/10/2026, praetoriaabogados.es lo sirve Hostinger, que compila la rama `main` de este repositorio
en cada `push`. Netlify sigue activo para dos cosas: las previsualizaciones de las PR y la recepción de consultas.

| Pieza | Dónde |
| --- | --- |
| Web estática (`out/`) | Hostinger (LiteSpeed/Apache). Configuración: comando `npm run build`, carpeta `out` (también se copia a `dist/`), Node 22 |
| Redirecciones de la migración, www → dominio, 404 y cabeceras | `out/.htaccess`, generado por `scripts/hostinger/htaccess.mjs` desde `out/_redirects` |
| Consultas y solicitudes de llamada | Funciones de Netlify (`https://eclectic-sopapillas-6aabb3.netlify.app/api/consulta` y `/api/llamada`), que admiten peticiones desde praetoriaabogados.es (CORS, `src/lib/cors.ts`) y entregan en Netlify Forms con aviso por correo |
| Previsualizaciones de PR | Netlify (privadas) |

`npm run build` (`scripts/build.mjs`) detecta el build de Hostinger: si `SITE_INDEXABLE` no viene fijada y no es Netlify,
el build es indexable, los formularios apuntan a Netlify y se genera el `.htaccess`. Para un build local de pruebas:
`SITE_INDEXABLE=false npm run build`.

Comprobado en local con Apache 2.4 y el `.htaccess` generado: 223/223 URLs antiguas con su estado y destino previstos.

Cada `push` a `main` también despliega producción en Netlify (15 créditos del plan gratuito, 300 al mes): es lo que
publica las funciones de los formularios.

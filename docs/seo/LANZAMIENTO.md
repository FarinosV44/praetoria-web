# Lanzamiento, vuelta atrás y seguimiento

Nada de esta lista se ha ejecutado todavía. **WordPress sigue en producción** y el DNS no se ha tocado. Cada paso indica quién puede hacerlo y qué acceso hace falta.

Principio: la publicación tiene que poder deshacerse en minutos. Por eso WordPress no se apaga ni se borra hasta pasados 30 días sin incidencias, y la web nueva no es indexable hasta el momento exacto del cambio.

## 0. Antes de empezar (accesos necesarios)

| Acceso | Para qué | Estado |
| --- | --- | --- |
| Netlify (cuenta del despacho) | Conectar el repositorio, deploy previews, formularios, variables | Pendiente |
| Panel DNS de Hostinger | Bajar TTL, copiar la zona, cambiar A/CNAME | Pendiente |
| Hostinger / WordPress (admin) | Copia de seguridad completa | Pendiente |
| Google Search Console (propiedad del dominio) | Sitemap, cobertura, rendimiento | Pendiente |
| Export de DinoRANK o Search Console por URL | Priorizar y vigilar las URLs con tráfico | Pendiente |

## 1. Preparación (sin efecto en la web pública)

- [ ] Conectar `FarinosV44/praetoria-web` en Netlify. `netlify.toml` ya contiene build, cabeceras y `SITE_INDEXABLE=false` en todos los contextos.
- [ ] Abrir un deploy preview y ejecutar `node scripts/seo/probar-preview.mjs https://<preview>.netlify.app`. Debe terminar con 0 fallos. Comprueba las 223 URLs antiguas, la cabecera `X-Robots-Tag: noindex`, el 404 real y la caché de `/media/`.
- [ ] Revisar a mano en el preview: portada, un área, un artículo, Hacienda, divorcio y contacto, en móvil y escritorio.
- [ ] Probar el formulario de contacto y la solicitud de llamada en el preview con datos ficticios y confirmar que llegan los avisos (issues #3 y #33). Requiere el sitio público: con la visibilidad privada, Netlify Forms rechaza la entrega (401).
- [ ] `npm run check:produccion`: sin textos pendientes de revisión jurídica, o decisión expresa de publicar con Penal en `noindex`.
- [ ] **Copia de seguridad de WordPress**: archivos y base de datos desde Hostinger (o un plugin como UpdraftPlus), descargada fuera del servidor. Anotar la fecha.
- [ ] **Copia de la zona DNS actual**: captura o export de todos los registros (A, AAAA, CNAME, MX, TXT, SPF, DKIM, DMARC, CAA). Guardarla con este documento.
- [ ] Identificar qué registros sirven al correo (`juanfarinos@icav.es` es del colegio, pero puede haber otros buzones o verificaciones de Google, Microsoft o Mailchimp en TXT). **Ninguno de ellos se toca.**
- [ ] Bajar el TTL de los registros A y CNAME de `praetoriaabogados.es` y `www` a 300 segundos, al menos 24 horas antes del cambio.

## 2. Día del cambio

Elegir un día laborable por la mañana, con alguien disponible durante unas horas.

0. [ ] En Netlify, *Build & deploy → Branches*: cambiar la rama de producción de `publicacion/fase-1` a `main` (después de fusionar).
1. [ ] En Netlify, *Domain management*: añadir `praetoriaabogados.es` como dominio principal y `www.praetoriaabogados.es` como alias, que redirigirá al principal.
2. [ ] En Netlify, *Environment variables*, contexto **Production**: `SITE_INDEXABLE = true`. Lanzar un nuevo deploy de producción. Comprobar en el resultado que `robots.txt` incluye la línea `Sitemap:` y que las páginas ya no llevan `noindex`.
3. [ ] En Hostinger, cambiar **solo** el registro A del dominio raíz y el CNAME de `www` a los valores que indique Netlify. No modificar MX, TXT ni otros registros.
4. [ ] Esperar a que Netlify emita el certificado TLS (Let's Encrypt). Comprobar `https://praetoriaabogados.es` y `https://www.praetoriaabogados.es` sin avisos.
5. [ ] Comprobar las variantes: `http://` → `https://`, `www` → sin `www`, y ambas en un solo salto.
6. [ ] Ejecutar `node scripts/seo/probar-preview.mjs https://praetoriaabogados.es`. El único cambio esperado respecto al preview es la cabecera `X-Robots-Tag`, que ya no debe aparecer.
7. [ ] Enviar una consulta real de prueba desde el formulario y confirmar la recepción.
8. [ ] En Search Console: enviar `https://praetoriaabogados.es/sitemap.xml` (misma dirección que el sitemap de WordPress, así Search Console lo relee sin cambios) y solicitar la indexación de la portada y de 3 o 4 páginas clave.

## 3. Vuelta atrás

**Cuándo:** la web no carga, el certificado falla, el formulario no entrega consultas o aparecen errores masivos que no se pueden corregir en el día.

1. Restaurar en Hostinger el registro A y el CNAME de la copia del paso 1. Con TTL de 300 s, el cambio se nota en minutos.
2. WordPress vuelve a servir la web tal como estaba: no se ha modificado.
3. En Netlify, volver a poner `SITE_INDEXABLE = false` y redesplegar, para que la dirección provisional no compita en Google.
4. Anotar qué falló y en qué paso.

Para un error puntual, una página o una redirección, no hace falta volver atrás. Se corrige en el repositorio, se fusiona y Netlify despliega en un par de minutos. Netlify conserva todos los despliegues anteriores, y desde *Deploys* se puede publicar uno previo con un clic.

## 4. Seguimiento

No se puede garantizar que el posicionamiento no varíe. Conservar las URLs, los títulos y las descripciones, y redirigir lo demás a equivalentes, reduce el riesgo, pero Google reevalúa una web cuando cambian su plantilla y su estructura interna. Es normal ver fluctuaciones durante unas semanas.

| Cuándo | Qué revisar | Dónde |
| --- | --- | --- |
| Día 1 | Consultas recibidas por el formulario, errores 404 en el panel de Netlify, certificado | Netlify, correo |
| Día 7 | *Páginas* → «No se ha encontrado (404)» y «Página con redirección»: que coincidan con los 404 y 301 previstos en `inventario-urls.csv` | Search Console |
| Día 7 | Clics e impresiones de las 10 URLs con más tráfico antes del cambio | Search Console, *Rendimiento*, comparar periodos |
| Día 14 | Sitemap procesado y URLs indexadas; consultas recibidas frente a las semanas previas | Search Console, Netlify Forms |
| Día 30 | Tendencia de clics y posiciones frente a los 30 días previos; decidir si se mantiene WordPress como respaldo o se da de baja | Search Console, DinoRANK |

Hasta el día 30: no borrar WordPress, no cancelar el hosting y no eliminar la copia de seguridad.

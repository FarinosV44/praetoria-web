# Despliegue en Hostinger: una sola aplicación

Decisión del propietario, 04/11/2026: la web pública y el portal son **una sola aplicación Next.js con servidor
Node.js**, en `praetoriaabogados.es`. El panel del despacho está en `/admin`. Sustituye a la app separada en
`portal.praetoriaabogados.es` y a Netlify.

| Ruta | Qué es |
| --- | --- |
| `/`, `/contacto/`, `/blog/`… | Web pública. Se prerenderiza en el build y no depende de la base de datos |
| `/admin/` | Panel del despacho. Sin sesión lleva a `/entrar/`; exige personal activo y doble factor |
| `/entrar/`, `/inicio/`, `/solicitudes/`… | Acceso y área de clientes |
| `/api/consulta`, `/api/llamada` | Formularios públicos (`src/lib/recepcion.ts`), que sustituyen a los PHP |
| `/api/interno/avisos/` | Motor de avisos, disparado por cron |

Un fallo del servidor o de la base de datos no se comporta igual en las dos zonas: si cae la base de datos, las
páginas públicas siguen funcionando; si cae el proceso de Node.js, caen la web y el portal a la vez.

## Paso 1. Sitio de pruebas, sin tocar la web real
hPanel → Sitios web → Crear web → App web Node.js → importar desde GitHub:

| Ajuste | Valor |
| --- | --- |
| Repositorio | `FarinosV44/praetoria-web` |
| Rama | La de la PR |
| Directorio raíz | `./` |
| Marco | Next.js (`next`), salida `.next` |
| Script de compilación | `build` |
| Node | 22.x |
| Dominio | El temporal `*.hostingersite.com` |

Variables: las de `portal/.env.example`, con los valores pegados solo en hPanel, nunca en el repositorio (es público).
En este sitio, **`SITE_INDEXABLE=false`**, para que Google no lo indexe. `PORTAL_ORIGIN` es la URL del sitio de pruebas.
`DATABASE_URL_*` usan el pooler de Fráncfort (puerto 6543) con los roles `portal_app` y `portal_auth`. Nunca el usuario
`postgres`, que se salta RLS, ni el proyecto antiguo.

Los formularios del sitio de pruebas envían correos reales a `info@praetoriaabogados.es` si tiene `RESEND_API_KEY`.

## Paso 2. Comprobar el sitio de pruebas
- `npm run qa:redirecciones -- https://SITIO`: cada redirección de `public/_redirects`, con estado y destino.
- Portada, un artículo, un servicio, un 404 y los dos formularios, con envío real.
- `/admin/`, acceso con doble factor, instalación en el iPhone y un aviso push real.
- `TRUSTED_IP_HEADER`, ver abajo.

## Paso 3. Cambiar la web real (requiere el visto bueno del propietario)
El sitio actual sirve archivos estáticos, con `.htaccess` y PHP. Para cambiarlo:
1. Copiar su clave de Resend de `praetoria-config.php` (junto a `public_html`) a la variable `RESEND_API_KEY`.
2. Revisar sus variables actuales y dejar las de esta guía, con `PORTAL_ORIGIN=https://praetoriaabogados.es`.
   `SITE_INDEXABLE` debe quedar sin definir o en `true`.
3. Cambiar el marco a Next.js y fusionar en `main`.
4. Repetir el paso 2 sobre el dominio real y revisar Search Console.

**Marcha atrás:** Hostinger conserva las dos últimas versiones correctas. Si algo falla, restaurar la anterior y volver
a poner el marco y la carpeta de salida previos. Hay que anotar esos ajustes antes de cambiarlos.

## Motor de avisos
Hostinger no admite procesos ni temporizadores permanentes, así que los avisos (del despacho y de Seguros) los dispara
una tarea cron. En el panel del sitio: Avanzado → Cron Jobs → **Node.js**, archivo `scripts/cron.mjs`, cada minuto
(Opciones comunes → «Una vez por minuto»). Hostinger lo ejecuta con las variables de la web, así que la clave no se
escribe en el panel; el script llama a `PORTAL_ORIGIN/api/interno/avisos/` con `CRON_CLAVE`.

Alternativa «Personalizado» (la clave queda visible en el panel):

    curl -fsS -X POST -H "x-cron-clave: VALOR_DE_CRON_CLAVE" https://DOMINIO/api/interno/avisos/

Límites de Hostinger: 255 caracteres, sin `%`, horario en UTC. Si el panel rechaza las comillas, se pone la orden en un
archivo `.sh` fuera del repositorio y se programa ese archivo. Sin `CRON_CLAVE` (32+ caracteres), o con una clave
incorrecta, la ruta responde 404. El ciclo de las 06:00 UTC replanifica repeticiones y programa recordatorios.

## Cabecera de IP de confianza
`TRUSTED_IP_HEADER` es obligatoria y hay que comprobarla en el propio alojamiento: una cabecera que la CDN no sobrescriba
la puede falsificar cualquiera y anula el límite de intentos de acceso. Una petición `GET` a `/api/interno/avisos/` con la
cabecera `x-cron-clave` muestra las cabeceras de IP que llegan; se repite añadiendo una cabecera inventada y se elige la
que no cambie. Esa respuesta `GET` es temporal y se retira después.

## Pendiente de comprobar en Hostinger
- Intervalo de un minuto del cron: la documentación no fija un mínimo.
- Cabecera de IP real de la CDN.
- Carpeta `~/consultas-web`: que la app pueda escribir allí la copia de las consultas (si no, `CONSULTAS_COPIA_DIR`).
- Consumo: el plan estaba al 82–84 % de recursos antes de este cambio, y compartido con otras webs.

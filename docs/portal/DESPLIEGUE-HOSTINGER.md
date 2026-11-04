# Despliegue del portal en Hostinger (Node.js)

Decisión del propietario, 04/11/2026: el portal se aloja como aplicación Node.js en el plan Cloud de Hostinger,
no en Netlify. Es un sitio separado de la web pública, que no se toca.

## Crear la aplicación
hPanel → Sitios web → Crear web → App web Node.js → importar desde GitHub:

| Ajuste | Valor |
| --- | --- |
| Repositorio | `FarinosV44/praetoria-web` |
| Directorio raíz | `portal` |
| Marco | Next.js (`next`), salida `.next` |
| Script de compilación | `build` |
| Node | 22.x |

Hostinger compila con salida `standalone` y arranca el servidor por su cuenta. Mientras no se autorice el DNS de
`portal.praetoriaabogados.es`, se usa el dominio temporal `*.hostingersite.com` en `PORTAL_ORIGIN`.

## Variables de entorno
Las de `portal/.env.example`, con valores reales pegados solo en hPanel, nunca en el repositorio. Las de
`DATABASE_URL_*` usan el pooler de Fráncfort (puerto 6543) y los roles `portal_app` y `portal_auth`. Nunca el
usuario `postgres`, que se salta RLS, ni el proyecto antiguo.

`TRUSTED_IP_HEADER` es obligatoria y hay que comprobarla en el propio alojamiento: una cabecera que la CDN no
sobrescriba la puede falsificar cualquiera y anula el límite de intentos de acceso. Para comprobarla, una petición
`GET` a `/api/interno/avisos/` con la cabecera `x-cron-clave` muestra las cabeceras de IP que llegan; repítela
añadiendo una cabecera inventada y elige la que no cambie. Esa respuesta `GET` es temporal y se retira después.

## Motor de avisos
Hostinger no admite procesos ni temporizadores permanentes, así que los avisos los dispara una tarea cron. En
el panel del sitio: Avanzado → Cron Jobs, cada minuto:

    curl -fsS -X POST -H "x-cron-clave: VALOR_DE_CRON_CLAVE" https://DOMINIO/api/interno/avisos/

Límites de Hostinger: 255 caracteres, sin `%`, horario en UTC. Si el panel rechaza las comillas, se pone la orden en
un archivo `.sh` fuera del repositorio y se programa ese archivo. Sin `CRON_CLAVE` (32+ caracteres), o con una clave
incorrecta, la ruta responde 404. El ciclo de las 06:00 UTC replanifica repeticiones y programa recordatorios.

## Pendiente de comprobar en el alojamiento
- Intervalo de un minuto del cron (la documentación de Hostinger no fija un mínimo).
- Cabecera de IP real de la CDN.
- Consumo: el plan compartía un 84 % de recursos antes de añadir el portal.

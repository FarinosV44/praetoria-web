# Web preparada para agentes de IA

| Qué | Dónde | Notas |
| --- | --- | --- |
| Señales de uso del contenido | `src/app/robots.txt/route.ts` | `Content-Signal: search=yes, ai-train=no`. No declara `ai-input`. Solo en el build indexable |
| Datos del despacho | `src/lib/seo.ts` | Tipo `LegalService` y `LocalBusiness` en todas las páginas |
| Resumen del sitio | `src/app/llms.txt/route.ts` | Mismos criterios que el sitemap |
| Markdown por `Accept: text/markdown` | `next.config.ts` → `src/app/api/markdown/` | Lo genera `scripts/agentes/generar.mjs` en el build, en `.next/server/app/__markdown/`, desde el HTML final |
| Servidor MCP | `src/app/mcp/route.ts`, `src/lib/agentes/` | Público, sin estado y de solo lectura |
| Tarjeta del servidor MCP | `public/.well-known/mcp/server-card.json` | Si cambia la versión o el endpoint, actualizarla junto con `src/lib/agentes/mcp.ts` |
| WebMCP | `src/components/HerramientasAgentes.tsx` | Mismas herramientas que el servidor MCP, a través de `/mcp/` |

## Reglas

- **Solo lectura.** Las herramientas no envían formularios ni reciben datos de un caso. Una herramienta que escriba exige
  autenticación, límites de uso y revisión de confidencialidad antes de publicarse.
- **Solo lo publicado.** El servidor MCP y `llms.txt` no incluyen nada que esté fuera del sitemap, como lo pendiente de
  revisión jurídica o `/gracias/`. Con la cabecera `Accept`, una página con noindex también se sirve en Markdown, igual
  que se sirve en HTML.
- **El portal queda fuera.** Las rutas de `RUTAS_PORTAL` no se reescriben a Markdown ni se generan.

## CDN de Hostinger

La CDN (`hcdn`) guarda el HTML con `s-maxage` de un año y no respeta siempre `Vary`, y Next sobrescribe `Vary` en las
páginas prerenderizadas. Por eso:

- El Markdown sale con `Cache-Control: no-store`, para que la CDN nunca se lo sirva a un navegador. Esta cabecera no debe
  quitarse.
- Si una petición de Markdown coincide con HTML ya guardado en la CDN (`x-hcdn-cache-status: HIT`), recibirá el HTML.

Comprobación:

```sh
curl -sI -H 'Accept: text/markdown' https://praetoriaabogados.es/ | grep -iE 'content-type|x-hcdn-cache-status'
```

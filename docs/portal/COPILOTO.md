# Copiloto Jurídico

## Puesta en marcha, en este orden

1. **Aplicar las migraciones** `portal/db/migrations/0017_copiloto_ia.sql` y `0018_expediente_automatizaciones.sql` al proyecto Supabase `bhqrffiidjzxddqyoojt`, antes de desplegar el código: el código nuevo las necesita y el código actual funciona con ellas. Reversión: `portal/db/rollback/0018_down.sql` y luego `0017_down.sql`.
2. **Desplegar** la rama. Sin más cambios, sigue usando `ANTHROPIC_API_KEY`.
3. **Comprobar los modelos** en `/admin/ia/ajustes/` con «Comprobar disponibilidad real». Los modelos de OpenAI no se han verificado contra una cuenta real.
4. **Decidir el tratamiento de datos** en esa misma pantalla. Todo está desactivado por defecto: OpenAI, OCR y embeddings.
5. **Aprobar modelos en la Biblioteca.** Lo pendiente de revisión nunca se usa como modelo.

La indexación la procesa la tarea cron que ya llama a `/api/interno/avisos/`, cinco elementos cada vez.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude y OCR. Ya usada por el asistente anterior. |
| `OPENAI_API_KEY` | Opcional. Además hay que autorizar OpenAI en los ajustes. |

`IA_MODELO` deja de usarse en el portal: los modelos se eligen en los ajustes.

## Qué sale del servidor

| Función | Destino | Por defecto |
| --- | --- | --- |
| Preguntas y redacción con Claude | Anthropic: fragmentos del expediente y de la biblioteca | Activo si hay clave |
| Preguntas y redacción con OpenAI | OpenAI, con `store: false` | Desactivado |
| OCR de escaneados | Anthropic: el archivo completo | Desactivado |
| Búsqueda semántica en la biblioteca | OpenAI: modelos aprobados y texto de las consultas | Desactivado |
| Búsqueda semántica en expedientes | OpenAI: texto de los documentos | Desactivado |
| Comprobación de normas | BOE: solo identificadores públicos de normas | Activo |

Anthropic solo admite inferencia global o en EE. UU.: no hay opción de residencia en la UE en su API directa. Antes de usar datos reales, revisa el contrato de encargo de tratamiento de cada proveedor.

## Garantías que impone el servidor

- El contexto se prepara con la identidad de quien pregunta, bajo RLS. Los fragmentos de expediente y de biblioteca están en tablas distintas.
- Solo se usan modelos que cumplen `portal.bib_usable()`: aprobados, en versión vigente y no privados.
- Se retiran las citas a fuentes que no existen, la jurisprudencia que no figura en ninguna fuente y los datos identificables de otros asuntos.
- Una propuesta de la IA no cambia nada hasta que una persona la acepta. Un plazo aceptado queda como fecha sugerida sin verificar.
- Si responde un modelo distinto del pedido, la respuesta lo indica.

## Límites conocidos

- **Comprobación normativa:** solo BOE, con un catálogo de 14 normas (`src/portal/lib/boe.ts`). Comprueba que la norma consta vigente y que el artículo existe, no que sea aplicable al caso. El resto de normas se marca como no comprobada.
- **CENDOJ, CGPJ y EUR-Lex:** sin integrar. La jurisprudencia solo se admite si figura en las fuentes o en los modelos.
- **Editor:** trabaja sobre texto; no hay edición enriquecida. El formato lo aporta la exportación.
- **Revisión crítica en máxima calidad:** no se ha medido si mejora el resultado con modelos reales.
- **Reordenación:** fusión de rankings con prioridad por clase y procedimiento, sin un modelo de reordenación propio.

## Pruebas

```bash
# Base de datos (aislamiento, RLS, piezas puras)
node --env-file=.env.local --experimental-strip-types --test-concurrency=1 --test portal/tests/db/*.test.ts

# Extremo a extremo con proveedor SIMULADO: prueba el flujo, no la calidad de los modelos
node --experimental-strip-types portal/tests/e2e/proveedor-simulado.ts
ANTHROPIC_API_KEY=simulada OPENAI_API_KEY=simulada ANTHROPIC_BASE_URL=http://127.0.0.1:4599 OPENAI_BASE_URL=http://127.0.0.1:4599/v1 npx next start -p 3100
ANTHROPIC_BASE_URL=http://127.0.0.1:4599 npx playwright test -c portal/playwright.config.ts tests/e2e/copiloto.spec.ts
```

`ia.spec.ts` y `redactor.spec.ts` usan la API real y requieren `ANTHROPIC_API_KEY`.

# Área Laboral (#7) y mejoras de familia

## Laboral

- **Landing:** `/abogado-laboralista-valencia/`, en «Particulares y familias». Aparece en:
  - la navegación, el pie y el índice de áreas;
  - el directorio de la portada;
  - el formulario.

  Es una sola página para Valencia y El Puig: no hay sedes ni landings locales duplicadas.
- **Contacto: «Área laboral»**, 649 181 290 (`tel:+34649181290`, WhatsApp `34649181290`, configurado en `site.ts` → `contactos.laboral`). **Llamadas y WhatsApp** desde #28 (autorización del propietario del 24/10/2026, que sustituye la restricción anterior). Los botones dicen «Llamar al área laboral» y «WhatsApp del área laboral»; el nombre de Lucía López aparece con discreción en contacto y en «El despacho».
  - En la landing y en las páginas de servicio laboral, el botón de llamada va a Lucía.
  - En las páginas laborales (área, servicios y artículos laborales), todos los botones y la barra móvil van al número del área laboral; fuera de ellas, al general. Hay pruebas que lo comprueban.
  - El aviso de recepción indica que la consulta la revisará ella y da su teléfono.
  - Las demás áreas mantienen el contacto general.
- **Etiqueta antigua:** `/tag/abogado-laboralista-valencia/` redirigía al artículo de despido y ahora redirige a la landing, que coincide con su intención.

### Servicios: matriz servicio → landing → guías → formulario

| Servicio | Landing | Guías | Problema preelegido |
| --- | --- | --- | --- |
| Despidos e impugnación | `/impugnar-despido/` | Despido en Valencia: primeras 48 horas | despido |
| Salarios y finiquitos | `/reclamar-salarios-y-finiquito/` | (pendiente, #11) | cantidades |
| Incapacidad permanente | `/incapacidad-permanente/` | (pendiente, #11) | incapacidad |
| Accidentes laborales y responsabilidad empresarial | `/accidente-laboral/` | (pendiente, #11) | accidente |
| Altas médicas y prestaciones | Fila del área, sin página propia | — | incapacidad |
| Acoso y vulneración de derechos | Fila del área, sin página propia | — | acoso |
| Modificaciones de condiciones y conflictos | Fila del área, sin página propia | Baja de larga duración (art. 50 ET) | condiciones |

Se empieza por las cuatro landings prioritarias. Los otros tres servicios tienen ficha en el área, con qué revisamos, documentación y normas, pero **no página propia**: no se generan páginas sin contenido suficiente.

**Solapamientos.**
- Las prestaciones, la incapacidad y las altas pertenecen a Laboral.
- Las deudas, cotizaciones, apremios y embargos de la Seguridad Social pertenecen a Hacienda y Seguridad Social.
- Cada servicio lo indica en su campo `alcance`.

**Trabajadores y empresas.** Las páginas se dirigen a personas trabajadoras. **No se ha creado un servicio para empresas**, porque no consta que se ofrezca. Aun así, el formulario pregunta a quién representa la persona que consulta (dato obligatorio en laboral), y la landing avisa de que se revisan los conflictos de intereses antes de aceptar un encargo.

### Cuestionario laboral (formulario)

| Campo | Regla |
| --- | --- |
| A quién representa | Obligatorio: trabajador, empresa u otra persona |
| Tipo de problema | Opcional; viene preelegido desde el servicio |
| Situación actual | Opcional: en activo, de baja, fuera de la empresa u otra |
| Fecha de comunicación o de efectos | Opcional. Solo sirve para que una persona priorice: **la web no calcula plazos** |

El canal de contacto y el resultado buscado («¿qué te gustaría conseguir?») ya estaban en el formulario. **No se piden diagnósticos ni informes médicos**, y se avisa expresamente.

### Checklists documentales (futuro portal)

`docs/checklists-documentales.json` se genera desde `src/lib/servicios.ts`. Recoge, por servicio, la documentación con un id estable y la marca `sensible` (por ejemplo, los informes médicos). Es solo el modelo: la web pública no almacena documentos.

### Textos y fuentes (pendiente de revisión)

Todos los textos laborales están en `revision: 'pendiente'`. Las fuentes son el Estatuto de los Trabajadores (arts. 29, 41, 50, 55 y 59) y la LGSS (arts. 156, 164 y 194), enlazados al BOE.
- El art. 59 del ET se ha contrastado: el despido caduca a los 20 días hábiles, la conciliación interrumpe el plazo y las cantidades prescriben al año.
- Los demás artículos citados son referencias habituales, pero **el despacho debe revisarlos antes de publicar**.
- No hay importes, cuantías de indemnización ni promesas de resultado.

## Familia

- `/familia/` tiene tres recorridos:
  - **Mutuo acuerdo:** lleva a la comprobación del precio cerrado.
  - **Sin acuerdo, con hijos o con bienes:** requiere un estudio personalizado; lleva a la consulta.
  - **Modificación de medidas o ejecución de una sentencia:** lleva a la consulta.
- **Cuestionario de divorcio:**
  - Funciona igual que antes.
  - Ahora conserva las respuestas en la sesión: al recargar o volver, se mantienen el resultado y las selecciones.
  - Puede enviar las respuestas con el formulario: pasan por `sessionStorage` y **nunca por la URL**. El formulario muestra el resumen, permite quitarlo y lo entrega como campo `cuestionario` (solo en el área de familia).
- **Precio:** se mantiene el existente, 399 € en total (199,50 € por cónyuge), en la página de divorcio, el menú y el cuestionario, con el mismo criterio:
  - mutuo acuerdo completo;
  - sin hijos menores o dependientes;
  - sin bienes;
  - sin urgencias.

  **Para revisión:** en el cuestionario, «Sí, pero ya sabemos cómo repartirlos» (bienes con acuerdo) **no** entra en el precio cerrado, porque la página dice «sin bienes que repartir». Confirmad si ese es el criterio.

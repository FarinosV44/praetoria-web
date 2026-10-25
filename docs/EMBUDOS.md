# Embudos de Hacienda/SS, mercantil, civil y arte (#8)

Se completan las áreas existentes **sin crear páginas nuevas** para cada búsqueda: los recorridos y el formulario hacen el trabajo.

## Mapa de servicios sin solapamientos

| Asunto | Área |
| --- | --- |
| Requerimientos, liquidaciones y sanciones de la AEAT; deudas, apremios y embargos de la TGSS; derivación al administrador; devoluciones | Hacienda y SS |
| Prestaciones, incapacidad y altas (INSS o mutua) | **Laboral** (#7). El cuestionario de Hacienda lo deriva solo |
| Portes y servicios de transporte impagados | **Transporte** (#6) |
| Facturas e incumplimientos entre empresas que no son de transporte | Mercantil → «Reclamaciones entre empresas» (nuevo, texto pendiente de revisión) |
| Conflictos entre socios, pactos, contratos mercantiles | Mercantil |
| Herencias; vivienda y alquileres; contratos y reclamaciones; vecinos y comunidad | Civil |
| Asuntos de arte y patrimonio (alcance jurídico) | Arte y patrimonio |
| «No sé qué área corresponde» | Se mantiene: no pide asunto ni datos de ningún área |

`docs/SERVICIOS.md` recoge la lista completa, generada.

## Hacienda y Seguridad Social

Se reutilizan la landing y el cuestionario de notificaciones, que ya identificaba el organismo, el documento y la fecha.

**Novedad:** «Enviar con el formulario de consulta» (recomendado).
- Las respuestas pasan al formulario por `sessionStorage` (nunca por la URL), con el servicio deducido:
  - TGSS → deudas de la Seguridad Social;
  - derivación → derivación de responsabilidad;
  - INSS o una prestación → Laboral (altas y prestaciones);
  - en los demás casos → requerimientos de la AEAT.
- La consulta llega a Netlify Forms para revisión humana, con el organismo, el documento, la fecha y el resumen. WhatsApp y correo se mantienen como alternativas.

En el formulario, el área Hacienda pide **el organismo, obligatorio, con la opción «No lo sé»**. El documento y la fecha de recepción son opcionales. No se calculan plazos.

## Mercantil y civil

- **Mercantil.** Tres recorridos en el área: socio, contrato, y cliente o proveedor que no cumple. Este último lleva a la página de impagos de transporte si se trata de un porte.
- **Civil.** Cuatro recorridos: herencia, vivienda o alquiler, contrato o reclamación, y vecinos o comunidad.
- **Formulario** (mercantil, civil, familia y arte):
  - si no viene un asunto desde un CTA, se puede elegir uno, de forma opcional;
  - según el asunto, se hace **una pregunta mínima pertinente**, definida en `preguntaMinima` del servicio:
    - herencias → ¿hay testamento?;
    - vivienda → tu posición;
    - reclamaciones, contratos y responsabilidad → ¿con quién es el problema?;
    - socios → tu participación;
    - reclamaciones entre empresas → ¿quién reclama?;
    - custodia → ¿hay ya una sentencia o un convenio?
  - El servidor la valida contra las opciones del servicio.

## Arte y patrimonio

Una nota aclara el alcance real: el trabajo es jurídico, y las tasaciones, peritajes de autenticidad o informes de conservación los hace un especialista independiente, cuyo informe se valora desde el punto de vista legal. **Pendiente de confirmar por el despacho.** Los servicios llevan el CTA «Solicitar una consulta especializada». No se ha añadido experiencia ni servicios nuevos.

## Confirmaciones

El aviso de recepción indica el asunto («Asunto: …») y quién lo revisará. Sigue mostrándose solo cuando Netlify Forms acepta la entrega.

## Peso

Para no superar el presupuesto de `/contacto/` (#4), el navegador usa `src/lib/servicios-indice.ts`, un índice ligero generado, sin los textos ampliados. El JavaScript de la página pasa de 156 a 149 KB gzip. `npm run check` falla si el índice no está al día.

# Embudo de transporte (#6)

`/logistica-y-transporte-internacional/` sigue siendo el área principal. No se crea otra landing local de transporte.

## Recorridos

| Problema | Entrada en el área («¿Qué te ha pasado?») | Servicio | Consulta |
| --- | --- | --- | --- |
| Porte impagado | «No me pagan un porte» | Página propia `/reclamacion-portes-impagados/` | `/contacto/?servicio=transporte-portes-impagados`, con la incidencia «impago» preelegida |
| Mercancía dañada, perdida o con retraso | «La mercancía llegó dañada…» | Fila del área con «Qué revisamos», documentación y normas | `?servicio=transporte-mercancias`, con la incidencia «mercancía» |
| DeCA, documentación o contratos | «Dudas con el DeCA…» | Fila «DECA y subcontratación» y guías DeCA | `?servicio=transporte-deca-subcontratacion`, con la incidencia «deca» |

**Por qué los impagos tienen página propia.** Los dos artículos existentes («Acción directa…» e «Impagos en el transporte…») responden a una búsqueda informativa: qué es, cómo funciona. La página de servicio responde a otra intención, la de contratar: qué revisa el despacho, cómo trabaja, qué documentación ayuda y cuál es el siguiente paso. Los artículos se conservan y enlazan a la página.

**Pendiente.** Confirmar esta separación con datos de Search Console o DinoRANK cuando haya acceso.

## Formulario

En transporte aparecen cuatro campos opcionales, para no alargar el formulario:
- tu papel (transportista, agencia, cargador, destinatario u otro);
- el tipo de incidencia;
- el importe orientativo, por tramos;
- la fecha de la factura, la entrega o la incidencia.

La fecha solo sirve para que una persona priorice: la web no calcula plazos. No se admiten adjuntos: la documentación se pide después por un canal seguro.

## DeCA Profesional en los artículos

La recomendación de la herramienta (`DecaBand`) aparece **solo** en los artículos con el campo `deca: guia` o `deca: herramienta` en el frontmatter. En los artículos de reclamaciones aparece la contratación jurídica:
- la columna lateral enlaza al servicio;
- la banda final lleva a la consulta con el asunto preelegido.

Para que la herramienta aparezca en un artículo, se añade el campo `deca`.

## Textos jurídicos: pendientes de revisión

El texto ampliado de los servicios de impagos y mercancías está marcado como `revision: 'pendiente'` en `src/lib/servicios.ts` y en `docs/SERVICIOS.md`. Sale de los artículos ya publicados y de las fuentes oficiales, comprobadas el 23/10/2026:

- **Ley 15/2009**, del contrato de transporte terrestre de mercancías ([BOE](https://www.boe.es/eli/es/l/2009/11/11/15/con)):
  - art. 57: límite de indemnización (un tercio del IPREM/día por kilo bruto);
  - art. 60: reservas (en la entrega, o en 7 días naturales si el daño no es aparente; 21 días para el retraso);
  - art. 79: prescripción (con carácter general, un año).
- **Disposición adicional sexta de la Ley 9/2013**, acción directa del transportista efectivo ([BOE](https://www.boe.es/eli/es/l/2013/07/04/9/con)). Se ha contrastado con la STS 119/2021 citada en civil-mercantil.com. **No se ha podido abrir el texto de la disposición en el BOE desde esta sesión**, así que el despacho debe verificar la cita antes de publicar.

No hay precios, plazos de respuesta, porcentajes de éxito ni resultados.

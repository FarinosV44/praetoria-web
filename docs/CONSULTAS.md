# Recepción de consultas (#3)

## Recorrido de una consulta

```
Formulario /contacto/ ──POST JSON──▶ /api/consulta (netlify/functions/consulta.mts)
   │  validación en el navegador          │ 1. validación en servidor (mismas reglas: src/lib/consulta.ts)
   │  (mismas reglas)                     │ 2. antispam: campo trampa + mínimo 3 s desde que se cargó
   │                                      │ 3. asigna responsable por área
   │                                      ▼
   │                          Netlify Forms, formulario «contacto» (definido en public/__forms.html)
   │                                      │  guarda la consulta, aplica su filtro antispam (Akismet)
   │                                      │  y envía el aviso por correo configurado en Netlify
   ◀── 200 {ok, id} solo si Netlify Forms aceptó la entrega · 422 errores por campo · 502 fallo de entrega
```

Sin JavaScript, el mismo formulario se envía de forma clásica a `/api/consulta`. Si todo va bien redirige a `/gracias/`; si hay errores, muestra una página con la lista para volver atrás sin perder lo escrito.

## Reglas

| Campo | Regla |
| --- | --- |
| Nombre | Obligatorio, de 2 a 100 caracteres |
| Área | Obligatoria y **sin opción preelegida**, para que nada se clasifique solo y mal. Incluye «No sé qué área corresponde» |
| Consulta | De 20 a 2000 caracteres |
| Forma de contacto | Obligatoria, sin opción preelegida: llamada, correo o WhatsApp |
| Teléfono | **Obligatorio si se elige llamada o WhatsApp**. Entre 9 y 15 cifras |
| Correo | **Obligatorio si se elige correo**. Formato válido, máximo 254 caracteres |
| Asunto (servicio) | Opcional, viene de un CTA (`?servicio=`). Debe pertenecer al área elegida |
| Transporte: papel, tipo de incidencia, importe orientativo y fecha | Opcionales, **solo en el área de transporte** (en otra se descartan). Valores de lista; la fecha debe ser real y no futura. Sirve para priorizar a mano: no se calculan plazos |
| Privacidad | Hay que aceptarla |
| Cuerpo de la petición | Máximo 12 KB. No se admiten adjuntos |

La validación en el navegador es accesible:
- Resumen de errores con enlaces a cada campo, que recibe el foco.
- Cada campo con error lleva `aria-invalid` y su mensaje enlazado con `aria-describedby`.
- Las etiquetas indican cuándo un campo pasa a ser obligatorio.

**No se muestra éxito antes de tiempo**. La confirmación aparece en la propia página solo cuando la función responde que Netlify Forms aceptó la entrega. Si falla la red o la entrega, se avisa, se conservan los datos y el botón pasa a «Reintentar el envío». Un doble clic no duplica el envío, y los reintentos de una misma consulta llevan el mismo identificador.

**`/gracias/`** solo se usa en el envío sin JavaScript, tiene `noindex` y no se considera conversión: la medición de #9 se basará en la respuesta del servidor, no en visitar esa página.

## Contactos

Todos se configuran en `src/lib/site.ts`:

- **General**: 607 527 719 (`tel:+34607527719`, WhatsApp `34607527719`) y `juanfarinos@icav.es`. Coincide con el teléfono publicado en decaprofesional.es/contacto, según la consulta del 23/10 que recoge la issue. Ningún enlace de la web usa otro número.
- **Área laboral**: 649 181 290 (`tel:+34649181290`, WhatsApp `34649181290`). **Llamadas y WhatsApp** (autorizado en #28; antes, solo llamadas). Sin correo propio. Atiende Lucía López, que figura como responsable interna de las consultas laborales.
- **Mensajes predefinidos de WhatsApp**: centralizados en `mensajes`. Todos mencionan a Praetoria y el servicio jurídico, y ninguno el soporte de DeCA.

Corrección: el artículo sobre DeCA Conecta remitía a `info@praetoriaabogados.es` para consultas jurídicas. Se ha sustituido por `juanfarinos@icav.es`, el correo confirmado. **Si `info@` es un buzón real y atendido, puede volver a ponerse.**

## Pruebas

- `netlify/functions/consulta.test.mts` (11 pruebas):
  - entrega correcta con área y responsable, y Laboral asignada a Lucía López;
  - llamada o WhatsApp sin teléfono, correo ausente o inválido;
  - área sin elegir, privacidad sin aceptar, mensaje corto, campos largos y cuerpo excesivo;
  - campo trampa y envío rápido, que no se entregan;
  - fallo de Netlify Forms o de la red, que responde 502;
  - formulario clásico sin JavaScript, con redirección a `/gracias/` y página de errores;
  - solo se acepta el método POST.
- `tests/e2e/contacto.spec.ts` (8 pruebas en navegador): usan **la función real**, servida por `scripts/qa/serve.mjs`, contra un registro local que hace de Netlify Forms y puede simular fallos. Cubren:
  - área sin preelegir y obligatoria;
  - llamada sin teléfono;
  - WhatsApp sin teléfono y correo inválido;
  - envío correcto con doble clic, que se registra una sola vez y se confirma sin salir de la página;
  - el aviso y la asignación de Laboral a Lucía López;
  - fallo de red con reintento que entrega una sola vez;
  - fallo de la entrega, sin mensaje de éxito;
  - envío sin JavaScript.

## Pendiente de accesos a Netlify (no comprobado)

- [ ] **Detección del formulario**: tras el primer despliegue, *Forms* debe mostrar el formulario «contacto» con sus campos, detectados en `__forms.html`.
- [ ] **Entrega desde la función**: enviar una consulta ficticia desde el deploy preview y verla en *Forms → contacto*. Entre la función y Netlify Forms está todo probado en local salvo esto: que Netlify Forms acepte el POST de la función a `/__forms.html` del propio sitio. Si no lo aceptara, la alternativa es que la función envíe el correo directamente con un proveedor (requiere su clave) o guarde la consulta en Netlify Blobs.
- [ ] **Aviso por correo**: *Forms → Form notifications → Email notification* a `juanfarinos@icav.es`. Para que las consultas de Laboral le lleguen a Lucía López hace falta una dirección suya, que no se ha facilitado. Hasta entonces llegan al correo general, con el campo «responsable» indicándolo.
- [ ] Revisar en Netlify el filtro antispam y, si con el tráfico real entrara spam, valorar añadir reCAPTCHA de Netlify.
- [ ] Prueba de teléfonos en un móvil real: `tel:+34607527719` y `tel:+34649181290`.

Las consultas solo se envían a Netlify Forms. El campo trampa de Netlify sigue activo, por si alguien envía directamente a `__forms.html` sin pasar por la función; en ese caso se salta la validación del servidor, pero no el filtro antispam de Netlify.

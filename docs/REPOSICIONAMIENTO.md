# Reposicionamiento en Valencia y marca institucional (#28)

Esta instrucción prevalece sobre las anteriores (#3, #5, #7) que destacaban El Puig, ponían nombres propios en los botones o mostraban retratos.

## 1. Valencia como foco comercial

- **Portada, áreas, servicios, contacto, «El despacho», «Áreas de práctica», la imagen para redes (Open Graph) y los datos estructurados:** los titulares, títulos y descripciones se orientan a Valencia. Ejemplos: «Abogados en Valencia para empresas y particulares», «Abogados laboralistas en Valencia», «Abogados de derecho civil en Valencia».
- **No se ha inventado ninguna sede.** La dirección real (C/ Pintor Francisco Ribalta, 4A, 46540 El Puig de Santa María) se mantiene en:
  - contacto, el pie y «Cómo llegar»;
  - el aviso legal y la política de privacidad;
  - `address` en los datos estructurados.

  Allí se distingue el **mercado atendido** (`areaServed`: Valencia, provincia y España) de la **localización real** (`address`). No se han tocado coordenadas ni dirección.
- **No se han creado páginas municipales.** Las landings por localidad quedan para una fase posterior.

### Decisión por URL local

| URL | Decisión | Motivo |
| --- | --- | --- |
| `/abogado-el-puig/` | **Se conserva**, sin protagonismo. Se retira del pie y de la portada y se enlaza desde contacto («El despacho en El Puig») | Es la página local real y responde a búsquedas de El Puig. No hay página equivalente a la que redirigir sin perder intención |
| `/abogado-divorcio-horta-nord-valencia/` | **Se conserva la URL.** El H1 y el título pasan a «Abogados de divorcio en Valencia y l'Horta Nord». En el menú, el pie y el índice de áreas se enlaza como «Divorcio de mutuo acuerdo» | Es la página del servicio de divorcio con precio cerrado, y mantiene su valor local para l'Horta Nord |
| `/tag/…`, `/category/…` antiguas | Sin cambios | Siguen la decisión de #2 |

No hay redirecciones nuevas, salvo las del retrato y la foto con datos (apartado 2).

### Ocurrencias en la web generada

Generado con `node scripts/seo/ocurrencias.mjs out`. «Juan José Farinós» aparece en 43 páginas: es la firma de autoría y revisión de cada artículo, el aviso legal, la privacidad y la ficha profesional de «El despacho». Se conserva a propósito.

| Término | Página | En título/descr. | En el cuerpo |
| --- | --- | ---: | ---: |
| El Puig | `/` | 0 | 1 |
| El Puig | `/abogado-divorcio-horta-nord-valencia/` | 0 | 2 |
| El Puig | `/abogado-el-puig/` | 2 | 5 |
| El Puig | `/aviso-legal/` | 0 | 1 |
| El Puig | `/contacto/` | 0 | 2 |
| El Puig | `/el-despacho/` | 0 | 3 |
| El Puig | `/hacienda-me-pide-justificar-ingresos/` | 0 | 1 |
| El Puig | `/politica-de-privacidad/` | 0 | 1 |
| l'Horta Nord | `/abogado-divorcio-horta-nord-valencia/` | 2 | 4 |
| l'Horta Nord | `/abogado-el-puig/` | 0 | 1 |
| Lucía López | `/` | 0 | 1 |
| Lucía López | `/contacto/` | 0 | 1 |
| Lucía López | `/el-despacho/` | 0 | 2 |
| Lucía López | `/politica-de-privacidad/` | 0 | 1 |

**Lectura de la tabla:**
- En la portada, contacto y «El despacho», «El Puig» solo aparece en la **dirección real** (tarjeta de contacto, pie, «Cómo llegar»).
- En el aviso legal y la privacidad, es el domicilio del titular.
- En los artículos queda en dos pies de autoría con la dirección (`hacienda-me-pide…`, `has-recibido…`) y en el texto local de `demanda-contrato-alquiler…`.
- Las frases promocionales de los artículos («Contacta conmigo en El Puig», «📍 Valencia – El Puig», encabezados «(Valencia / El Puig)») se han pasado a Valencia y a voz institucional. La auditoría editorial completa es #10.
- «Lucía López» aparece de forma discreta: tarjeta del área laboral en portada y contacto, «El despacho» y privacidad (responsable de las consultas laborales).

## 2. Marca institucional y privacidad

- **Portada.** Se retiran el retrato y el bloque «Quién lleva tu asunto». En su lugar:
  - «Áreas de práctica · Una estrategia para cada asunto», con Laboral destacada;
  - «Método · Primero tu objetivo. Después, la estrategia.»;
  - «Si te urge»;
  - «Contacta con el despacho», por áreas.
- **«El despacho»** pasa a ser una página institucional: criterio jurídico y visión de empresa, método, áreas y espacio. La identificación profesional queda en «Datos del despacho» (letrado responsable y número de colegiado, área laboral). Sin foto ni primera persona.
- **Textos de área.** «Juan José Farinós Ibáñez une…» pasa a «El área une…»; en arte, «El área la dirige un abogado con formación en Derecho y en Historia del Arte».
- **Retrato y foto con datos retirados de la web.**
  - `juan-jose-farinos*.webp` deja de servirse. Sus URL antiguas de WordPress ya no redirigen (404).
  - El original `despacho-sala-reunion*.webp` dejaba leer correos, chats, importes y un extracto en el portátil, y mostraba a una persona. También deja de servirse; su URL antigua redirige al recorte sin datos.
  - Los dos originales se guardan fuera de lo publicado (`fotos/`, repositorio privado). Ver `fotos/README.md`.
  - **No se ha reescrito el historial de Git ni se pueden borrar copias externas** (cachés de buscadores, el WordPress actual, redes).
- **Imagen para redes** (`og-praetoria.jpg`): se regenera con la foto retocada, el lema y «Abogados en Valencia para empresas y particulares», sin El Puig ni número de colegiado (`scripts/og/generar-og.py`).
- **No se ha inventado nada:** ni plantilla, ni oficinas, ni testimonios, ni resultados.

## 3. Contactos por área

Están centralizados en `src/lib/site.ts` → `contactos` y `canalDe(area)`.

| Canal | Número | Botones |
| --- | --- | --- |
| Atención jurídica general | 607 527 719 · `tel:+34607527719` · `wa.me/34607527719` | «Contactar con el despacho», «Llamar al despacho», «Consultar por WhatsApp», «Solicitar una valoración» |
| Área laboral | 649 181 290 · `tel:+34649181290` · `wa.me/34649181290` | «Llamar al área laboral», «WhatsApp del área laboral», «Enviar consulta laboral» |
| Correo general | juanfarinos@icav.es | — |

- **Llamadas y WhatsApp del área laboral:** autorizados en #28. Sustituye la restricción de «solo llamadas».
- **Dónde se aplica:**
  - cabecera: «Contactar con el despacho», que lleva a `/contacto/`;
  - pie: números por área;
  - barra móvil: contextual;
  - tarjetas, banda final, cabeceras de área y servicio, artículos y formulario: aviso de recepción y nota laboral.
- **Contexto.** En el área laboral, sus servicios y sus artículos, todo el contacto va al área laboral; fuera, al general.
- **Números en zonas secundarias.** Los números ya no son texto de botón en las cabeceras: aparecen en contacto, en el pie, en las tarjetas por área y en la banda final, etiquetados por área.
- **WhatsApp de los cuestionarios.** Ya no llevan las respuestas en la URL, solo un mensaje genérico. Las respuestas completas solo viajan con el formulario.

## 4. Mensaje y método

- **Titular:** «Tus objetivos. Nuestra estrategia jurídica.»
- **Subtítulo:** «Abogados en Valencia para empresas y particulares».
- **Apoyo:** «Entendemos qué quieres conseguir, analizamos las opciones y diseñamos una estrategia para defender tus intereses. Negociamos y actuamos con un objetivo claro.»
- **CTA:** «Cuéntanos qué quieres conseguir».
- **Accesos por objetivo:** recuperar lo que te deben, defender tus derechos laborales, resolver un conflicto, proteger tu patrimonio y dar seguridad a una decisión de empresa.
- **Método** (`src/lib/iconos.ts`):
  1. Entendemos tu objetivo.
  2. Analizamos opciones, riesgos y costes.
  3. Diseñamos la estrategia y negociamos.
  4. Actuamos y te acompañamos.

  Aparece en la portada, en cada área y en «El despacho». Sin garantías de resultado.
- **Objetivo por área** (por ejemplo, Laboral: «Defender tus derechos y tus ingresos»): se muestra en la cabecera del área y en la tarjeta de objetivo de cada servicio.
- **Formulario.** Ya preguntaba «¿Qué ha pasado y qué te gustaría conseguir?». No se ha alargado.

## 5. Diseño e iconos

- **Identidad.** Se conservan el logo, el rojo, el grafito, la piedra y las tipografías Archivo y Source Serif.
- **Composición nueva:**
  - portada en banda grafito, con una fotografía editorial de trabajo jurídico con personas a sangre y los accesos por objetivo;
  - tarjetas de área con icono;
  - método en banda oscura, solo con iconos (sin foto);
  - contactos por área;
  - cabeceras de área y servicio con una escena propia de cada asunto y tarjeta de objetivo; sin imagen pertinente, composición tipográfica (no oficinas vacías);
  - introducción junto al método compacto, en lugar de un bloque largo de texto.
- **Iconos** (`LineIcon`, `src/components/Icon.tsx`):
  - una sola familia: rejilla de 24, trazo 1,75, extremos redondeados;
  - sin mazos ni balanzas;
  - decorativos y ocultos a los lectores de pantalla, con las acciones siempre en texto.
- **Accesibilidad y movimiento.** Lighthouse da 100 en accesibilidad en las páginas medidas. Se ha corregido el contraste de los números del método. Las transiciones se desactivan con `prefers-reduced-motion`.

## 6. Fotografías

**No hay ninguna herramienta de edición de imágenes por IA disponible en esta sesión.** El retoque aplicado es **clásico y reproducible** (`scripts/fotos/retocar.py`, OpenCV): recorte y encuadre, balance de blancos parcial (dominantes amarillas y verdosas), exposición (CLAHE suave y apertura de sombras) y nitidez moderada. No añade ni inventa nada.

Además, se han difuminado de forma irreversible, con máscara de borde suave:
- las personas que se veían al fondo, en tres fotos;
- un reflejo en un cristal;
- un papel sobre una mesa.

La foto con el portátil se ha **recortado** para quedarse solo con los cristales y la planta abierta.

| Derivado (public/media/v2/) | Original | Uso (actualizado tras la ampliación de #28) |
| --- | --- | --- |
| despacho-salas-reuniones | despacho-salas-reuniones | «El despacho» (foto secundaria) |
| despacho-atencion-cliente | despacho-atencion-cliente | «El despacho» (foto secundaria) |
| despacho-cristales-planta, planta-abierta, zona-espera, zona-mesas, oficina-sofa, detalle-madera-cristal | — | Retiradas de la web (se conservan los archivos como reserva) |

Cada uno tiene versiones de 1600, 800 y 480 px en WebP. Las comparativas original/retocada están en la rama `capturas`, carpeta `pr28/fotos/`.

### Pendiente: retoque con IA (encargos preparados)

Para quien lo haga con una herramienta de IA, partiendo de los **originales** (no de los derivados):
- **Todas:** corregir la distorsión de gran angular y enderezar las verticales (pilares, mamparas, marcos); balance neutro; techo negro con detalle sin aclararlo artificialmente; suelo con su tono cálido real; nitidez natural. **No añadir ni quitar arquitectura, mobiliario, personas, vistas ni señalización de seguridad.**
- **salas-reuniones:** recuperar la transparencia de los cristales y el vinilo de puntos; el reflejo de la persona debe quedar irreconocible.
- **sala-reunion:** usar solo la mitad superior. El portátil y la persona del fondo no deben aparecer en el resultado.
- **atencion-cliente, oficina-sofa y planta-abierta:** las personas del fondo deben seguir irreconocibles (difuminado, no borrado engañoso).
- **zona-espera y zona-mesas:** aclarar ligeramente las sombras bajo las mesas y respetar el azul de las sillas.
- **Entrega:** WebP de 1600 px con los mismos nombres, en `public/media/v2/`. Después, regenerar las versiones de 800 y 480 px.

### Ampliación de #28: oficinas vacías fuera, fotografía editorial dentro

Las fotos de oficinas vacías tenían demasiado protagonismo. Se retiran de portada, método, áreas, servicios y `/abogado-el-puig/`;
solo quedan dos, como fotos secundarias, al final de «El despacho». En su lugar:

- **Fotografía editorial con licencia** (Unsplash, uso comercial gratuito) elegida por escena: portada (análisis y conversación
  con personas), Transporte (camión en muelle), Laboral (asesoramiento), despidos (revisión conjunta de un documento),
  Mercantil (negociación), Civil (vivienda y llaves), Familia (conversación tranquila), Arte (restauración de una obra),
  Hacienda (documentación financiera con cifras desenfocadas). Ninguna persona se presenta como miembro del despacho.
- **Capturas reales de DeCA Profesional** en los artículos de producto y el **logotipo oficial** en el bloque DeCA.
- **Composición tipográfica** donde no hay imagen pertinente (incapacidad permanente, accidente laboral, «El despacho»,
  El Puig y 11 artículos marcados como pendiente editorial).

Registro único, procedencia, licencias y usos: `docs/IMAGENES.md`. Matriz del blog: `docs/BLOG-MATRIZ.md`.

## 7. Comprobaciones (locales)

Las comprobaciones de GitHub siguen bloqueadas por la facturación. Ver la PR para el detalle.

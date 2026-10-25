# Contenidos desde un chat (#34)

Flujo ligero para encargar un artículo o una landing en ChatGPT (o en Claude) e incorporarlo a la web sin CMS, sin
Supabase y sin conexiones automáticas entre chats. El contenido acaba siendo un archivo Markdown del repositorio,
revisado en una PR con su previsualización de Netlify.

## Resumen del flujo

1. **Encargo.** El propietario pide el contenido en un chat con el [encargo mínimo](#encargo-mínimo) o con la
   [plantilla completa](#plantilla-del-paquete). El chat devuelve un **paquete**: un único archivo `.md`.
2. **Entrega a Claude.** El paquete llega adjunto en la conversación, en un issue del repositorio (cuando el propietario
   lo autorice) o como archivo en `contenidos/entrada/`. Claude no tiene acceso a la biblioteca ni al entorno de ChatGPT:
   solo usa lo que se le adjunta o lo que está en el repositorio.
3. **Importación.** En una rama de trabajo:
   `node scripts/contenidos/importar.mjs contenidos/entrada/<archivo>.md` valida sin escribir;
   con `--escribir` crea `src/content/blog/<slug>.md` o `src/content/landings/<slug>.md`.
4. **PR y previsualización.** `npm run build && npm run check`, PR hacia la rama de publicación y revisión en la
   previsualización de Netlify (gratuita).
5. **Revisión jurídica y editorial** por una persona real del despacho.
6. **Publicación**, solo con la orden expresa del propietario para ese contenido concreto.

## Tres estados, tres efectos

| `estado` en el paquete | Qué escribe el importador | Dónde aparece |
| --- | --- | --- |
| `borrador` | `draft: true` | En ninguna build. Sirve para guardar trabajo en curso. |
| `revision` | `revision: pendiente` | Solo en la previsualización, con el aviso «Pendiente de revisión jurídica», `noindex` y fuera de listados, sitemap y RSS. **La build de producción no lo genera.** |
| `aprobado` | `revision: revisado` y `revisor` | Publicable. Exige un revisor real (Juan José Farinós Ibáñez o Lucía López). Se publica cuando el propietario lo ordena. |

Ninguno de los tres despliega nada por sí mismo: preparar para revisión no es publicar.

## Encargo mínimo

Para un encargo sencillo basta con esto; el resto de campos tiene valores por defecto o lo completa Claude al importar
(y lo señala en la PR):

```text
Prepara un paquete editorial para la web de Praetoria (formato de docs/CONTENIDOS-DESDE-CHAT.md).
Tipo: artículo | landing
Tema e intención: <qué quiere resolver quien llega, en una frase>
Área: transporte | mercantil | hacienda | civil | familia | laboral | penal
Público: particulares | empresas | ambos
Fuentes: cita la norma del BOE (o del organismo) de cada plazo, importe o requisito. Si no puedes verificarlo, no lo afirmes.
Imagen: describe la escena exacta que haría falta, sin texto legible ni logotipos.
Devuélvelo como un único archivo .md con la cabecera YAML de la plantilla y el cuerpo en Markdown, sin HTML.
```

## Plantilla del paquete

Copiar tal cual y rellenar. Los comentarios (`#`) se pueden dejar.

```markdown
---
tipo: articulo            # articulo | landing
estado: revision          # borrador | revision | aprobado
slug: ejemplo-de-slug     # URL: /ejemplo-de-slug/ · minúsculas, sin tildes, con guiones
publico: particulares     # particulares | empresas | ambos
area: laboral             # transporte | mercantil | hacienda | civil | familia | arte | laboral | penal
servicio: laboral-despidos # opcional: id de docs/SERVICIOS.md
categoria: laboral        # solo artículos; por defecto, la del área (Penal aún no tiene categoría de blog)
intencion: "Una sola intención de búsqueda, en una frase"
titulo: "Titular (H1)"
seoTitle: "Título para buscadores (≤ 60 caracteres)"
descripcion: "Meta description de 50 a 170 caracteres."
resumen: "Entradilla bajo el H1 (obligatoria en landings)."
autor: Juan José Farinós Ibáñez   # persona real del despacho
revisor:                  # solo si ya lo ha revisado una persona real
fecha: 2026-10-24         # fecha real de redacción; al actualizar se conserva la original
actualizado:              # opcional
imagen:
  id: despidos            # id de src/content/imagenes.json
  # o bien:
  # pendiente: "Escena exacta que falta, sin texto legible ni logotipos"
cta:
  texto: "Solicitar revisión de mi despido"
  destino: contacto       # contacto | llamada | /ruta-interna/
enlaces:                  # opcional: páginas propias que el texto debe enlazar
  - /impugnar-despido/
faqs:
  - q: "Pregunta real que hace la gente"
    a: "Respuesta útil, con la norma si afirma un plazo o un requisito."
fuentes:
  - titulo: "Estatuto de los Trabajadores, art. 59"
    url: "https://www.boe.es/eli/es/rdlg/2015/10/23/2/con#a59"
---

Cuerpo en Markdown. Secciones con «## » (el H1 es el titular). Sin HTML, sin scripts, sin iframes.
Enlaces internos con barra final, p. ej. [impugnar un despido](/impugnar-despido/).
```

## Qué comprueba el importador

- Cabecera: tipo, estado, slug, área y servicio existentes y coherentes, intención, titular, descripción, fechas
  reales y no futuras, autor y revisor que sean personas reales del despacho (`aprobado` exige revisor).
- Cuerpo seguro: rechaza etiquetas HTML, manejadores de eventos, expresiones de código y enlaces `javascript:`/`data:`.
- Enlaces: los internos deben existir hoy (páginas, áreas, artículos, landings) y llevar barra final; los externos, https.
- Imagen: id del registro (`src/content/imagenes.json`) o escena pendiente. Nunca una imagen cualquiera; las fotos de
  las instalaciones solo van en «El despacho». Una imagen nueva se registra y procesa antes (`docs/IMAGENES.md`).
- Fuentes: https; avisa si no es una fuente oficial (BOE, organismos).
- URL: no pisa páginas de la app, áreas, artículos ni landings, ni una URL antigua de WordPress que hoy redirige.
  Para sustituir un contenido existente hace falta `--actualizar`, que conserva la fecha original.

Después, el build vuelve a validar el esquema (`src/lib/content.ts`) y `npm run check` comprueba enlaces, sitemap,
borradores, datos estructurados y la matriz de imágenes.

## Al publicar

- Cambiar `revision: pendiente` por `revision: revisado` y añadir `revisor` (persona real).
- El sitemap, el RSS, los listados del blog y los datos estructurados (BlogPosting, FAQPage, OG) se actualizan solos en
  la build; la categoría y el enlace al servicio salen de la cabecera.
- Enlazar la landing desde su área o servicio cuando el propietario lo apruebe: una landing sin enlaces internos es una
  página huérfana.

## Ejemplos

`contenidos/ejemplos/` contiene un artículo y una landing de ejemplo, importados en esta PR como **pendientes de
revisión**: se ven en la previsualización y no existen en producción. Si no se aprueban, se borran
(`src/content/blog/citacion-juicio-delito-leve-que-hacer.md` y `src/content/landings/juicio-rapido-alcoholemia-valencia.md`).

## Landings y dominios (#11)

- Las landings se crean **dentro de praetoriaabogados.es** y se enlazan desde su área o servicio.
- Cada propuesta registra: intención, URL interna con la que compite, qué aporta de distinto, fuentes, CTA, demanda
  (solo si hay datos reales de Search Console o DinoRANK) y cómo se medirá.
- No se crean dominios ni sitios casi idénticos, ni páginas por localidad que solo canalizan a otra página: Google lo
  trata como *doorway abuse* ([políticas de spam](https://developers.google.com/search/docs/essentials/spam-policies)).
  Un dominio con la palabra clave no garantiza posicionamiento.
- Un dominio adicional solo se plantea con un servicio o proyecto diferenciado, o para una campaña concreta; un alias de
  campaña redirige de forma permanente a una única landing, sin duplicar contenido indexable.
- Antes de comprar nada: disponibilidad, precio y renovación de la propuesta concreta, y aprobación del propietario. Sin
  cambios de DNS. Esta evaluación no retrasa la publicación de la web principal.

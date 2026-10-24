# Fotografías fuera de la web publicada

Esta carpeta **no se publica**: Netlify solo sirve `out/`, que se genera a partir de `public/`. El repositorio es privado.

- `originales/despacho-sala-reunion.webp`: es el original de la sala de reuniones. Se retiró de la web porque el portátil muestra correos, chats e importes, y al fondo se ve a una persona. Solo sirve como fuente del recorte `public/media/v2/despacho-cristales-planta.webp`, que excluye ambas cosas (`scripts/fotos/retocar.py`).
- `retirados/juan-jose-farinos.webp`: retrato retirado de la web (#28). Las URL antiguas de WordPress que apuntaban a él ya no redirigen (dan 404).

Limitación: las copias que ya existan fuera (cachés de buscadores, la web WordPress actual o redes sociales) no se borran desde aquí. Tampoco se ha reescrito el historial de Git: el repositorio es privado.

## Originales editoriales (#28)

- `editorial/<id>.jpg`: fotografías de Unsplash (licencia Unsplash, uso comercial gratuito) a 2400 px, descargadas por el
  enlace oficial de descarga de cada foto. Autor, enlace y uso de cada una en `docs/IMAGENES.md`.
- `deca/*.png`: capturas reales de DeCA Profesional (repositorio farvertrans-deca, `public/guia/`, datos de demostración)
  y el logotipo original (`logo-original.png`). No se retocan ni se recrean.

Se procesan con `npm run imagenes` (recorte por punto focal, AVIF y WebP en 1600/1200/800/480 px y JPEG para redes).
- `ia/*.png`: escenas generadas con IA entregadas por el titular (paquete `praetoria-imagenes-claude-v2.zip`, #28 §8).
  Solo se guardan las siete incorporadas. Dos son recreaciones a partir de fotografías autorizadas por el titular; las
  fotografías personales de referencia no están en el repositorio. No se retocan ni se regeneran las caras.

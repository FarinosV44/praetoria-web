import { rutaImagen, srcSet, type ImagenPublicada } from '@/lib/imagenes';
import { LineIcon } from './Icon';

// Fotografía editorial del registro (#28): AVIF + WebP, dimensiones explícitas (sin CLS),
// recorte por punto focal y carga diferida salvo que sea la imagen principal de la página.
export function Foto({
  img,
  sizes,
  prioridad = false,
  className,
  decorativa = false,
  ancho,
}: {
  img: ImagenPublicada;
  sizes: string;
  prioridad?: boolean;
  className?: string;
  /** true si el texto de al lado ya cuenta lo mismo (alt vacío) */
  decorativa?: boolean;
  /** variante por defecto del atributo src */
  ancho?: number;
}) {
  return (
    <picture className={className}>
      {img.avif !== false && <source type="image/avif" srcSet={srcSet(img, 'avif')} sizes={sizes} />}
      <img
        src={rutaImagen(img, ancho ?? 800)}
        srcSet={srcSet(img)}
        sizes={sizes}
        alt={decorativa ? '' : img.alt}
        width={img.ancho}
        height={img.alto}
        style={{ objectPosition: img.foco }}
        loading={prioridad ? undefined : 'lazy'}
        decoding="async"
        fetchPriority={prioridad ? 'high' : undefined}
      />
    </picture>
  );
}

/** Composición tipográfica cuando no hay una imagen pertinente: no se rellena el hueco con una foto cualquiera. */
export function Composicion({
  icono,
  etiqueta,
  titulo,
  texto,
  variante = 'cabecera',
}: {
  icono: LineIcon;
  etiqueta?: string;
  titulo: string;
  texto?: string;
  variante?: 'cabecera' | 'tarjeta';
}) {
  return (
    <div className={`composicion composicion--${variante}`} aria-hidden={variante === 'tarjeta' ? true : undefined}>
      <LineIcon name={icono} className="composicion__icono" />
      {etiqueta && <p className="composicion__etiqueta">{etiqueta}</p>}
      <p className="composicion__titulo">{titulo}</p>
      {texto && <p className="composicion__texto">{texto}</p>}
    </div>
  );
}

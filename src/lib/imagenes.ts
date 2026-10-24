// Registro de imágenes editoriales (#28). Una sola fuente: src/content/imagenes.json.
// Las páginas referencian un id; si la imagen está pendiente, no se muestra ninguna
// (la página usa una composición tipográfica) y el check la lista como pendiente editorial.
import { z } from 'zod';
import datos from '../content/imagenes.json';

const origen = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('unsplash'),
    id: z.string().min(5),
    autor: z.string().optional(),
    url: z.string().url().optional(),
    perfil: z.string().url().optional(),
    licencia: z.string().optional(),
  }),
  z.object({ tipo: z.literal('deca'), archivos: z.array(z.string()).min(1) }),
  z.object({ tipo: z.literal('praetoria'), original: z.string() }),
]);

const imagenSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    estado: z.enum(['publicada', 'pendiente']),
    escena: z.string().min(8),
    archivo: z.string().regex(/^[a-z0-9/-]+$/),
    alt: z.string().min(20).max(160),
    foco: z.string().regex(/^\d{1,3}% \d{1,3}%$/),
    ancho: z.number().int().positive().optional(),
    alto: z.number().int().positive().optional(),
    variantes: z.array(z.number().int().positive()).optional(),
    avif: z.boolean().optional(),
    composicion: z.enum(['escritorio', 'movil-doble', 'ficha']).optional(),
    origen,
  })
  .superRefine((img, ctx) => {
    if (img.estado !== 'publicada') return;
    if (!img.ancho || !img.alto || !img.variantes?.length) ctx.addIssue({ code: 'custom', message: `${img.id}: publicada sin dimensiones ni variantes` });
    if (img.origen.tipo === 'unsplash' && (!img.origen.autor || !img.origen.url))
      ctx.addIssue({ code: 'custom', message: `${img.id}: falta autor o enlace de Unsplash` });
  });

export type Imagen = z.infer<typeof imagenSchema>;
export type ImagenPublicada = Imagen & { ancho: number; alto: number; variantes: number[] };

const parsed = z.object({ imagenes: z.array(imagenSchema) }).safeParse(datos);
if (!parsed.success) throw new Error(`src/content/imagenes.json no es válido: ${parsed.error.message}`);
export const registro: Imagen[] = parsed.data.imagenes;

const porId = new Map(registro.map((i) => [i.id, i]));
if (porId.size !== registro.length) throw new Error('src/content/imagenes.json: hay ids repetidos');

/** ¿Existe el id en el registro (publicada o pendiente)? */
export const existeImagen = (id: string) => porId.has(id);

/** La imagen si está publicada; undefined si está pendiente (la página muestra composición tipográfica). */
export function imagen(id?: string | null): ImagenPublicada | undefined {
  if (!id) return undefined;
  const img = porId.get(id);
  if (!img) throw new Error(`Imagen desconocida: "${id}" (añádela a src/content/imagenes.json)`);
  return img.estado === 'publicada' ? (img as ImagenPublicada) : undefined;
}

const base = (img: Imagen) => `/media/${img.archivo}`;
/** Ruta de una variante; la mayor no lleva sufijo de anchura. */
export function rutaImagen(img: ImagenPublicada, ancho?: number, ext: 'webp' | 'avif' = 'webp') {
  const max = Math.max(...img.variantes);
  const w = ancho && img.variantes.includes(ancho) ? ancho : max;
  return `${base(img)}${w === max ? '' : `-${w}`}.${ext}`;
}
export const srcSet = (img: ImagenPublicada, ext: 'webp' | 'avif' = 'webp') =>
  img.variantes.map((w) => `${rutaImagen(img, w, ext)} ${w}w`).join(', ');
/** Imagen para compartir (1200×630, JPEG), generada por scripts/imagenes/procesar.py. */
export const ogImagen = (img: ImagenPublicada) => `/media/${img.archivo}-og.jpg`;

/** Crédito visible bajo la imagen: autor y fuente, o la procedencia propia. */
export function creditoDe(img: Imagen): string {
  switch (img.origen.tipo) {
    case 'unsplash':
      return `Foto: ${img.origen.autor ?? 'autor pendiente'} en Unsplash`;
    case 'deca':
      return 'Captura real de DeCA Profesional (datos de demostración)';
    case 'praetoria':
      return 'Instalaciones de Praetoria en El Puig';
  }
}

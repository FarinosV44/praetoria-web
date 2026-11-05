import { z } from 'zod';
import { Invalido } from './errores';
import { esFecha } from './fechas';
import { leerImporte } from './dinero';

export function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.infer<T> {
  const r = esquema.safeParse(datos);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = String(i.path[0] ?? '_');
    campos[k] ??= i.message;
  }
  throw new Invalido(campos);
}

/** Texto opcional: vacío → null. */
export const textoOpc = (max = 500) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v) || null, z.string().max(max, `Máximo ${max} caracteres.`).nullable());

export const textoReq = (max = 200, msg = 'Este campo es obligatorio.') =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string({ error: msg }).min(1, msg).max(max, `Máximo ${max} caracteres.`));

/** Fecha opcional 'YYYY-MM-DD': vacía → null (pendiente). */
export const fechaOpc = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v) || null,
  z.string().refine(esFecha, 'Fecha no válida.').nullable(),
);

/** Importe opcional en formato español: vacío → null (pendiente). */
export const importeOpc = z.preprocess((v) => {
  const r = leerImporte(v);
  return r === undefined ? 'invalido' : r;
}, z.string().regex(/^\d+\.\d{2}$/, 'Importe no válido (ejemplo: 1.234,56).').refine((v) => Number(v) < 1e10, 'Importe demasiado alto.').nullable());

/** Casilla de formulario o select «sí / no / no consta». */
export const triestado = z.preprocess((v) => (v === 'si' || v === 'true' || v === 'on' ? true : v === 'no' || v === 'false' ? false : null), z.boolean().nullable());
export const casilla = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const formulario = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'));

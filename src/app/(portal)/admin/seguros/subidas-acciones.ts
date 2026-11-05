'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { confirmarSubidas, prepararSubidas } from '@/seguros/lib/datos/subidas';
import { Invalido, NoEncontrado } from '@/seguros/lib/errores';

type R<T> = { ok: true; datos: T } | { ok: false; error: string };

async function seguro<T>(fn: () => Promise<T>): Promise<R<T>> {
  try { return { ok: true, datos: await fn() }; } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Invalido) return { ok: false, error: Object.values(e.campos)[0] ?? e.message };
    if (e instanceof NoEncontrado) return { ok: false, error: 'No se ha encontrado.' };
    console.error('[subida]', (e as Error).message);
    return { ok: false, error: 'No se ha podido completar la subida. Inténtalo de nuevo.' };
  }
}

export async function accionPrepararSubidas(destino: 'poliza' | 'siniestro', id: string, archivos: { nombre: string; bytes: number }[]) {
  return seguro(async () => prepararSubidas(await exigirUsuario(), destino, id, archivos));
}

export async function accionConfirmarSubidas(destino: 'poliza' | 'siniestro', id: string, claves: string[], extra: { tipo: string; anualidadId?: string | null }) {
  return seguro(async () => {
    const r = await confirmarSubidas(await exigirUsuario(), destino, id, claves, extra);
    revalidatePath(destino === 'poliza' ? `/admin/seguros/polizas/${id}` : `/admin/seguros/siniestros/${id}`);
    return r.map((x) => ({ nombre: x.nombre, duplicadoDe: x.duplicadoDe }));
  });
}

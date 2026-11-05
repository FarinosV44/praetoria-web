'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { confirmarSubidas, prepararSubidas } from '@/seguros/lib/datos/subidas';
import { crearImportacion, procesarImportacion } from '@/seguros/lib/ia/importacion';
import { after } from 'next/server';
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

type Destino = 'poliza' | 'siniestro' | 'importacion';

export async function accionPrepararSubidas(destino: Destino, id: string, archivos: { nombre: string; bytes: number }[]) {
  return seguro(async () => prepararSubidas(await exigirUsuario(), destino, id, archivos));
}

export async function accionConfirmarSubidas(destino: Destino, id: string, claves: string[], extra: { tipo: string; anualidadId?: string | null }) {
  return seguro(async () => {
    const r = await confirmarSubidas(await exigirUsuario(), destino, id, claves, extra);
    // La IA lee el lote después de responder (puede tardar un par de minutos); el cron lo reintenta si se corta.
    if (destino === 'importacion') after(() => procesarImportacion(id).catch((e) => console.error('[seguros/importacion]', (e as Error).message)));
    else revalidatePath(destino === 'poliza' ? `/admin/seguros/polizas/${id}` : `/admin/seguros/siniestros/${id}`);
    return r.map((x) => ({ nombre: x.nombre, duplicadoDe: x.duplicadoDe }));
  });
}

/** Abre una importación (lote de documentos que leerá la IA), opcionalmente para una póliza o un titular. */
export async function accionCrearImportacion(opciones: { polizaId?: string | null; titularId?: string | null }) {
  return seguro(async () => crearImportacion(await exigirUsuario(), opciones));
}

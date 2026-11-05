'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { formulario } from '@/seguros/lib/validacion';
import { Invalido } from '@/seguros/lib/errores';
import {
  actualizarSeguimiento, actualizarSiniestro, anadirEvento, crearSiniestro, elegirAnualidad, eliminarArchivoSiniestro, fijarPolizas,
  guardarBorrador, obtenerSiniestro, plantillaComunicacion, polizasDelSiniestro, subirArchivoSiniestro,
} from '@/seguros/lib/datos/siniestros';
import { after } from 'next/server';
import { procesarColaIA, solicitarAnalisis } from '@/seguros/lib/ia/siniestro';

const ruta = (id: string, pestana?: string) => `/admin/seguros/siniestros/${id}${pestana ? `?pestana=${pestana}` : ''}`;

export async function accionCrearSiniestro(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const id = await crearSiniestro(await exigirUsuario(), formulario(fd), String(fd.get('poliza') ?? '') || null);
    redirect(ruta(id));
  });
}

export async function accionEditarSiniestro(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await actualizarSiniestro(await exigirUsuario(), id, formulario(fd));
    redirect(ruta(id));
  });
}

export async function accionPolizas(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await fijarPolizas(await exigirUsuario(), id, fd.getAll('poliza').map(String));
    revalidatePath(ruta(id));
    return { ok: 'Pólizas actualizadas.', n: Date.now() };
  });
}

export async function accionAnualidad(id: string, polizaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await elegirAnualidad(await exigirUsuario(), id, polizaId, String(fd.get('anualidad_id') ?? '') || null);
    revalidatePath(ruta(id));
    return { ok: 'Anualidad guardada.', n: Date.now() };
  });
}

export async function accionAnalizar(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await solicitarAnalisis(await exigirUsuario(), id);
    // Se procesa al momento, después de responder (sin esperar a la tarea programada, que queda de respaldo).
    after(() => procesarColaIA().catch((e) => console.error('[ia]', (e as Error).message)));
    redirect(ruta(id, 'analisis'));
  });
}

export async function accionPlantilla(id: string) {
  const u = await exigirUsuario();
  const s = await obtenerSiniestro(u, id);
  await guardarBorrador(u, id, plantillaComunicacion(s, await polizasDelSiniestro(u, id)), 'plantilla');
  redirect(ruta(id, 'borrador'));
}

export async function accionGuardarBorrador(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await guardarBorrador(await exigirUsuario(), id, String(fd.get('texto') ?? ''), 'manual');
    revalidatePath(ruta(id));
    return { ok: 'Versión guardada. Las anteriores se conservan.', n: Date.now() };
  });
}

export async function accionSubirArchivo(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const archivos = fd.getAll('archivo').filter((a): a is File => a instanceof File && a.size > 0);
    if (!archivos.length) throw new Invalido({ archivo: 'Elige al menos un archivo.' });
    if (archivos.length > 10) throw new Invalido({ archivo: 'Como máximo 10 archivos a la vez.' });
    for (const a of archivos) await subirArchivoSiniestro(u, id, { tipo: String(fd.get('tipo') ?? ''), nombre: a.name, datos: Buffer.from(await a.arrayBuffer()) });
    revalidatePath(ruta(id));
    return { ok: archivos.length === 1 ? 'Archivo guardado.' : `${archivos.length} archivos guardados.`, n: Date.now() };
  });
}

export async function accionEliminarArchivo(archivoId: string) {
  const id = await eliminarArchivoSiniestro(await exigirUsuario(), archivoId);
  redirect(ruta(id, 'archivos'));
}

export async function accionSeguimiento(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await actualizarSeguimiento(await exigirUsuario(), id, formulario(fd));
    revalidatePath(ruta(id));
    return { ok: 'Seguimiento actualizado.', n: Date.now() };
  });
}

export async function accionEvento(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await anadirEvento(await exigirUsuario(), id, formulario(fd));
    revalidatePath(ruta(id));
    return { ok: 'Anotado.', n: Date.now() };
  });
}

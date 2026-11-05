'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { formulario } from '@/seguros/lib/validacion';
import { anadirNota, borradorSolicitud, cambiarEstado, crearOferta, marcarTarea, registrarDecision } from '@/seguros/lib/datos/renovaciones';
import { subirDocumento } from '@/seguros/lib/datos/documentos';
import { q1 } from '@/seguros/lib/db';

const ruta = (id: string) => `/admin/seguros/renovaciones/${id}`;

export async function accionEstado(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await cambiarEstado(await exigirUsuario(), id, String(fd.get('estado') ?? ''), String(fd.get('interlocutor') ?? '') || null);
    revalidatePath(ruta(id));
    return { ok: 'Guardado.', n: Date.now() };
  });
}

export async function accionNota(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await anadirNota(await exigirUsuario(), id, { tipo: String(fd.get('tipo') ?? 'nota'), texto: String(fd.get('texto') ?? ''), fecha_tarea: String(fd.get('fecha_tarea') ?? '') || null });
    revalidatePath(ruta(id));
    return { ok: 'Anotado.', n: Date.now() };
  });
}

export async function accionTarea(notaId: string, hecha: boolean) {
  const id = await marcarTarea(await exigirUsuario(), notaId, hecha);
  redirect(ruta(id));
}

export async function accionOferta(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    let documentoId: string | null = null;
    const archivo = fd.get('archivo');
    if (archivo instanceof File && archivo.size > 0) {
      const r = (await q1<{ poliza_id: string; anualidad_id: string }>('SELECT poliza_id, anualidad_id FROM renovaciones WHERE id = $1', [id]))!;
      documentoId = (await subirDocumento(u, { polizaId: r.poliza_id, anualidadId: r.anualidad_id, tipo: 'oferta', nombre: archivo.name, datos: Buffer.from(await archivo.arrayBuffer()) })).id;
    }
    await crearOferta(u, id, formulario(fd), documentoId);
    revalidatePath(ruta(id));
    return { ok: 'Oferta registrada.', n: Date.now() };
  });
}

export async function accionBorrador(id: string) {
  await borradorSolicitud(await exigirUsuario(), id);
  revalidatePath(ruta(id));
}

export async function accionDecision(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await registrarDecision(await exigirUsuario(), id, formulario(fd));
    redirect(ruta(id));
  });
}

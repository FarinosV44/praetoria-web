'use server';

import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { formulario } from '@/seguros/lib/validacion';
import {
  actualizarDocumento, anularModificacion, crearComunicacion, crearModificacion, crearNota, eliminarComunicacion, eliminarNota, vincularDocumentoSiniestro,
} from '@/seguros/lib/datos/expediente';
import { guardarRecibo } from '@/seguros/lib/datos/recibos';

const ficha = (id: string) => `/admin/seguros/polizas/${id}`;

export async function accionNota(polizaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await crearNota(await exigirUsuario(), polizaId, formulario(fd));
    revalidatePath(ficha(polizaId));
    return { ok: 'Nota guardada (queda como afirmación propia, sin acreditar).', n: Date.now() };
  });
}

export async function accionEliminarNota(polizaId: string, notaId: string) {
  await eliminarNota(await exigirUsuario(), polizaId, notaId);
  revalidatePath(ficha(polizaId));
}

export async function accionComunicacion(polizaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await crearComunicacion(await exigirUsuario(), polizaId, formulario(fd));
    revalidatePath(ficha(polizaId));
    return { ok: 'Comunicación registrada.', n: Date.now() };
  });
}

export async function accionEliminarComunicacion(polizaId: string, id: string) {
  await eliminarComunicacion(await exigirUsuario(), polizaId, id);
  revalidatePath(ficha(polizaId));
}

export async function accionModificacion(polizaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await crearModificacion(await exigirUsuario(), polizaId, formulario(fd));
    revalidatePath(ficha(polizaId));
    return { ok: 'Modificación registrada.', n: Date.now() };
  });
}

export async function accionAnularModificacion(polizaId: string, id: string) {
  await anularModificacion(await exigirUsuario(), polizaId, id);
  revalidatePath(ficha(polizaId));
}

export async function accionDocumento(polizaId: string, documentoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const datos = formulario(fd);
    await actualizarDocumento(u, polizaId, documentoId, datos);
    await vincularDocumentoSiniestro(u, polizaId, documentoId, typeof datos.siniestro_id === 'string' && datos.siniestro_id ? datos.siniestro_id : null);
    revalidatePath(ficha(polizaId));
    return { ok: 'Documento actualizado.', n: Date.now() };
  });
}

export async function accionRecibo(polizaId: string, reciboId: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await guardarRecibo(await exigirUsuario(), polizaId, reciboId, formulario(fd));
    revalidatePath(ficha(polizaId));
    revalidatePath('/admin/seguros/pagos');
    return { ok: reciboId ? 'Recibo actualizado y marcado como revisado.' : 'Recibo añadido.', n: Date.now() };
  });
}

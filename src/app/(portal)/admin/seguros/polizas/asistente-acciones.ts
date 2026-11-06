'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { formulario } from '@/seguros/lib/validacion';
import { crearConversacion, exigirConversacion, preguntar, procesarMensaje, resumirAsunto } from '@/seguros/lib/ia/expediente';
import { cambiarEstadoAsunto, crearAsunto, descartarEscrito, guardarVersion, registrarEnvio, registrarRespuesta } from '@/seguros/lib/datos/escritos';

const asistente = (polizaId: string, c?: string | null) => `/admin/seguros/polizas/${polizaId}?pestana=asistente${c ? `&c=${c}` : ''}`;

/** Pregunta a la IA del expediente. La respuesta se elabora después de responder a la petición (la página se refresca). */
export async function accionPreguntar(polizaId: string, conversacionId: string | null, asuntoId: string | null, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const texto = String(fd.get('texto') ?? '');
    let conv = conversacionId;
    if (conv) await exigirConversacion(u, conv);
    else conv = await crearConversacion(u, polizaId, asuntoId, texto.trim().slice(0, 80) || 'Consulta');
    const mensaje = await preguntar(u, conv, texto);
    after(() => procesarMensaje(mensaje).catch((e) => console.error('[seguros/asistente]', (e as Error).message)));
    redirect(asistente(polizaId, conv));
  });
}

export async function accionResumir(polizaId: string, asuntoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await resumirAsunto(await exigirUsuario(), asuntoId);
    revalidatePath(`/admin/seguros/polizas/${polizaId}`);
    return { ok: 'Resumen actualizado con el expediente actual.', n: Date.now() };
  });
}

export async function accionCrearAsunto(polizaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await crearAsunto(await exigirUsuario(), polizaId, formulario(fd));
    revalidatePath(`/admin/seguros/polizas/${polizaId}`);
    return { ok: 'Asunto creado.', n: Date.now() };
  });
}

export async function accionEstadoAsunto(polizaId: string, asuntoId: string, estado: 'abierto' | 'cerrado') {
  await cambiarEstadoAsunto(await exigirUsuario(), polizaId, asuntoId, estado);
  revalidatePath(`/admin/seguros/polizas/${polizaId}`);
}

const escrito = (polizaId: string, id: string) => `/admin/seguros/polizas/${polizaId}/escritos/${id}`;

export async function accionVersion(polizaId: string, escritoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const v = await guardarVersion(await exigirUsuario(), escritoId, String(fd.get('texto') ?? ''));
    revalidatePath(escrito(polizaId, escritoId));
    return { ok: `Guardado como versión ${v}. Sigue siendo un borrador: no se ha enviado.`, n: Date.now() };
  });
}

export async function accionEnvio(polizaId: string, escritoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await registrarEnvio(await exigirUsuario(), escritoId, formulario(fd));
    revalidatePath(escrito(polizaId, escritoId));
    return { ok: 'Envío registrado en el expediente.', n: Date.now() };
  });
}

export async function accionRespuesta(polizaId: string, escritoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await registrarRespuesta(await exigirUsuario(), escritoId, formulario(fd));
    revalidatePath(escrito(polizaId, escritoId));
    return { ok: 'Respuesta registrada en el expediente.', n: Date.now() };
  });
}

export async function accionDescartar(polizaId: string, escritoId: string) {
  await descartarEscrito(await exigirUsuario(), escritoId);
  redirect(escrito(polizaId, escritoId));
}

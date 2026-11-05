'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { formulario } from '@/seguros/lib/validacion';
import { actualizarAnualidad, actualizarPoliza, anularAnualidad, archivarPoliza, crearAnualidad, crearPoliza } from '@/seguros/lib/datos/polizas';
import { cambiarDocumento, eliminarDocumento, subirDocumento } from '@/seguros/lib/datos/documentos';
import { Invalido } from '@/seguros/lib/errores';

export async function accionCrearPoliza(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const id = await crearPoliza(u, formulario(fd));
    redirect(`/admin/seguros/polizas/${id}?creada=1`);
  });
}

export async function accionEditarPoliza(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    await actualizarPoliza(u, id, formulario(fd));
    redirect(`/admin/seguros/polizas/${id}`);
  });
}

export async function accionArchivarPoliza(id: string, archivar: boolean) {
  const u = await exigirUsuario();
  await archivarPoliza(u, id, archivar);
  revalidatePath('/admin/seguros/');
  redirect(archivar ? '/admin/seguros/' : `/admin/seguros/polizas/${id}`);
}

export async function accionCrearAnualidad(polizaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    await crearAnualidad(u, polizaId, formulario(fd));
    redirect(`/admin/seguros/polizas/${polizaId}?pestana=anualidades`);
  });
}

export async function accionEditarAnualidad(anualidadId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const polizaId = await actualizarAnualidad(u, anualidadId, formulario(fd));
    redirect(`/admin/seguros/polizas/${polizaId}?pestana=anualidades`);
  });
}

export async function accionAnularAnualidad(anualidadId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const polizaId = await anularAnualidad(u, anualidadId);
    redirect(`/admin/seguros/polizas/${polizaId}?pestana=anualidades`);
  });
}

export async function accionSubirDocumento(polizaId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const archivos = fd.getAll('archivo').filter((a): a is File => a instanceof File && a.size > 0);
    if (archivos.length === 0) throw new Invalido({ archivo: 'Elige al menos un archivo.' });
    if (archivos.length > 10) throw new Invalido({ archivo: 'Sube como máximo 10 archivos a la vez.' });
    const avisos: string[] = [];
    for (const a of archivos) {
      const r = await subirDocumento(u, {
        polizaId, anualidadId: String(fd.get('anualidad_id') || '') || null, tipo: String(fd.get('tipo') ?? ''),
        nombre: a.name, datos: Buffer.from(await a.arrayBuffer()),
      });
      if (r.duplicadoDe) avisos.push(`«${a.name}» es idéntico a «${r.duplicadoDe}», ya subido antes. Se han guardado ambos; elimina el que sobre.`);
    }
    revalidatePath(`/admin/seguros/polizas/${polizaId}`);
    const ok = `${archivos.length === 1 ? 'Documento guardado' : `${archivos.length} documentos guardados`}.`;
    return { ok: [ok, ...avisos].join(' '), n: Date.now() };
  });
}

export async function accionCambiarDocumento(documentoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const polizaId = await cambiarDocumento(u, documentoId, { tipo: String(fd.get('tipo') ?? '') || undefined, anualidadId: String(fd.get('anualidad_id') ?? '') || null });
    revalidatePath(`/admin/seguros/polizas/${polizaId}`);
    return { ok: 'Cambios guardados.', n: Date.now() };
  });
}

export async function accionEliminarDocumento(documentoId: string) {
  const u = await exigirUsuario();
  const polizaId = await eliminarDocumento(u, documentoId);
  redirect(`/admin/seguros/polizas/${polizaId}?pestana=documentos`);
}

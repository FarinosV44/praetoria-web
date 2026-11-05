'use server';

import { redirect } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { formulario } from '@/seguros/lib/validacion';
import { actualizarTitular, archivarTitular, crearTitular } from '@/seguros/lib/datos/titulares';

export async function accionCrearTitular(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const id = await crearTitular(await exigirUsuario(), formulario(fd));
    redirect(fd.get('despues') === 'poliza' ? `/admin/seguros/polizas/nueva?titular=${id}` : `/admin/seguros/titulares?creado=${id}`);
  });
}

export async function accionEditarTitular(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await actualizarTitular(await exigirUsuario(), id, formulario(fd));
    redirect('/admin/seguros/titulares');
  });
}

export async function accionArchivarTitular(id: string, archivar: boolean) {
  await archivarTitular(await exigirUsuario(), id, archivar);
  redirect('/admin/seguros/titulares');
}

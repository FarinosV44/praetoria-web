'use server';

import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { formulario } from '@/seguros/lib/validacion';
import { actualizarRamo, crearRamo } from '@/seguros/lib/datos/polizas';

export async function accionCrearRamo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await crearRamo(await exigirUsuario(), formulario(fd));
    revalidatePath('/admin/seguros/ajustes/tipos');
    return { ok: 'Tipo de seguro añadido.', n: Date.now() };
  });
}

export async function accionEditarRamo(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await actualizarRamo(await exigirUsuario(), id, formulario(fd));
    revalidatePath('/admin/seguros/ajustes/tipos');
    return { ok: 'Guardado.', n: Date.now() };
  });
}

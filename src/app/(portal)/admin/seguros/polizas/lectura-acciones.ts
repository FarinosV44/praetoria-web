'use server';

import { redirect } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { after } from 'next/server';
import { aplicarExtraccion, descartarExtraccion, procesarColaExtraccion, solicitarExtraccion } from '@/seguros/lib/ia/extraccion';
import { abrirRenovacion } from '@/seguros/lib/datos/renovaciones';
import { atenderAviso } from '@/seguros/lib/avisos/motor';
import { q1 } from '@/seguros/lib/db';

export async function accionLeer(polizaId: string, documentoId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await solicitarExtraccion(await exigirUsuario(), documentoId);
    after(() => procesarColaExtraccion().catch((e) => console.error('[ia]', (e as Error).message)));
    redirect(`/admin/seguros/polizas/${polizaId}/documentos/${documentoId}`);
  });
}

export async function accionAplicar(polizaId: string, extraccionId: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const valores = Object.fromEntries([...fd.entries()].filter(([k, v]) => k.startsWith('v_') && typeof v === 'string').map(([k, v]) => [k.slice(2), String(v)]));
    await aplicarExtraccion(await exigirUsuario(), extraccionId, String(fd.get('anualidad_id') ?? ''), valores, fd.getAll('campo').map(String), fd.getAll('lista').map(String));
    redirect(`/admin/seguros/polizas/${polizaId}?pestana=condiciones&aplicado=1`);
  });
}

export async function accionDescartar(polizaId: string, extraccionId: string) {
  await descartarExtraccion(await exigirUsuario(), extraccionId);
  redirect(`/admin/seguros/polizas/${polizaId}?pestana=documentos`);
}

/** Abre el expediente de renovación de la anualidad; si viene de un aviso, lo marca «en negociación». */
export async function accionRenegociar(anualidadId: string, avisoId?: string) {
  const u = await exigirUsuario();
  const id = await abrirRenovacion(u, anualidadId);
  if (avisoId) {
    const a = await q1<{ anualidad_id: string }>('SELECT anualidad_id FROM avisos WHERE id = $1', [avisoId]);
    if (a?.anualidad_id === anualidadId) await atenderAviso(u.id, avisoId, 'negociar', null);
  }
  redirect(`/admin/seguros/renovaciones/${id}`);
}

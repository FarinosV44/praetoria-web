'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { manejar, type EstadoForm } from '@/seguros/lib/acciones';
import { atender, guardarAjustesAvisos, guardarPreferencias } from '@/seguros/lib/datos/avisos';
import { sincronizarDispositivos } from '@/seguros/lib/avisos/dispositivos';
import { dispositivosPropiosPortal } from '@/seguros/lib/portal';
import { requerirGlobal } from '@/portal/lib/sesion';
import { q } from '@/seguros/lib/db';
import { Invalido } from '@/seguros/lib/errores';
import { enviarPush, pushConfigurado } from '@/seguros/lib/avisos/push';
import { formulario } from '@/seguros/lib/validacion';
import { registrarIntento, superaLimite } from '@/seguros/lib/auth/limites';

export async function accionAtender(id: string, _: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const accion = String(fd.get('accion') ?? '');
    const a = await atender(u, id, accion, String(fd.get('hasta') ?? '') || null);
    revalidatePath('/admin/seguros/avisos');
    if (accion === 'negociar') redirect(`/admin/seguros/polizas/${a.poliza_id}`);
    return { ok: accion === 'posponer' ? 'Aviso pospuesto. Volverá en la fecha elegida.' : 'Aviso marcado como atendido.', n: Date.now() };
  });
}

/**
 * Incorpora los dispositivos de la app de Praetoria de esta persona y les envía una notificación de prueba
 * (no pasa por la cola de avisos). El resultado es el que devuelve el servicio de push, sin simular nada.
 */
export async function accionProbarDispositivos(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    const u = await exigirUsuario();
    const portal = await requerirGlobal();
    if (!pushConfigurado()) throw new Invalido({ _: 'El servidor no tiene configuradas las claves de notificaciones (VAPID).' });
    if (await superaLimite(`push-prueba:${u.id}`, 10, 60)) throw new Invalido({ _: 'Demasiadas pruebas seguidas. Espera unos minutos.' });
    await registrarIntento(`push-prueba:${u.id}`, false);
    await sincronizarDispositivos(u.id, await dispositivosPropiosPortal(portal.id));
    const subs = await q<{ id: string; endpoint: string; p256dh: string; auth: string }>(
      'SELECT id, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = $1 AND revocada_en IS NULL', [u.id]);
    if (!subs.length) throw new Invalido({ _: 'No hay ningún dispositivo con los avisos activados. Actívalos primero en «App móvil».' });
    let ok = 0;
    const errores: string[] = [];
    for (const s of subs) {
      const r = await enviarPush(s, { title: 'Praetoria', body: 'Prueba de avisos de seguros.', url: '/admin/seguros/avisos/dispositivo/', tag: 'seguros-prueba' });
      if (r.ok) { ok++; await q('UPDATE push_suscripciones SET ultimo_exito = now(), ultimo_error = NULL WHERE id = $1', [s.id]); continue; }
      errores.push(r.error);
      await q(`UPDATE push_suscripciones SET ultimo_error = $2${r.caducada ? ', revocada_en = now()' : ''} WHERE id = $1`, [s.id, r.error]);
    }
    revalidatePath('/admin/seguros/avisos/dispositivo');
    if (!ok) throw new Invalido({ _: `El servicio de notificaciones no aceptó el envío: ${errores[0]}` });
    return { ok: `Prueba aceptada por el servicio de notificaciones en ${ok} de ${subs.length} ${subs.length === 1 ? 'dispositivo' : 'dispositivos'}. Debería aparecer en unos segundos.`, n: Date.now() };
  });
}

export async function accionPreferencias(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await guardarPreferencias(await exigirUsuario(), { correo_avisos: String(fd.get('correo_avisos') ?? ''), push_detallado: false });
    return { ok: 'Preferencias guardadas.', n: Date.now() };
  });
}

export async function accionAjustesAvisos(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  return manejar(fd, async () => {
    await guardarAjustesAvisos(await exigirUsuario(), formulario(fd));
    return { ok: 'Ajustes de avisos guardados. Se aplican en la próxima ejecución del planificador.', n: Date.now() };
  });
}

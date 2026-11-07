import { Cabecera } from '@/portal/components/despacho';
import type { Metadata } from 'next';
import { ActivarNotificaciones } from '@/portal/components/ActivarNotificaciones';
import { comoUsuario } from '@/portal/lib/db';
import { requerirPersonal } from '@/portal/lib/sesion';
import { fechaHora } from '@/portal/lib/agenda';

export const metadata: Metadata = { title: 'App y notificaciones' };

export default async function AppMovil() {
  const u = await requerirPersonal();
  const subs = await comoUsuario(u.id, async (tx) => (await tx.query(
    `select id, dispositivo, created_at, ultimo_envio_ok, revocada_at from portal.push_suscripciones where user_id = $1 order by created_at desc limit 20`, [u.id])).rows);
  const clave = process.env.VAPID_PUBLIC_KEY ?? '';
  return (
    <div className="grid gap-5 max-w-2xl">
      <Cabecera titulo="App y notificaciones" />
      <section className="card">
        <h2 className="subtitulo">1. Instala Praetoria en tu móvil</h2>
        <p className="mb-2"><strong>iPhone:</strong> abre esta dirección en Safari → botón Compartir → «Añadir a pantalla de inicio» → «Añadir». Abre Praetoria desde el icono.</p>
        <p><strong>Android:</strong> en Chrome, menú ⋮ → «Instalar aplicación» (o «Añadir a pantalla de inicio»).</p>
      </section>
      <section className="card">
        <h2 className="subtitulo">2. Activa los avisos en este dispositivo</h2>
        <p className="ayuda mb-3">En la pantalla de bloqueo solo verás «Tienes un aviso pendiente en Praetoria». El detalle se ve al entrar, con tu contraseña y doble factor.</p>
        {u.personal!.rol === 'administrador' ? <p className="ayuda mb-3">Estos mismos dispositivos reciben también los avisos de Seguros (vencimientos y plazos de oposición).</p> : null}
        {clave ? <ActivarNotificaciones clavePublica={clave} /> : <p className="error">Las notificaciones push no están configuradas en este entorno (faltan las claves VAPID).</p>}
      </section>
      <section className="card">
        <h2 className="subtitulo">Dispositivos registrados</h2>
        {subs.length === 0 ? <p className="ayuda">Ninguno todavía.</p> : (
          <ul className="grid gap-2 text-sm">
            {subs.map((s) => (
              <li key={s.id}>{(s.dispositivo || 'Dispositivo').slice(0, 80)} · alta {fechaHora(s.created_at)} ·{' '}
                {s.revocada_at ? <span className="chip chip-neutro">Desactivado</span> : <span className="chip chip-ok">Activo</span>}
                {s.ultimo_envio_ok ? <span className="ayuda"> · último aviso entregado {fechaHora(s.ultimo_envio_ok)}</span> : null}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

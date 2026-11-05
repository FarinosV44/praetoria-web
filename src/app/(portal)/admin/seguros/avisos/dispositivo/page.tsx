import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { preferencias } from '@/seguros/lib/datos/avisos';
import { dispositivosDe } from '@/seguros/lib/avisos/dispositivos';
import { pushConfigurado } from '@/seguros/lib/avisos/push';
import { correoConfigurado } from '@/seguros/lib/correo';
import { fechaMedia, hoyMadrid } from '@/seguros/lib/fechas';
import { Enviar, Formulario, Radios } from '@/seguros/components/formulario';
import { accionPreferencias, accionProbarDispositivos } from '../acciones';

export const metadata: Metadata = { title: 'Avisos en el móvil' };

export default async function Dispositivo() {
  const u = await exigirUsuario();
  const [p, dispositivos] = await Promise.all([preferencias(u), dispositivosDe(u.id)]);
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/avisos/">← Avisos</Link></div>
      <div className="encabezado"><div><h1>Avisos en el móvil</h1><p className="secundario pequeno">Los avisos de seguros llegan por la app de Praetoria, aunque esté cerrada.</p></div></div>
      <div className="dos-columnas">
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-app">
          <h2 id="t-app" style={{ marginBottom: 'var(--e-3)' }}>App de Praetoria</h2>
          {!pushConfigurado() && <div className="aviso aviso--atencion" style={{ marginBottom: 'var(--e-4)' }}>Las notificaciones push no están configuradas en el servidor (faltan <code>VAPID_PUBLIC_KEY</code> y <code>VAPID_PRIVATE_KEY</code>). Los avisos siguen apareciendo aquí y, si hay correo configurado, por correo.</div>}
          <ol className="pasos">
            <li>Instala Praetoria en el móvil y activa los avisos en <Link href="/admin/app/">App móvil</Link>.</li>
            <li>Vuelve aquí y pulsa «Comprobar y enviar prueba»: el gestor incorpora esos dispositivos y te manda una notificación.</li>
          </ol>
          <p className="pequeno secundario" style={{ margin: 'var(--e-3) 0' }}>En la pantalla de bloqueo solo aparece «Tienes un aviso pendiente en Praetoria». Al tocarla se abre el aviso de seguros, tras iniciar sesión con doble factor. Los dispositivos se vuelven a comprobar en cada ejecución de los avisos.</p>
          <Formulario accion={accionProbarDispositivos} aria="Comprobar dispositivos">
            <div><Enviar className="boton boton--oscuro" pendiente="Comprobando…">Comprobar y enviar prueba</Enviar></div>
          </Formulario>
        </section>
        <aside className="tarjeta tarjeta--pad" aria-labelledby="t-disp">
          <h2 id="t-disp" style={{ marginBottom: 'var(--e-3)' }}>Dispositivos que reciben avisos de seguros</h2>
          {dispositivos.length === 0 ? <p className="secundario pequeno">Ninguno todavía.</p> : (
            <ul className="lista-simple">
              {dispositivos.map((d) => (
                <li key={d.id}><div>
                  <p style={{ fontWeight: 700 }}>{(d.agente || 'Dispositivo').slice(0, 80)}</p>
                  <p className="linea-2">{d.origen === 'portal' ? 'App de Praetoria' : 'Registrado en el gestor'} · alta {fechaMedia(hoyMadrid(new Date(d.creada_en)))}
                    {d.ultimo_exito ? ` · último envío correcto ${fechaMedia(hoyMadrid(new Date(d.ultimo_exito)))}` : ''}</p>
                  {d.ultimo_error && <p className="linea-2" style={{ color: 'var(--color-peligro-texto)' }}>Último error: {d.ultimo_error}</p>}
                </div></li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      <section className="tarjeta tarjeta--pad bloque" aria-labelledby="t-pref" style={{ marginTop: 'var(--e-5)', maxWidth: 760 }}>
        <h2 id="t-pref" style={{ marginBottom: 'var(--e-4)' }}>Correo</h2>
        <Formulario accion={accionPreferencias} aria="Preferencias de avisos">
          <Radios nombre="correo_avisos" etiqueta="Correo electrónico" defecto={p.correo_avisos} opciones={[
            { valor: 'respaldo', texto: 'Solo si no llega la notificación' },
            { valor: 'siempre', texto: 'Siempre' },
            { valor: 'nunca', texto: 'Nunca' },
          ]} />
          {!correoConfigurado() && <p className="pequeno" style={{ color: 'var(--color-aviso-texto)' }}>El envío de correo aún no está configurado en el servidor.</p>}
          <div><Enviar>Guardar</Enviar></div>
        </Formulario>
      </section>
    </>
  );
}

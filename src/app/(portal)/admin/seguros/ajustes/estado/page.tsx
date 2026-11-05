import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirAdmin } from '@/seguros/lib/auth/servidor';
import { estadoSistema } from '@/seguros/lib/datos/avisos';
import { leerAjustes } from '@/seguros/lib/avisos/motor';
import { Campo, Enviar, Formulario } from '@/seguros/components/formulario';
import { accionAjustesAvisos } from '../../avisos/acciones';

export const metadata: Metadata = { title: 'Estado y avisos' };

function Indicador({ ok, texto, detalle }: { ok: boolean | 'aviso'; texto: string; detalle?: string }) {
  return (
    <div>
      <dt>{texto}</dt>
      <dd><span className={`estado estado--${ok === true ? 'vigente' : ok === 'aviso' ? 'proxima' : 'vencida'}`}>{detalle}</span></dd>
    </div>
  );
}

export default async function Estado() {
  await exigirAdmin();
  const [e, a] = await Promise.all([estadoSistema(), leerAjustes()]);
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/ajustes">Ajustes</Link><span aria-hidden="true">/</span><span>Estado y avisos</span></div>
      <div className="encabezado"><div><h1>Estado del servicio</h1><p className="secundario pequeno">Solo se muestra «activo» cuando hay una ejecución real reciente o una credencial configurada.</p></div></div>
      <div className="dos-columnas">
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-ind">
          <h2 id="t-ind" style={{ marginBottom: 'var(--e-3)' }}>Indicadores</h2>
          <dl className="diagnostico">
            <Indicador texto="Planificador de avisos" ok={e.planificador === 'activo' ? true : 'aviso'}
              detalle={e.planificador === 'activo' ? `Activo · hace ${e.minutosDesdeUltima} min` : e.planificador === 'nunca' ? 'Nunca se ha ejecutado' : `Detenido · última correcta hace ${e.minutosDesdeUltima} min`} />
            {e.ultima && e.ultima.ok === false && <Indicador texto="Última ejecución" ok={false} detalle={`Error: ${e.ultima.error}`} />}
            <Indicador texto="Notificaciones push (VAPID)" ok={e.push ? true : 'aviso'} detalle={e.push ? `Configuradas · ${e.suscripciones} dispositivos` : 'Sin configurar'} />
            <Indicador texto="Correo (SMTP)" ok={e.correo ? true : 'aviso'} detalle={e.correo ? 'Configurado' : 'Sin configurar'} />
            <Indicador texto="Envíos pendientes" ok={e.pendientes < 20 ? true : 'aviso'} detalle={String(e.pendientes)} />
            {e.fallidos.map((f) => <Indicador key={f.canal} texto={`Fallidos (30 días) · ${f.canal}`} ok={false} detalle={`${f.n} · ${f.error ?? ''}`.slice(0, 90)} />)}
            <Indicador texto="Asistente con IA" ok={e.ia ? true : 'aviso'} detalle={e.ia ? 'Clave configurada' : 'Sin configurar'} />
            <Indicador texto="Copias de seguridad" ok={!e.copia ? 'aviso' : e.copiaReciente ? true : e.copia.ok ? 'aviso' : false}
              detalle={!e.copiasConfiguradas && !e.copia ? 'Sin configurar (COPIAS_CLAVE)' : !e.copia ? 'Configuradas · aún no hay ninguna' : e.copia.ok ? `Última: ${new Date(e.copia.fin).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}` : `Fallida: ${e.copia.error}`} />
          </dl>
          {e.planificador !== 'activo' && <p className="pequeno secundario" style={{ marginTop: 'var(--e-3)' }}>El planificador lo ejecuta el cron del portal (<code>/api/interno/avisos/</code>, cada minuto; los avisos de seguros cada 10 minutos). Ver docs/portal/SEGUROS.md.</p>}
        </section>
        <aside className="tarjeta tarjeta--pad" aria-labelledby="t-aj">
          <h2 id="t-aj" style={{ marginBottom: 'var(--e-3)' }}>Reglas de los avisos</h2>
          <p className="pequeno secundario" style={{ marginBottom: 'var(--e-4)' }}>El aviso principal es siempre un mes natural antes del vencimiento.</p>
          <Formulario accion={accionAjustesAvisos} aria="Reglas de los avisos">
            <Campo nombre="margen_oposicion_dias" etiqueta="Días de margen antes del plazo de oposición" tipo="number" defecto={String(a.margenOposicion)} inputMode="numeric" />
            <Campo nombre="recordatorio_dias" etiqueta="Recordatorio adicional (días antes del vencimiento; 0 = no)" tipo="number" defecto={String(a.recordatorio)} inputMode="numeric" />
            <Campo nombre="hora_envio" etiqueta="Hora de envío (Madrid)" tipo="number" defecto={String(a.horaEnvio)} inputMode="numeric" ayuda="No se envían avisos antes de esta hora." />
            <div><Enviar>Guardar reglas</Enviar></div>
          </Formulario>
        </aside>
      </div>
    </>
  );
}

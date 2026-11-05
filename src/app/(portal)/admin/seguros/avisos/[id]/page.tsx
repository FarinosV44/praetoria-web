import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { obtenerAviso } from '@/seguros/lib/datos/avisos';
import { datosAviso, importeTexto } from '@/seguros/lib/avisos/contenido';
import { NoEncontrado } from '@/seguros/lib/errores';
import { fechaLarga, hoyMadrid, sumarDias } from '@/seguros/lib/fechas';
import { Campo, Enviar, Formulario } from '@/seguros/components/formulario';
import { IconoRamo } from '@/seguros/components/iconos';
import { Canales, tituloLista } from '../componentes';
import { accionAtender } from '../acciones';
import { accionRenegociar } from '../../polizas/lectura-acciones';
import { q1 } from '@/seguros/lib/db';

export const metadata: Metadata = { title: 'Aviso' };

export default async function Aviso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const a = await obtenerAviso(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const d = (await datosAviso(id))!;
  const anualidad = (await q1<{ anualidad_id: string }>('SELECT anualidad_id FROM avisos WHERE id = $1', [id]))!.anualidad_id;
  const abierto = ['emitido', 'pospuesto', 'programado'].includes(a.estado);
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/avisos">← Avisos</Link></div>
      <div className="ficha-cab">
        <div className="titular-ramo" style={{ alignItems: 'flex-start' }}>
          <IconoRamo icono={a.ramo_icono} />
          <div>
            <span className="tpoliza__titular">{a.titular}</span>
            <h1>{a.poliza}</h1>
            <p className="secundario">{tituloLista(a)}</p>
            <Canales canales={a.canales} />
          </div>
        </div>
        <div className="acciones"><Link className="boton boton--oscuro" href={`/admin/seguros/polizas/${a.poliza_id}`}>Abrir póliza</Link></div>
      </div>
      <div className="dos-columnas">
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-datos">
          <h2 id="t-datos" style={{ marginBottom: 'var(--e-4)' }}>Datos para renegociar</h2>
          <dl className="lista-datos">
            <dt>Titular</dt><dd>{d.titular}</dd>
            <dt>Póliza</dt><dd>{d.poliza} · {d.ramo}</dd>
            <dt>Aseguradora</dt><dd>{d.aseguradora}</dd>
            <dt>Importe</dt><dd>{importeTexto(d)}</dd>
            <dt>Vencimiento</dt><dd>{d.fin ? fechaLarga(d.fin) : <span className="pendiente">Pendiente</span>}</dd>
            <dt>Límite de oposición</dt>
            <dd>{d.plazo_oposicion ? `${fechaLarga(d.plazo_oposicion)}${d.plazo_oposicion_confirmado ? ` · comprobado (${d.plazo_oposicion_fuente})` : ' · sin comprobar en el contrato'}` : <span className="pendiente">No registrado</span>}</dd>
          </dl>
        </section>
        <aside className="tarjeta tarjeta--pad" aria-labelledby="t-acc">
          <h2 id="t-acc" style={{ marginBottom: 'var(--e-4)' }}>¿Qué hacemos?</h2>
          {!abierto ? <p className="secundario">Aviso {a.estado === 'en_negociacion' ? 'en negociación' : a.estado === 'obsoleto' ? 'que ya no aplica (fechas cambiadas o póliza renovada)' : 'atendido'}.</p> : (
            <div style={{ display: 'grid', gap: 'var(--e-4)' }}>
              <form action={accionRenegociar.bind(null, anualidad, id)}>
                <button className="boton boton--principal" type="submit">Empezar a renegociar</button>
                <p className="pequeno secundario" style={{ marginTop: 6 }}>Abre el expediente de renovación y deja de repetir este aviso.</p>
              </form>
              <Formulario accion={accionAtender.bind(null, id)} className="form" aria="Posponer aviso">
                <input type="hidden" name="accion" value="posponer" />
                <Campo nombre="hasta" etiqueta="Recordármelo el" tipo="date" defecto={sumarDias(hoyMadrid(), 3)} ayuda="Posponer no cambia el vencimiento ni la fecha límite." />
                <Enviar className="boton">Posponer</Enviar>
              </Formulario>
              <Formulario accion={accionAtender.bind(null, id)} className="" aria="Marcar como atendido">
                <input type="hidden" name="accion" value="reconocer" />
                <Enviar className="boton boton--sutil">Ya está gestionado</Enviar>
              </Formulario>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

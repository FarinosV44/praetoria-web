import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { after } from 'next/server';
import { ETIQUETAS, importacionDe, procesarImportacion, type ResultadoPoliza } from '@/seguros/lib/ia/importacion';
import { NoEncontrado } from '@/seguros/lib/errores';
import { Refrescar } from '@/seguros/components/copiar';

export const metadata: Metadata = { title: 'Lectura de pólizas' };
// La lectura puede seguir en curso: la página se refresca sola hasta que termina.
export const maxDuration = 300;

const LISTAS: Record<string, string> = { garantias: 'garantías', exclusiones: 'exclusiones', franquicias: 'franquicias', capitales: 'capitales' };
const etiqueta = (k: string) => ETIQUETAS[k] ?? LISTAS[k] ?? k;

function Poliza({ p }: { p: ResultadoPoliza }) {
  return (
    <section className="tarjeta tarjeta--pad bloque" style={{ marginTop: 'var(--e-4)' }}>
      <div className="encabezado" style={{ marginBottom: 'var(--e-2)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--texto-l)' }}>{p.poliza_id ? <Link href={`/admin/seguros/polizas/${p.poliza_id}/`}>{p.nombre}</Link> : p.nombre}</h2>
          <p className="secundario pequeno">
            {p.accion === 'creada' ? 'Póliza nueva' : p.accion === 'actualizada' ? 'Póliza que ya existía: se ha completado' : 'No se ha guardado'}
            {p.titular ? ` · ${p.titular}${p.titular_creado ? ' (titular nuevo)' : ''}` : ''}
            {p.anualidad === 'creada' ? ' · anualidad nueva' : p.anualidad === 'completada' ? ' · anualidad completada' : ''}
          </p>
        </div>
        {p.poliza_id && <Link className="boton boton--peq" href={`/admin/seguros/polizas/${p.poliza_id}/`}>Ver póliza</Link>}
      </div>
      {p.motivo && <div className="aviso aviso--atencion" style={{ display: 'block' }}>{p.motivo}</div>}
      {p.guardados.length > 0 && <p className="pequeno"><strong>Guardado del documento:</strong> {p.guardados.map(etiqueta).join(', ')}.</p>}
      {p.contactos && p.contactos.length > 0 && (
        <div className="pequeno" style={{ marginTop: 'var(--e-2)' }}><strong>Encontrado en internet:</strong>
          <ul className="lista-puntos">{p.contactos.map((c) => <li key={c.campo}>{etiqueta(c.campo)}: {c.valor} · <a href={c.url} target="_blank" rel="noopener noreferrer">{c.titulo}</a></li>)}</ul>
        </div>
      )}
      {p.contactos_error && <p className="pequeno" style={{ color: 'var(--color-aviso-texto)' }}>No se ha podido buscar en internet: {p.contactos_error}</p>}
      {p.pendientes.length > 0 && <p className="pequeno secundario" style={{ marginTop: 'var(--e-2)' }}><strong>Pendiente (no consta o no se ha podido comprobar):</strong> {p.pendientes.map(etiqueta).join(', ')}.</p>}
      {p.discrepancias.length > 0 && (
        <div className="aviso aviso--atencion" style={{ display: 'block', marginTop: 'var(--e-2)' }}>
          <p><strong>No se ha cambiado lo que ya estaba guardado:</strong></p>
          <ul className="lista-puntos">{p.discrepancias.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      )}
      {p.documentos.length > 0 && <p className="pequeno secundario" style={{ marginTop: 'var(--e-2)' }}>Documentos adjuntados: {p.documentos.join(', ')}.</p>}
    </section>
  );
}

export default async function Resultado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const i = await importacionDe(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const enCurso = i.estado === 'pendiente' || i.estado === 'procesando';
  // Si una lectura quedó en cola (se cortó, o se reintenta tras un fallo), se retoma al abrir esta página sin
  // esperar al cron. procesarImportacion solo la toma si sigue «pendiente», así que no se duplica.
  if (i.estado === 'pendiente') after(() => procesarImportacion(id).catch((e) => console.error('[seguros/importacion]', (e as Error).message)));
  return (
    <>
      <div className="migas"><Link href="/admin/seguros/importar/">← Subir pólizas</Link></div>
      <div className="encabezado"><div>
        <h1>{i.estado === 'hecha' ? 'Pólizas guardadas' : i.estado === 'error' ? 'No se ha podido leer' : 'Leyendo los documentos…'}</h1>
        <p className="secundario pequeno">{i.archivos.map((a) => a.nombre).join(', ')}</p>
      </div></div>
      <Refrescar activo={enCurso} />
      {(i.estado === 'pendiente' || i.estado === 'procesando') && (
        <div className="aviso aviso--info" role="status" style={{ display: 'block' }}>La IA está leyendo los documentos y buscando en internet lo que falte. Suele tardar entre 30 segundos y 3 minutos; esta página se actualiza sola.</div>
      )}
      {i.estado === 'error' && <div className="aviso aviso--error" style={{ display: 'block' }}>{i.error}</div>}
      {i.resultado?.polizas.map((p, n) => <Poliza key={n} p={p} />)}
      {i.resultado && i.resultado.sin_asociar.length > 0 && <p className="pequeno secundario" style={{ marginTop: 'var(--e-3)' }}>Sin asociar a ninguna póliza (no se han guardado): {i.resultado.sin_asociar.join(', ')}.</p>}
      {i.avisos && i.avisos.length > 0 && (
        <section className="tarjeta tarjeta--pad bloque" style={{ marginTop: 'var(--e-4)' }}>
          <h2 style={{ fontSize: 'var(--texto-m)', marginBottom: 'var(--e-2)' }}>Observaciones de la lectura</h2>
          <ul className="lista-puntos pequeno">{i.avisos.map((a, n) => <li key={n}>{a}</li>)}</ul>
        </section>
      )}
    </>
  );
}

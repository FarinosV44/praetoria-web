import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/seguros/lib/auth/servidor';
import { listarAnualidades, obtenerPoliza } from '@/seguros/lib/datos/polizas';
import { listarDocumentos, TIPOS_DOCUMENTO } from '@/seguros/lib/datos/documentos';
import { CAMPOS, LISTAS, extraccionesDe, type Campo, type Lista } from '@/seguros/lib/ia/extraccion';
import { iaConfigurada } from '@/seguros/lib/ia/proveedor';
import { NoEncontrado } from '@/seguros/lib/errores';
import { fechaMedia } from '@/seguros/lib/fechas';
import { Enviar, Formulario } from '@/seguros/components/formulario';
import { Refrescar } from '@/seguros/components/copiar';
import { accionAplicar, accionDescartar, accionLeer } from '../../../lectura-acciones';

// El análisis o la lectura con IA se ejecutan tras responder y pueden tardar más de un minuto.
export const maxDuration = 300;

export const metadata: Metadata = { title: 'Revisar documento' };

const CONFIANZA = { alta: 'vigente', media: 'proxima', baja: 'vencida' } as const;

export default async function Revision({ params }: { params: Promise<{ id: string; doc: string }> }) {
  const { id, doc } = await params;
  const u = await exigirUsuario();
  const p = await obtenerPoliza(u, id).catch((e) => { if (e instanceof NoEncontrado) notFound(); throw e; });
  const d = (await listarDocumentos(u, id)).find((x) => x.id === doc);
  if (!d) notFound();
  const [extracciones, anualidades] = await Promise.all([extraccionesDe(u, doc), listarAnualidades(u, id)]);
  const e = extracciones[0];
  const actual = anualidades.find((a) => a.id === d.anualidad_id) ?? anualidades[0];
  const enCurso = e?.estado === 'pendiente' || e?.estado === 'procesando';
  const valorActual = (k: Campo): string | null => {
    const v = CAMPOS[k].destino === 'poliza' ? (p as unknown as Record<string, unknown>)[k] : (actual as unknown as Record<string, unknown> | undefined)?.[k];
    return v === null || v === undefined ? null : typeof v === 'boolean' ? (v ? 'si' : 'no') : String(v);
  };

  return (
    <>
      <div className="migas"><Link href={`/admin/seguros/polizas/${id}?pestana=documentos`}>← {p.nombre}</Link></div>
      <div className="encabezado">
        <div>
          <h1>{d.nombre_original}</h1>
          <p className="secundario pequeno">{TIPOS_DOCUMENTO[d.tipo]} · {d.paginas ? `${d.paginas} págs.` : 'imagen'}{d.paginas && !extracciones.length ? '' : ''}</p>
        </div>
        {iaConfigurada() && !enCurso && (
          <Formulario accion={accionLeer.bind(null, id, doc)} className="" aria="Leer datos">
            <Enviar className="boton boton--oscuro" pendiente="Enviando…">{extracciones.length ? 'Volver a leer' : 'Leer datos del documento'}</Enviar>
          </Formulario>
        )}
      </div>
      <div className="revision">
        <iframe src={`/api/seguros/documentos/${doc}`} title={`Original: ${d.nombre_original}`} />
        <section className="tarjeta tarjeta--pad" aria-labelledby="t-prop">
          <h2 id="t-prop" style={{ marginBottom: 'var(--e-3)' }}>Datos propuestos</h2>
          {!iaConfigurada() && !e && (
            <div className="aviso aviso--atencion" style={{ display: 'block' }}>
              <p><strong>Lectura automática sin configurar.</strong> Introduce los datos a mano mirando el documento.</p>
              <p className="pequeno" style={{ marginTop: 6 }}>Requiere <code>ANTHROPIC_API_KEY</code> en el servidor.</p>
              {actual && <Link className="boton boton--peq" style={{ marginTop: 'var(--e-3)' }} href={`/admin/seguros/polizas/${id}/anualidades/${actual.id}`}>Introducir a mano</Link>}
            </div>
          )}
          <Refrescar activo={enCurso} />
          {e?.estado === 'error' && (
            <div className="aviso aviso--error" style={{ display: 'block' }}>
              <p>No se ha podido leer: {e.error}</p>
              {actual && <Link className="boton boton--peq" style={{ marginTop: 'var(--e-3)' }} href={`/admin/seguros/polizas/${id}/anualidades/${actual.id}`}>Introducir a mano</Link>}
            </div>
          )}
          {e?.estado === 'confirmado' && <div className="aviso aviso--ok">Datos confirmados el {fechaMedia(new Date(e.aplicada_en!).toISOString().slice(0, 10))}. Una nueva lectura no los cambia: solo propone.</div>}
          {e?.estado === 'revision' && e.campos && (
            <Formulario accion={accionAplicar.bind(null, id, e.id)} aria="Confirmar datos">
              {e.avisos && e.avisos.length > 0 && <div className="aviso aviso--atencion" style={{ display: 'block' }}><ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{e.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
              <p className="pequeno secundario">Marca solo lo que hayas comprobado en el documento. Puedes corregir cada valor antes de confirmarlo. Nada se aplica sin tu confirmación.</p>
              <div className="campo">
                <label htmlFor="anualidad_id">Anualidad a la que corresponde</label>
                <select id="anualidad_id" name="anualidad_id" defaultValue={actual?.id}>
                  {anualidades.map((a) => <option key={a.id} value={a.id}>{fechaMedia(a.inicio) || '¿?'} – {fechaMedia(a.fin) || '¿?'}</option>)}
                </select>
              </div>
              {(Object.keys(CAMPOS) as Campo[]).filter((k) => e.campos![k]).map((k) => {
                const prop = e.campos![k]!;
                const ya = valorActual(k);
                const distinto = ya !== null && ya !== prop.valor;
                return (
                  <div key={k} className="fila-campo">
                    <input type="checkbox" name="campo" value={k} id={`c-${k}`} defaultChecked={!ya && prop.confianza !== 'baja'} aria-label={`Confirmar ${CAMPOS[k].texto}`} />
                    <div className="campo">
                      <label htmlFor={`v-${k}`}>{CAMPOS[k].texto}</label>
                      <input id={`v-${k}`} name={`v_${k}`} defaultValue={prop.valor ?? ''} type={['inicio', 'fin', 'plazo_oposicion'].includes(k) ? 'date' : 'text'} />
                      <span className="ayuda">
                        <span className={`estado estado--${CONFIANZA[prop.confianza]}`}>Confianza {prop.confianza}</span>{' '}
                        {prop.pagina && <a href={`/api/seguros/documentos/${doc}#page=${prop.pagina}`} target="_blank" rel="noopener">pág. {prop.pagina}</a>}
                        {prop.cita && <> · «{prop.cita}»</>}
                        {prop.verificada === true && ' · cita comprobada'}{prop.verificada === false && ' · la cita NO aparece en el documento'}
                      </span>
                      {distinto && <span className="error" style={{ color: 'var(--color-aviso-texto)' }}>Valor actual distinto: {ya}. Si no lo marcas, se mantiene el actual.</span>}
                    </div>
                  </div>
                );
              })}
              {(Object.keys(LISTAS) as Lista[]).filter((k) => e.campos!._listas?.[k]?.length).map((k) => (
                <div key={k} className="fila-campo">
                  <input type="checkbox" name="lista" value={k} defaultChecked aria-label={`Confirmar ${LISTAS[k]}`} />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 'var(--texto-s)' }}>{LISTAS[k]} ({e.campos!._listas![k]!.length})</p>
                    <ul className="lista-puntos pequeno">{e.campos!._listas![k]!.map((x, i) => <li key={i}>{x.texto}{x.pagina ? <> · <a href={`/api/seguros/documentos/${doc}#page=${x.pagina}`} target="_blank" rel="noopener">pág. {x.pagina}</a></> : ''}{x.verificada === false ? ' · cita no encontrada' : ''}</li>)}</ul>
                  </div>
                </div>
              ))}
              <div className="pie-form">
                <Enviar>Confirmar lo marcado</Enviar>
              </div>
            </Formulario>
          )}
          {e?.estado === 'revision' && <form action={accionDescartar.bind(null, id, e.id)} style={{ marginTop: 'var(--e-3)' }}><button className="boton boton--sutil boton--peq" type="submit">Descartar esta lectura</button></form>}
        </section>
      </div>
    </>
  );
}

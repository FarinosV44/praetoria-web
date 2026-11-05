import type { CitaVerificada, DocUsado, Falta, ResultadoAnalisis } from '@/seguros/lib/ia/siniestro';

const VALORACION = {
  cobertura_posible: { texto: 'Cobertura posible', clase: 'vigente' },
  aparentemente_excluido: { texto: 'Aparentemente excluido', clase: 'vencida' },
  informacion_insuficiente: { texto: 'Información insuficiente', clase: 'proxima' },
} as const;
const ESTADO_CITA: Record<CitaVerificada['estado'], { texto: string; clase: string }> = {
  verificada: { texto: 'cita comprobada en el documento', clase: 'vigente' },
  no_verificable: { texto: 'documento escaneado: comprueba la cita', clase: 'proxima' },
  no_encontrada: { texto: 'NO aparece en el documento', clase: 'vencida' },
  documento_invalido: { texto: 'referencia inexistente', clase: 'vencida' },
};

export function Valoracion({ v }: { v: keyof typeof VALORACION }) {
  const x = VALORACION[v] ?? VALORACION.informacion_insuficiente;
  return <span className={`estado estado--${x.clase}`}>{x.texto}</span>;
}

function Citas({ citas, docs }: { citas: CitaVerificada[]; docs: DocUsado[] }) {
  if (!citas.length) return <p className="pequeno" style={{ color: 'var(--color-peligro-texto)' }}>Sin cita: no lo tomes como cierto sin comprobarlo en la póliza.</p>;
  return (
    <ul className="citas">
      {citas.map((c, i) => {
        const d = docs.find((x) => x.documento_id === c.documento_id);
        const e = ESTADO_CITA[c.estado];
        return (
          <li key={i}>
            <blockquote>«{c.texto}»</blockquote>
            <p className="pequeno">
              {d ? <a href={`/api/seguros/documentos/${d.documento_id}#page=${c.pagina}`} target="_blank" rel="noopener">{d.nombre}, pág. {c.pagina}</a> : `${c.documento}, pág. ${c.pagina}`}
              {c.clausula ? ` · ${c.clausula}` : ''} · <span className={`estado estado--${e.clase}`}>{e.texto}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function Resultado({ r, docs }: { r: ResultadoAnalisis; docs: DocUsado[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--e-5)' }}>
      <div className="aviso aviso--info" style={{ display: 'block' }}>
        <p><strong>Esto es una ayuda para preparar la reclamación, no una garantía.</strong> La aseguradora decide; revisa cada cita en la póliza antes de enviar nada.</p>
      </div>
      {r.avisos_sistema.length > 0 && <div className="aviso aviso--atencion" style={{ display: 'block' }}><ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{r.avisos_sistema.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
      <section>
        <div style={{ display: 'flex', gap: 'var(--e-3)', alignItems: 'center', flexWrap: 'wrap' }}><h3>Valoración</h3><Valoracion v={r.valoracion_global} /></div>
        <p style={{ marginTop: 'var(--e-2)' }}>{r.motivo_global}</p>
        {r.poliza_aplicable && <p className="secundario pequeno" style={{ marginTop: 'var(--e-2)' }}>{r.poliza_aplicable}</p>}
      </section>
      {r.hechos_confirmados.length > 0 && <section><h3>Hechos que has facilitado</h3><ul className="lista-puntos">{r.hechos_confirmados.map((h, i) => <li key={i}>{h}</li>)}</ul></section>}
      {r.garantias.length > 0 && (
        <section><h3>Garantías que pueden aplicarse</h3>
          {r.garantias.map((g, i) => (
            <div key={i} className="bloque-cita">
              <p><strong>{g.titulo}</strong> <Valoracion v={g.valoracion as keyof typeof VALORACION} /></p>
              <p className="pequeno">{g.explicacion} <span className="secundario">(interpretación)</span></p>
              <Citas citas={g.citas} docs={docs} />
            </div>
          ))}
        </section>
      )}
      {r.limites_franquicias.length > 0 && <section><h3>Límites y franquicias</h3>{r.limites_franquicias.map((x, i) => <div key={i} className="bloque-cita"><p>{x.descripcion}</p><Citas citas={x.citas} docs={docs} /></div>)}</section>}
      {r.exclusiones_condiciones.length > 0 && <section><h3>Exclusiones y condiciones a tener en cuenta</h3>{r.exclusiones_condiciones.map((x, i) => <div key={i} className="bloque-cita"><p><strong>{x.descripcion}</strong></p><p className="pequeno">{x.explicacion} <span className="secundario">(interpretación)</span></p><Citas citas={x.citas} docs={docs} /></div>)}</section>}
      {r.plazo_comunicacion?.texto && <section><h3>Plazo para comunicarlo</h3><div className="bloque-cita"><p>{r.plazo_comunicacion.texto}</p><Citas citas={r.plazo_comunicacion.citas} docs={docs} /></div></section>}
      {(r.datos_que_faltan.length > 0 || r.documentos_que_faltan.length > 0) && (
        <section><h3>Lo que falta</h3>
          <ul className="lista-puntos">
            {r.datos_que_faltan.map((d, i) => <li key={i}><strong>{d.pregunta}</strong> <span className="secundario">— {d.motivo}</span></li>)}
            {r.documentos_que_faltan.map((d, i) => <li key={`d${i}`}>Documento: {d}</li>)}
          </ul>
          <p className="pequeno secundario">Añade la respuesta en «Editar hechos» o sube el documento y vuelve a analizar.</p>
        </section>
      )}
      {r.proximos_pasos.length > 0 && <section><h3>Próximos pasos</h3><ol className="lista-puntos">{r.proximos_pasos.map((p, i) => <li key={i}>{p}</li>)}</ol></section>}
      {r.advertencias.length > 0 && <section><h3>Advertencias del asistente</h3><ul className="lista-puntos">{r.advertencias.map((p, i) => <li key={i}>{p}</li>)}</ul></section>}
    </div>
  );
}

export function Preparacion({ faltan, docs }: { faltan: Falta[]; docs: DocUsado[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--e-3)' }}>
      {faltan.map((f, i) => <div key={i} className={`aviso aviso--${f.tipo === 'bloqueo' ? 'error' : 'atencion'}`}>{f.texto}</div>)}
      {docs.length > 0 && (
        <div>
          <p className="pequeno secundario">Documentos que se usarán:</p>
          <ul className="lista-puntos pequeno">{docs.map((d) => <li key={d.documento_id}><a href={`/api/seguros/documentos/${d.documento_id}`} target="_blank" rel="noopener">{d.nombre}</a> · {d.tipo.replace(/_/g, ' ')} · {d.poliza}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import { tamano } from '@/components/ui';
import { comoUsuario } from '@/lib/db';
import { requerirCliente } from '@/lib/sesion';
import { estadoDocumento, fecha } from '@/lib/textos';

export const metadata: Metadata = { title: 'Mis documentos' };

export default async function Documentos() {
  const u = await requerirCliente();
  const docs = await comoUsuario(u.id, async (tx) => (await tx.query(`
    select d.id, d.nombre_original, d.version, d.tamano, d.subido_at, d.estado, d.motivo, r.titulo, s.referencia
    from portal.documentos d join portal.requisitos r on r.id = d.requisito_id join portal.solicitudes s on s.id = d.solicitud_id
    order by d.subido_at desc limit 500`)).rows);
  return (
    <div className="grid gap-5">
      <h1 className="titulo">Mis documentos</h1>
      <p className="ayuda">Todos los archivos enviados, también las versiones anteriores. Nunca se borran sin avisarte.</p>
      {docs.length === 0 ? <p className="card">Todavía no has enviado documentos.</p> : (
        <ul className="lista">
          {docs.map((d) => (
            <li key={d.id} className="card">
              <div className="fila"><a href={`/api/documentos/${d.id}/`} className="font-semibold">{d.nombre_original}</a><span className="ayuda">{estadoDocumento[d.estado]}</span></div>
              <p className="ayuda">{d.titulo} · {d.referencia} · versión {d.version} · {tamano(Number(d.tamano))} · {fecha(d.subido_at)}</p>
              {d.motivo ? <p className="nota mt-2">{d.motivo}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

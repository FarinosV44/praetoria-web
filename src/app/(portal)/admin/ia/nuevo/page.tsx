import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera } from '@/portal/components/despacho';
import { redirect } from 'next/navigation';
import { Migas } from '@/portal/components/NavDespacho';
import { Redactor } from '@/portal/components/Redactor';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { env } from '@/portal/lib/env';
import { requerirPersonal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Nuevo escrito' };

const TIPOS = ['Demanda', 'Contestación a la demanda', 'Recurso de apelación', 'Recurso de reposición', 'Escrito de alegaciones', 'Ejecución de sentencia', 'Solicitud de medidas',
  'Requerimiento extrajudicial', 'Comunicación al cliente', 'Contrato', 'Informe jurídico', 'Reclamación administrativa'];

/** IA Jurídica → Nuevo escrito: elegir el expediente y qué se necesita; el resto lo obtiene del expediente y de la biblioteca. */
export default async function NuevoEscrito({ searchParams }: { searchParams: Promise<{ expediente?: string; tipo?: string }> }) {
  const u = await requerirPersonal();
  if (u.personal!.rol === 'facturacion') redirect('/admin/');
  const q = await searchParams;
  const asuntos = await comoUsuario(u.id, async (tx) => (await tx.query(`select s.id, coalesce(e.titulo, t.nombre, s.referencia) titulo, us.name cliente, coalesce(e.referencia, s.referencia) ref
    from portal.solicitudes s join identidad."user" us on us.id = s.cliente_id left join portal.expedientes e on e.solicitud_id = s.id left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
    left join lateral (select visto_at from portal.recientes r where r.user_id = $1 and r.solicitud_id = s.id) v on true
    where s.estado <> 'borrador' and portal.personal_escribe(s.id) order by v.visto_at desc nulls last, coalesce(e.abierto_at, s.enviada_at) desc nulls last limit 200`, [u.id])).rows as { id: string; titulo: string; cliente: string; ref: string }[]);
  const elegido = q.expediente && UUID.test(q.expediente) ? asuntos.find((a) => a.id === q.expediente) : undefined;
  const tipo = q.tipo && TIPOS.includes(q.tipo) ? q.tipo : '';
  return (
    <div className="grid gap-4 max-w-4xl" data-nuevo-escrito>
      <Cabecera titulo="Nuevo escrito" migas={[{ texto: 'Copiloto', href: '/admin/ia/' }, { texto: 'Nuevo escrito' }]} />
      {!env.iaClave ? <p className="aviso">El asistente de IA no está configurado en este servidor.</p> : !asuntos.length ? <p className="aviso">No tienes expedientes en los que puedas escribir.</p> : (
        <>
          <form className="card grid sm:grid-cols-[1fr_16rem_auto] gap-3 items-end">
            <label className="grid gap-1 text-sm font-semibold">Expediente
              <select name="expediente" defaultValue={elegido?.id ?? ''} required className="control font-normal">
                <option value="" disabled>Elige un expediente…</option>
                {asuntos.map((a) => <option key={a.id} value={a.id}>{a.cliente} · {a.titulo} ({a.ref})</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">Tipo de escrito
              <select name="tipo" defaultValue={tipo} className="control font-normal"><option value="">Lo indico yo</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <button className="btn btn-secundario" style={{ minHeight: 42 }}>Continuar</button>
          </form>
          {elegido ? (
            <>
              <p className="text-sm">Se usará lo que consta en <Link href={`/admin/expedientes/${elegido.id}/`} className="font-semibold">{elegido.titulo}</Link> y los modelos aprobados de la biblioteca. Si falta un dato, aparecerá como <mark className="chip chip-aviso text-xs">[PENDIENTE: …]</mark> para que lo completes.</p>
              <Redactor key={`${elegido.id}-${tipo}`} solicitud={elegido.id} hilo={null} escrito={null} enExpediente={false} inicial={tipo ? `${tipo}: ` : ''} destinoEscrito />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

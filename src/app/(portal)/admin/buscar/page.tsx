import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecera, Filtros, FiltroTexto, Panel, Vacio } from '@/portal/components/despacho';
import { comoUsuario } from '@/portal/lib/db';
import { buscar } from '@/portal/lib/expediente';
import { requerirPersonal } from '@/portal/lib/sesion';
import { ChipSolicitud } from '@/portal/components/ui';

export const metadata: Metadata = { title: 'Buscar' };

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requerirPersonal();
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);
  const r = q.length >= 2 ? await comoUsuario(u.id, (tx) => buscar(tx, q)) : null;
  return (
    <div className="grid gap-4">
      <Cabecera titulo="Buscar" entradilla="Expedientes, clientes y documentos que puedes ver." />
      <Filtros accion="/admin/buscar/" etiqueta="Buscar en el despacho" columnas={1} activos={q ? [{ texto: `Buscar: ${q}`, href: '/admin/buscar/' }] : []} limpiar="/admin/buscar/"
        basicos={<FiltroTexto nombre="q" etiqueta="Buscar" valor={q} ayuda="Cliente, NIF, correo, referencia, asunto o documento" />} />
      {r ? (
        <div className="rejilla-paneles">
          <Panel id="asuntos" titulo="Asuntos" n={r.asuntos.length} vacio="Ninguno.">
            {r.asuntos.map((a) => <li key={a.id}><Link href={`/admin/expedientes/${a.id}/`} className="font-semibold">{a.cliente} · {a.titulo}</Link> <ChipSolicitud estado={a.estado} /><span className="linea-2">{a.ref}</span></li>)}
          </Panel>
          <Panel id="clientes" titulo="Clientes" n={r.clientes.length} vacio={<>Ninguno. <Link href="/admin/clientes/nuevo/">Dar de alta un cliente</Link></>}>
            {r.clientes.map((c) => <li key={c.id}><Link href={`/admin/clientes/${c.id}/`} className="font-semibold">{c.name}{c.empresa ? ` · ${c.empresa}` : ''}</Link><span className="linea-2">{c.email}{c.nif ? ` · ${c.nif}` : ''} · {c.asuntos} asuntos</span></li>)}
          </Panel>
          <Panel id="documentos" titulo="Documentos" n={r.documentos.length} vacio="Ninguno.">
            {r.documentos.map((d) => <li key={d.id}><a href={`/api/documentos/${d.id}/?ver=1`} target="_blank" rel="noopener">{d.nombre_original}</a><span className="linea-2"><Link href={`/admin/expedientes/${d.solicitud_id}/`}>{d.cliente}</Link></span></li>)}
          </Panel>
        </div>
      ) : <Vacio titulo="Escribe al menos dos letras">Busca por cliente, NIF, referencia, asunto o documento.</Vacio>}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
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
    <div className="grid gap-5 max-w-3xl">
      <form action="/admin/buscar/" className="flex gap-2">
        <input name="q" type="search" defaultValue={q} autoFocus placeholder="Cliente, NIF, correo, referencia, asunto o documento" aria-label="Buscar" className="border rounded-md p-3 flex-1 min-w-0" />
        <button className="btn btn-primario">Buscar</button>
      </form>
      {r ? (
        <>
          <section className="card">
            <h2 className="subtitulo">Asuntos ({r.asuntos.length})</h2>
            {r.asuntos.length ? <ul className="grid gap-2">{r.asuntos.map((a) => (
              <li key={a.id} className="fila"><Link href={`/admin/expedientes/${a.id}/`} className="font-semibold">{a.cliente} · {a.titulo}</Link><span className="flex gap-2 items-center"><span className="ayuda text-sm">{a.ref}</span><ChipSolicitud estado={a.estado} /></span></li>
            ))}</ul> : <p className="ayuda">Ninguno.</p>}
          </section>
          <section className="card">
            <h2 className="subtitulo">Clientes ({r.clientes.length})</h2>
            {r.clientes.length ? <ul className="grid gap-2">{r.clientes.map((c) => (
              <li key={c.id} className="fila"><Link href={`/admin/clientes/${c.id}/`} className="font-semibold">{c.name}{c.empresa ? ` · ${c.empresa}` : ''}</Link><span className="ayuda text-sm">{c.email}{c.nif ? ` · ${c.nif}` : ''} · {c.asuntos} asuntos</span></li>
            ))}</ul> : <p className="ayuda">Ninguno. <Link href="/admin/clientes/nuevo/">Dar de alta un cliente</Link></p>}
          </section>
          <section className="card">
            <h2 className="subtitulo">Documentos ({r.documentos.length})</h2>
            {r.documentos.length ? <ul className="grid gap-2">{r.documentos.map((d) => (
              <li key={d.id} className="fila"><a href={`/api/documentos/${d.id}/?ver=1`} target="_blank" rel="noopener">{d.nombre_original}</a><Link href={`/admin/expedientes/${d.solicitud_id}/`} className="text-sm">{d.cliente} →</Link></li>
            ))}</ul> : <p className="ayuda">Ninguno.</p>}
          </section>
        </>
      ) : <p className="ayuda">Escribe al menos dos letras.</p>}
    </div>
  );
}

import type { Metadata } from 'next';
import { AjustesIA } from '@/portal/components/AjustesIA';
import { Reindexar } from '@/portal/components/ExpedienteIA';
import { Migas } from '@/portal/components/NavDespacho';
import { comoUsuario } from '@/portal/lib/db';
import { clavesIA, leerAjustes } from '@/portal/lib/ia-proveedores';
import { requerirGlobal } from '@/portal/lib/sesion';
import { fecha } from '@/portal/lib/textos';

export const metadata: Metadata = { title: 'Ajustes de IA' };

const usd = (v: unknown) => (v == null ? '—' : `${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);

export default async function AjustesPagina() {
  const u = await requerirGlobal();
  const d = await comoUsuario(u.id, async (tx) => ({
    a: await leerAjustes(tx),
    indice: (await tx.query(`select tipo, estado, count(*)::int n, coalesce(sum(fragmentos), 0)::int fragmentos from portal.ia_indexacion group by tipo, estado order by tipo, estado`)).rows as { tipo: string; estado: string; n: number; fragmentos: number }[],
    errores: (await tx.query(`select tipo, origen_id, solicitud_id, detalle, actualizado_at from portal.ia_indexacion where estado = 'error' order by actualizado_at desc limit 20`)).rows,
    gasto: (await tx.query(`select coalesce(sum(coste_usd) filter (where at >= date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'), 0) dia,
      coalesce(sum(coste_usd) filter (where at >= date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'), 0) mes from portal.ia_consumo`)).rows[0],
    modelos: (await tx.query(`select coalesce(modelo_usado, modelo_pedido) modelo, proveedor, count(*)::int llamadas, count(*) filter (where estado <> 'ok')::int fallos, count(*) filter (where fallback)::int fallbacks,
        coalesce(sum(tokens_entrada), 0)::bigint entrada, coalesce(sum(tokens_salida), 0)::bigint salida, sum(coste_usd) coste
      from portal.ia_consumo where at > now() - interval '30 days' group by 1, 2 order by coste desc nulls last limit 20`)).rows,
    auditoria: (await tx.query(`select a.at, a.accion, p.nombre_visible autor from portal.ia_auditoria a left join portal.personal p on p.user_id = a.user_id order by a.at desc limit 15`)).rows,
  }));
  const ESTADO: Record<string, string> = { ok: 'Procesados', pendiente: 'En cola', procesando: 'Procesando', sin_texto: 'Sin texto legible', error: 'Con error' };
  return (
    <div className="grid gap-4 max-w-4xl">
      <div><Migas items={[{ texto: 'Copiloto', href: '/admin/ia/' }, { texto: 'Ajustes de IA' }]} /><h1 className="titulo">Ajustes de IA</h1></div>
      <AjustesIA d={JSON.parse(JSON.stringify(d.a))} claves={clavesIA()} />
      <section className="card overflow-x-auto" data-estado-indice>
        <h2 className="subtitulo">Conocimiento indexado</h2>
        {d.indice.length ? (
          <table className="tabla"><thead><tr><th>Origen</th><th>Estado</th><th>Elementos</th><th>Fragmentos</th></tr></thead>
            <tbody>{d.indice.map((f) => <tr key={`${f.tipo}-${f.estado}`}><td>{f.tipo === 'documento' ? 'Documentos de expedientes' : 'Biblioteca'}</td><td>{ESTADO[f.estado] ?? f.estado}</td><td>{f.n}</td><td>{f.fragmentos}</td></tr>)}</tbody></table>
        ) : <p className="ayuda">Nada que procesar todavía.</p>}
        {d.errores.length ? <><h3 className="font-semibold mt-3">Con error</h3><ul className="text-sm grid gap-1">{d.errores.map((e) => <li key={e.origen_id} className="fila"><span>{e.tipo} · {e.detalle ?? 'error'} · {fecha(e.actualizado_at)}</span><Reindexar tipo={e.tipo} origen={e.origen_id} solicitud={e.solicitud_id ?? undefined} /></li>)}</ul></> : null}
      </section>
      <section className="card" data-consumo>
        <h2 className="subtitulo">Consumo</h2>
        <p className="text-sm mb-2">Hoy: <strong>{usd(d.gasto.dia)}</strong> · Este mes: <strong>{usd(d.gasto.mes)}</strong> <span className="ayuda">(estimación según las tarifas conocidas)</span></p>
        {d.modelos.length ? (
          <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Modelo realmente usado (30 días)</th><th>Llamadas</th><th>Fallos</th><th>Respaldos</th><th>Tokens entrada / salida</th><th>Coste</th></tr></thead>
            <tbody>{d.modelos.map((m) => <tr key={`${m.modelo}-${m.proveedor}`}><td>{m.modelo}</td><td>{m.llamadas}</td><td>{m.fallos}</td><td>{m.fallbacks}</td><td>{Number(m.entrada).toLocaleString('es-ES')} / {Number(m.salida).toLocaleString('es-ES')}</td><td>{usd(m.coste)}</td></tr>)}</tbody></table></div>
        ) : <p className="ayuda text-sm">Aún no hay consumo.</p>}
      </section>
      <section className="card">
        <h2 className="subtitulo">Registro de cambios</h2>
        {d.auditoria.length ? <ul className="text-sm grid gap-1">{d.auditoria.map((a, i) => <li key={i}>{fecha(a.at)} · {a.autor ?? 'Sistema'} · {a.accion.replace(/_/g, ' ')}</li>)}</ul> : <p className="ayuda text-sm">Sin cambios registrados.</p>}
      </section>
    </div>
  );
}

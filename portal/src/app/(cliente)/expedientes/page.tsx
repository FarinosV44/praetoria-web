import type { Metadata } from 'next';
import Link from 'next/link';
import { comoUsuario } from '@/lib/db';
import { misSolicitudes } from '@/lib/datos';
import { requerirCliente } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Mis expedientes' };

export default async function Expedientes() {
  const u = await requerirCliente();
  const exps = (await comoUsuario(u.id, (tx) => misSolicitudes(tx, u.id))).filter((s) => s.expediente_id);
  return (
    <div className="grid gap-5">
      <h1 className="titulo">Mis expedientes</h1>
      <p className="ayuda">Un expediente se abre cuando el despacho acepta tu encargo.</p>
      {exps.length === 0 ? <p className="card">Todavía no tienes expedientes abiertos.</p> : (
        <ul className="lista">
          {exps.map((s) => (
            <li key={s.id} className="card">
              <Link className="font-semibold" href={`/expedientes/${s.expediente_id}/`}>{s.expediente_titulo}</Link>
              <p className="ayuda">{s.expediente_ref} · Documentación aportada: {s.aportados} de {s.total}</p>
              {s.estado_visible ? <p className="nota mt-2">{s.estado_visible}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ChipSolicitud } from '@/components/ui';
import { comoUsuario } from '@/lib/db';
import { misSolicitudes } from '@/lib/datos';
import { requerirCliente } from '@/lib/sesion';
import { fecha } from '@/lib/textos';
import { nuevaSolicitud } from './acciones';

export const metadata: Metadata = { title: 'Mis solicitudes' };

export default async function Solicitudes({ searchParams }: { searchParams: Promise<{ guardado?: string; aviso?: string }> }) {
  const u = await requerirCliente();
  const q = await searchParams;
  const sols = (await comoUsuario(u.id, (tx) => misSolicitudes(tx, u.id))).filter((s) => !s.expediente_id);
  return (
    <div className="grid gap-5">
      <div className="fila">
        <h1 className="titulo">Mis solicitudes</h1>
        <form action={nuevaSolicitud}><button className="btn btn-primario">Nueva solicitud</button></form>
      </div>
      {q.guardado ? <p className="exito" role="status">Borrador guardado. Puedes continuar cuando quieras.</p> : null}
      {q.aviso === 'borradores' ? <p className="nota" role="status">Ya tienes varios borradores. Termina o continúa alguno antes de empezar otro.</p> : null}
      <p className="ayuda">Una solicitud es tu petición de ayuda. Cuando el despacho la acepta, pasa a «Mis expedientes».</p>
      {sols.length === 0 ? <p className="card">No tienes solicitudes abiertas.</p> : (
        <ul className="lista">
          {sols.map((s) => (
            <li key={s.id} className="card">
              <div className="fila mb-1">
                <Link className="font-semibold" href={s.estado === 'borrador' ? `/solicitudes/${s.id}/editar/?paso=${s.paso}` : `/solicitudes/${s.id}/`}>
                  {s.tipo_nombre ?? 'Solicitud sin terminar'}
                </Link>
                <ChipSolicitud estado={s.estado} />
              </div>
              <p className="ayuda">{s.referencia} · {s.enviada_at ? `Enviada el ${fecha(s.enviada_at)}` : `Creada el ${fecha(s.created_at)}`}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

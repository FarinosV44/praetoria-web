import type { Metadata } from 'next';
import Link from 'next/link';
import { comoUsuario } from '@/lib/db';
import { requerirPersonal } from '@/lib/sesion';
import { fecha } from '@/lib/textos';

export const metadata: Metadata = { title: 'Clientes' };

export default async function Clientes() {
  const u = await requerirPersonal();
  const filas = await comoUsuario(u.id, async (tx) => (await tx.query(`
    select us.id, us.name, us.email, us."emailVerified" verificado, us."createdAt" alta, pf.tipo, pf.empresa,
      (select count(*) from portal.solicitudes s where s.cliente_id = us.id and s.estado <> 'borrador')::int solicitudes,
      (select count(*) from portal.expedientes e where e.cliente_id = us.id)::int expedientes,
      (select s.id from portal.solicitudes s where s.cliente_id = us.id and s.estado <> 'borrador' order by s.enviada_at desc limit 1) ultima
    from identidad."user" us left join portal.perfiles pf on pf.user_id = us.id
    where not exists (select 1 from portal.personal p where p.user_id = us.id)
    order by us."createdAt" desc limit 300`)).rows);
  return (
    <div className="grid gap-5">
      <h1 className="titulo">Clientes registrados</h1>
      <p className="ayuda">Registrarse no supone una relación profesional: solo las solicitudes aceptadas abren expediente.</p>
      <div className="card overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Tipo</th><th>Alta</th><th>Solicitudes</th><th>Expedientes</th></tr></thead>
          <tbody>
            {filas.map((c) => (
              <tr key={c.id}>
                <td>{c.ultima ? <Link href={`/despacho/solicitudes/${c.ultima}/`}>{c.name}</Link> : c.name}</td>
                <td>{c.email}{c.verificado ? '' : <span className="chip chip-aviso ml-2">Sin verificar</span>}</td>
                <td>{c.tipo === 'empresa' ? `Empresa: ${c.empresa}` : c.tipo ? 'Particular' : <span className="ayuda">Perfil sin completar</span>}</td>
                <td className="text-sm">{fecha(c.alta)}</td>
                <td>{c.solicitudes}</td><td>{c.expedientes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

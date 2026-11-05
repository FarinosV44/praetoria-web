import type { Metadata } from 'next';
import Link from 'next/link';
import { AbrirExpediente } from '@/portal/components/AbrirExpediente';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { personalActivo } from '@/portal/lib/equipo';
import { requerirPersonal } from '@/portal/lib/sesion';

export const metadata: Metadata = { title: 'Abrir expediente' };

/** Abrir un expediente para un cliente que ya existe (los que esa persona puede ver). */
export default async function NuevoExpediente({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const u = await requerirPersonal();
  const { cliente } = await searchParams;
  const d = await comoUsuario(u.id, async (tx) => ({
    clientes: (await tx.query(`select us.id, us.name nombre, us.email, pf.empresa from identidad."user" us join portal.perfiles pf on pf.user_id = us.id
      where portal.personal_ve_cliente(us.id) and not exists (select 1 from portal.personal p where p.user_id = us.id) order by us.name limit 2000`)).rows,
    tipos: (await tx.query(`select id, nombre from portal.tipos_asunto where activo order by orden, nombre`)).rows,
    equipo: await personalActivo(tx),
  }));
  const preelegido = cliente && UUID.test(cliente) && d.clientes.some((c) => c.id === cliente) ? cliente : undefined;
  return (
    <div className="grid gap-4 max-w-3xl">
      <p><Link href="/admin/expedientes/">← Expedientes</Link></p>
      <h1 className="titulo">Abrir expediente</h1>
      <p className="ayuda">Para un cliente que ya está dado de alta. Si es nuevo, <Link href="/admin/clientes/nuevo/">dalo de alta</Link> y abre ahí el expediente.</p>
      {u.personal!.rol === 'lectura' || u.personal!.rol === 'facturacion' ? <p className="aviso">Tu rol no permite abrir expedientes.</p> : (
        <section className="card">
          <AbrirExpediente key={preelegido ?? 'todos'} clientes={d.clientes} cliente={preelegido} tipos={d.tipos} equipo={d.equipo} yo={u.id} />
        </section>
      )}
    </div>
  );
}

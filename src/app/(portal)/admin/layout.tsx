import Link from 'next/link';
import { Marca } from '@/portal/components/Marca';
import { Salir } from '@/portal/components/Salir';
import { AvisoEntorno } from '@/portal/components/ui';
import { requerirPersonal } from '@/portal/lib/sesion';
import { comoUsuario } from '@/portal/lib/db';

export const dynamic = 'force-dynamic';

export default async function DespachoLayout({ children }: { children: React.ReactNode }) {
  const u = await requerirPersonal({ sinMfa: true });
  const avisos = u.mfa || !process.env.STAFF_MFA_REQUIRED || process.env.STAFF_MFA_REQUIRED === 'false'
    ? await comoUsuario(u.id, async (tx) => (await tx.query('select count(*)::int n from portal.avisos_internos where user_id = $1 and leido_at is null', [u.id])).rows[0].n as number)
    : 0;
  return (
    <div className="min-h-dvh flex flex-col">
      <AvisoEntorno />
      <header style={{ background: '#fff', borderBottom: '1px solid var(--color-line)' }}>
        <div className="wrap fila py-3">
          <div className="flex items-center gap-3"><Marca destino="/admin/" /><span className="chip chip-neutro">Despacho</span></div>
          <div className="flex items-center gap-3"><span className="ayuda hidden sm:inline">{u.personal!.nombre}</span><Salir /></div>
        </div>
        <nav aria-label="Despacho" className="wrap flex gap-4 pb-3 text-sm font-semibold overflow-x-auto">
          <Link href="/admin/">Bandeja</Link>
          <Link href="/admin/clientes/">Clientes</Link>
          <Link href="/admin/agenda/">Agenda</Link>
          <Link href="/admin/avisos/">Avisos{avisos ? ` (${avisos})` : ''}</Link>
          {u.personal!.rol !== 'facturacion' ? <Link href="/admin/biblioteca/">Biblioteca</Link> : null}
          <Link href="/admin/plantillas/">Plantillas</Link>
          <Link href="/admin/app/">App móvil</Link>
          {u.personal!.rol === 'administrador' ? <Link href="/admin/seguros/">Seguros</Link> : null}
          {u.personal!.rol === 'administrador' ? <Link href="/admin/equipo/">Equipo</Link> : null}
          <Link href="/admin/seguridad/">Seguridad</Link>
        </nav>
      </header>
      <main id="contenido" className="wrap flex-1 py-6">{children}</main>
    </div>
  );
}

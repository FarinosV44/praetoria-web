import Link from 'next/link';
import { Marca } from '@/components/Marca';
import { Salir } from '@/components/Salir';
import { AvisoEntorno } from '@/components/ui';
import { requerirPersonal } from '@/lib/sesion';
import { comoUsuario } from '@/lib/db';

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
          <div className="flex items-center gap-3"><Marca destino="/despacho/" /><span className="chip chip-neutro">Despacho</span></div>
          <div className="flex items-center gap-3"><span className="ayuda hidden sm:inline">{u.personal!.nombre}</span><Salir /></div>
        </div>
        <nav aria-label="Despacho" className="wrap flex gap-4 pb-3 text-sm font-semibold overflow-x-auto">
          <Link href="/despacho/">Bandeja</Link>
          <Link href="/despacho/clientes/">Clientes</Link>
          <Link href="/despacho/agenda/">Agenda</Link>
          <Link href="/despacho/avisos/">Avisos{avisos ? ` (${avisos})` : ''}</Link>
          <Link href="/despacho/plantillas/">Plantillas</Link>
          <Link href="/despacho/app/">App móvil</Link>
          <Link href="/despacho/seguridad/">Seguridad</Link>
        </nav>
      </header>
      <main id="contenido" className="wrap flex-1 py-6">{children}</main>
    </div>
  );
}

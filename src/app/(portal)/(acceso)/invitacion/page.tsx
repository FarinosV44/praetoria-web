import type { Metadata } from 'next';
import Link from 'next/link';
import { createHash } from 'node:crypto';
import { poolApp } from '@/portal/lib/db';
import { FormInvitacion } from './FormInvitacion';
import { aceptarInvitacion } from './acciones';

export const metadata: Metadata = { title: 'Invitación' };
export const dynamic = 'force-dynamic';

export default async function Invitacion({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? '';
  const valido = /^[A-Za-z0-9_-]{43}$/.test(token)
    && !!(await poolApp().query('select portal.invitacion_valida($1) u', [createHash('sha256').update(token).digest('hex')])).rows[0]?.u;
  return (
    <div className="card">
      <h1 className="titulo mb-2">Acceso del despacho</h1>
      {valido ? (
        <>
          <p className="ayuda mb-5">Elige tu contraseña. Después entrarás y activarás el doble factor con una aplicación de autenticación.</p>
          <FormInvitacion token={token} accion={aceptarInvitacion} />
        </>
      ) : (
        <p className="error">Esta invitación no es válida, ya se usó o ha caducado. Pide una nueva al administrador. <Link href="/entrar/">Ir a entrar</Link></p>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetalleCliente } from '@/components/DetalleCliente';
import { comoUsuario } from '@/lib/db';
import { eventos, mensajes, requisitos, resumenSolicitud, UUID } from '@/lib/datos';
import { env } from '@/lib/env';
import { requerirCliente } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Expediente' };

export default async function Expediente({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirCliente();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const e = await tx.query('select solicitud_id from portal.expedientes where id = $1', [id]);
    if (!e.rowCount) return null;
    const sid = e.rows[0].solicitud_id as string;
    const s = await resumenSolicitud(tx, sid);
    return s ? { s, reqs: await requisitos(tx, sid), msgs: await mensajes(tx, sid), evs: await eventos(tx, sid) } : null;
  });
  if (!d) notFound();
  return <DetalleCliente {...d} maxMb={env.uploadMaxBytes / 1024 / 1024} />;
}

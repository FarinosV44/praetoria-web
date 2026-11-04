import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { DetalleCliente } from '@/components/DetalleCliente';
import { comoUsuario } from '@/lib/db';
import { eventos, mensajes, requisitos, resumenSolicitud, UUID } from '@/lib/datos';
import { env } from '@/lib/env';
import { requerirCliente } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Solicitud' };

export default async function Solicitud({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enviada?: string }> }) {
  const u = await requerirCliente();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = await comoUsuario(u.id, async (tx) => {
    const s = await resumenSolicitud(tx, id);
    if (!s) return null;
    return { s, reqs: await requisitos(tx, id), msgs: await mensajes(tx, id), evs: await eventos(tx, id) };
  });
  if (!d) notFound();
  if (d.s.expediente_id) redirect(`/expedientes/${d.s.expediente_id}/`);
  return <DetalleCliente {...d} maxMb={env.uploadMaxBytes / 1024 / 1024} enviada={!!(await searchParams).enviada} />;
}

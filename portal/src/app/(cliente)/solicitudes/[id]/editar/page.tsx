import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { comoUsuario } from '@/lib/db';
import { tiposAsunto, UUID, vistaPreviaPlantilla } from '@/lib/datos';
import { requerirCliente } from '@/lib/sesion';
import { Asistente } from './Asistente';

export const metadata: Metadata = { title: 'Solicitud' };

export default async function Editar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paso?: string }> }) {
  const u = await requerirCliente();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const datos = await comoUsuario(u.id, async (tx) => {
    const s = (await tx.query(`select s.*, t.nombre tipo_nombre from portal.solicitudes s left join portal.tipos_asunto t on t.id = s.tipo_asunto_id
      where s.id = $1 and s.cliente_id = $2`, [id, u.id])).rows[0];
    if (!s) return null;
    return { s, tipos: await tiposAsunto(tx), docs: s.tipo_asunto_id ? await vistaPreviaPlantilla(tx, s.tipo_asunto_id) : [] };
  });
  if (!datos) notFound();
  if (datos.s.estado !== 'borrador') redirect(`/solicitudes/${id}/`);
  const pedido = Number((await searchParams).paso ?? datos.s.paso);
  const paso = Math.min(Math.max(1, pedido), datos.s.paso);
  return (
    <Asistente paso={paso} maxPaso={datos.s.paso} tipos={datos.tipos} docs={datos.docs}
      s={{ id, referencia: datos.s.referencia, tipo_asunto_id: datos.s.tipo_asunto_id, tipo_nombre: datos.s.tipo_nombre, descripcion: datos.s.descripcion ?? '',
        fechas: datos.s.fechas ?? '', localidad: datos.s.localidad ?? '', contraparte: datos.s.contraparte ?? '', urgencia: datos.s.urgencia,
        contacto_preferido: datos.s.contacto_preferido }} />
  );
}

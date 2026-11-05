import { descarga } from '@/seguros/lib/auth/api';
import { paqueteSiniestro } from '@/seguros/lib/exportar';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return descarga(async (u) => ({ ...(await paqueteSiniestro(u, id)), tipo: 'application/zip' }));
}

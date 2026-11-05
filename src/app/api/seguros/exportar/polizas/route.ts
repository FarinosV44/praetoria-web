import { descarga } from '@/seguros/lib/auth/api';
import { exportarPolizas } from '@/seguros/lib/exportar';
import { hoyMadrid } from '@/seguros/lib/fechas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const titular = new URL(req.url).searchParams.get('titular');
  return descarga(async (u) => ({ nombre: `polizas-${hoyMadrid()}.csv`, tipo: 'text/csv; charset=utf-8', datos: await exportarPolizas(u, titular) }));
}

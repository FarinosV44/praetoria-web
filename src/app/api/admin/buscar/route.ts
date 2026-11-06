import { personalApi } from '@/portal/lib/api-personal';
import { comoUsuario } from '@/portal/lib/db';
import { buscar } from '@/portal/lib/expediente';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Buscador global de la paleta de comandos. Bajo RLS: solo devuelve lo que esa persona puede ver.
export async function GET(req: Request) {
  const s = await personalApi();
  if ('error' in s) return s.error;
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return Response.json({ asuntos: [], clientes: [], documentos: [], escritos: [], actuaciones: [] });
  const r = await comoUsuario(s.uid, async (tx) => {
    const base = await buscar(tx, q);
    const patron = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const escritos = (await tx.query(`select e.id, e.titulo, e.solicitud_id from portal.escritos e where e.titulo ilike $1 order by e.updated_at desc limit 8`, [patron])).rows;
    const actuaciones = (await tx.query(`select n.id, n.solicitud_id, left(n.texto, 110) texto from portal.notas_internas n
      where n.texto ilike $1 order by n.created_at desc limit 8`, [patron])).rows;
    return { ...base, escritos, actuaciones };
  });
  return Response.json(r, { headers: { 'cache-control': 'no-store' } });
}

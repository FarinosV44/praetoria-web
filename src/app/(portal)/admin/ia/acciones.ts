'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { comoUsuario } from '@/portal/lib/db';
import { UUID } from '@/portal/lib/datos';
import { MODELO_VALIDO, type Proveedor } from '@/portal/lib/ia-modelos';
import { modelosDisponibles } from '@/portal/lib/ia-proveedores';
import { requerirGlobal, requerirPersonal } from '@/portal/lib/sesion';

export type ResultadoAjustes = { ok?: string; error?: string; n?: number };
const modelo = z.string().trim().regex(MODELO_VALIDO);
const dinero = z.string().trim().regex(/^(\d{1,7}([.,]\d{1,2})?)?$/);
const aDinero = (v: string) => (v ? Number(v.replace(',', '.')) : null);

const Ajustes = z.object({
  proveedor: z.enum(['anthropic', 'openai']), modo: z.enum(['rapido', 'equilibrado', 'maximo']),
  a_rapido: modelo, a_equilibrado: modelo, a_maximo: modelo, o_rapido: modelo, o_equilibrado: modelo, o_maximo: modelo,
  fallback_modelo: z.union([modelo, z.literal('')]), diario: dinero, mensual: dinero, por_hora: z.coerce.number().int().min(1).max(1000),
  tarifa_entrada: dinero, tarifa_salida: dinero, tarifa_modelo: z.union([modelo, z.literal('')]), estilo: z.string().max(8000),
});

/** Guarda la configuración de IA. Solo superadministración; la base de datos lo vuelve a comprobar y lo audita. */
export async function guardarAjustes(_: ResultadoAjustes, f: FormData): Promise<ResultadoAjustes> {
  const u = await requerirGlobal();
  const d = Ajustes.safeParse(Object.fromEntries(f));
  if (!d.success) return { error: 'Revisa los datos: nombres de modelo, importes y límite por hora (1 a 1.000).' };
  const v = d.data;
  const si = (n: string) => f.get(n) === '1';
  if ((si('embeddings_biblioteca') || si('embeddings_expedientes')) && !si('openai_autorizado')) return { error: 'Los embeddings usan OpenAI: autoriza primero ese proveedor.' };
  if (v.proveedor === 'openai' && !si('openai_autorizado')) return { error: 'Para usar OpenAI como proveedor, autorízalo primero.' };
  const tarifas = v.tarifa_modelo && v.tarifa_entrada && v.tarifa_salida ? { [v.tarifa_modelo]: { entrada: aDinero(v.tarifa_entrada), salida: aDinero(v.tarifa_salida) } } : null;
  try {
    await comoUsuario(u.id, (tx) => tx.query(`update portal.ia_ajustes set proveedor = $1, modo = $2, modelos = $3, fallback_proveedor = $4, fallback_modelo = $5, openai_autorizado = $6,
        embeddings_biblioteca = $7, embeddings_expedientes = $8, ocr_activo = $9, revision_doble = $10, limite_diario_usd = $11, limite_mensual_usd = $12, limite_hora_usuario = $13,
        tarifas = case when $14::jsonb is null then tarifas else tarifas || $14::jsonb end, estilo_instrucciones = $15`, [
      v.proveedor, v.modo, JSON.stringify({ anthropic: { rapido: v.a_rapido, equilibrado: v.a_equilibrado, maximo: v.a_maximo }, openai: { rapido: v.o_rapido, equilibrado: v.o_equilibrado, maximo: v.o_maximo } }),
      v.fallback_modelo ? (v.fallback_modelo.startsWith('claude-') ? 'anthropic' : 'openai') : null, v.fallback_modelo || null, si('openai_autorizado'),
      si('embeddings_biblioteca'), si('embeddings_expedientes'), si('ocr_activo'), si('revision_doble'), aDinero(v.diario), aDinero(v.mensual), v.por_hora,
      tarifas ? JSON.stringify(tarifas) : null, v.estilo.trim(),
    ]));
  } catch { return { error: 'No se han podido guardar los ajustes.' }; }
  revalidatePath('/admin/ia', 'layout');
  return { ok: 'Ajustes guardados.', n: Date.now() };
}

/** Comprueba contra el proveedor qué modelos admite realmente la clave configurada. */
export async function comprobarModelos(p: Proveedor) {
  await requerirGlobal();
  return modelosDisponibles(p);
}

/** Reprocesar un documento o versión. La base de datos comprueba el permiso sobre ese asunto o modelo. */
export async function reindexar(_: ResultadoAjustes, f: FormData): Promise<ResultadoAjustes> {
  const u = await requerirPersonal();
  const tipo = String(f.get('tipo')), origen = String(f.get('origen')), sid = String(f.get('solicitud') ?? '');
  if (!UUID.test(origen) || !['documento', 'biblioteca'].includes(tipo)) return { error: 'No válido.' };
  try { await comoUsuario(u.id, (tx) => tx.query('select portal.ia_reindexar($1, $2)', [tipo, origen])); }
  catch { return { error: 'No tienes permiso para reprocesarlo.' }; }
  revalidatePath(UUID.test(sid) ? `/admin/expedientes/${sid}/` : '/admin/ia/ajustes/');
  return { ok: 'En cola.', n: Date.now() };
}

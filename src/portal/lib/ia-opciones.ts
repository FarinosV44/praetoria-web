import 'server-only';
import type { Tx } from './db';
import { clavesIA, leerAjustes } from './ia-proveedores';

/** Qué puede elegir esta persona al preguntar: solo proveedores con clave en el servidor y autorizados por el despacho. */
export async function opcionesIA(tx: Tx) {
  const a = await leerAjustes(tx);
  const c = clavesIA();
  const proveedores = [...(c.anthropic ? ['anthropic' as const] : []), ...(c.openai && a.openai_autorizado ? ['openai' as const] : [])];
  return { modo: a.modo, proveedores, proveedor: proveedores.includes(a.proveedor) ? a.proveedor : proveedores[0] ?? a.proveedor };
}

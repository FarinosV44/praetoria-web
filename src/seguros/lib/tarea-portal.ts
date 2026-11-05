import 'server-only';
import type { Pool } from 'pg';
import { segurosConfigurado } from './db';
import { tareaAvisos } from './avisos/tarea';
import { procesarColaIA } from './ia/siniestro';
import { procesarColaExtraccion } from './ia/extraccion';
import { sincronizarDispositivosPortal } from './portal';

/**
 * Parte del gestor de seguros en el ciclo de avisos del portal (cron de Hostinger, cada minuto):
 *  - cada 10 minutos: incorpora los dispositivos de la app de Praetoria y ejecuta planificar → emitir →
 *    enviar → limpiar (idempotente y con candado: repetirlo no duplica avisos);
 *  - cada minuto: lecturas y análisis de IA pendientes (respaldo de los que no terminaron al pedirlos).
 * Solo devuelve recuentos, nunca datos de pólizas.
 */
export async function cicloSeguros(poolPortal: Pool, ahora = new Date()) {
  if (!segurosConfigurado()) return { estado: 'sin configurar' as const };
  const r: Record<string, unknown> = {};
  if (ahora.getUTCMinutes() % 10 === 0) {
    r.dispositivos = await sincronizarDispositivosPortal(poolPortal);
    r.avisos = await tareaAvisos(ahora);
  }
  r.ia = (await procesarColaExtraccion()) + (await procesarColaIA());
  return r;
}

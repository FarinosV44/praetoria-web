// Comprueba la clave compartida con la tarea cron del alojamiento. Comparación en tiempo constante.
// Sin clave configurada, o con una clave corta, la ruta queda desactivada: nunca abierta por defecto.
import { createHash, timingSafeEqual } from 'node:crypto';

const resumen = (t: string) => createHash('sha256').update(t).digest();

export function claveCronValida(recibida: string | null | undefined, esperada: string | undefined): boolean {
  if (!esperada || esperada.length < 32 || !recibida) return false;
  return timingSafeEqual(resumen(recibida), resumen(esperada));
}

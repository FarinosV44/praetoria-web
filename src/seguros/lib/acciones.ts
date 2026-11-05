import 'server-only';
import { notFound, unstable_rethrow } from 'next/navigation';
import { Invalido, NoEncontrado, Prohibido } from './errores';

export type EstadoForm = {
  error?: string;
  ok?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
  n?: number;
} | null;

/** Ejecuta una acción de formulario y traduce los errores conocidos en mensajes para la persona. */
export async function manejar(fd: FormData | null, fn: () => Promise<EstadoForm | void>): Promise<EstadoForm> {
  const valores = fd ? Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === 'string' && !k.startsWith('$') && !/clave/.test(k))) as Record<string, string> : undefined;
  try {
    return (await fn()) ?? null;
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Invalido) return { error: e.campos._ ?? e.message, campos: e.campos, valores, n: Date.now() };
    if (e instanceof Prohibido) return { error: e.message, valores, n: Date.now() };
    if (e instanceof NoEncontrado) notFound();
    console.error('[accion]', (e as Error)?.message);
    return { error: 'No se ha podido completar la operación. Inténtalo de nuevo.', valores, n: Date.now() };
  }
}

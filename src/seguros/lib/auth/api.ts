import { usuarioApi } from './servidor';
import type { Usuario } from './sesiones';
import { NoEncontrado } from '../errores';

const CABECERAS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

/** Rutas de descarga: sin sesión de superadministración o sin permiso responden 404 (como si no existiera). */
export async function descarga(fn: (u: Usuario) => Promise<{ nombre: string; tipo: string; datos: Uint8Array | string }>) {
  const u = await usuarioApi();
  if (!u) return new Response('No encontrado', { status: 404, headers: CABECERAS });
  try {
    const r = await fn(u);
    return new Response(r.datos as BodyInit, {
      headers: { ...CABECERAS, 'Content-Type': r.tipo, 'Content-Disposition': `attachment; filename="${r.nombre.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(r.nombre)}` },
    });
  } catch (e) {
    if (e instanceof NoEncontrado) return new Response('No encontrado', { status: 404, headers: CABECERAS });
    throw e;
  }
}

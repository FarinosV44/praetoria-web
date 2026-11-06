import 'server-only';
import { comoUsuario } from './db';

// Ejecuciones de larga duración. El trabajo sigue aunque se cierre la pestaña: el texto parcial se guarda cada pocos segundos
// y la respuesta se puede recuperar al recargar. Si el servidor se reinicia, el latido deja de avanzar y la ejecución se
// muestra como interrumpida, sin perder lo ya guardado.

export type DatosEjecucion = { tipo: 'chat' | 'redaccion' | 'edicion' | 'analisis'; solicitud: string | null; hilo: string | null; modo?: string | null };
export type Control = { texto: (delta: string) => void; estado: (e: string) => void; modelo: (proveedor: string, modelo: string) => void };
type Viva = { uid: string; parcial: string; progreso: string | null; escuchas: Set<(ev: EventoEjecucion) => void>; fin: boolean };
export type EventoEjecucion = { t: 'texto'; d: string } | { t: 'estado'; d: string } | { t: 'fin'; estado: 'listo' | 'error'; error?: string; resultado?: unknown };

const g = globalThis as unknown as { __ejecuciones?: Map<string, Viva> };
const vivas = (g.__ejecuciones ??= new Map());
const LATIDO_MS = 2500;
const INTERRUPCION_MS = 180_000;

/** Crea la ejecución y lanza el trabajo sin esperar. Lo que devuelve `trabajo` se guarda como resultado. */
export async function lanzarEjecucion<T>(uid: string, d: DatosEjecucion, trabajo: (c: Control, id: string) => Promise<T>): Promise<string> {
  const id = (await comoUsuario(uid, (tx) => tx.query(`insert into portal.ia_ejecuciones (tipo, solicitud_id, hilo_id, modo, creado_por) values ($1, $2, $3, $4, $5) returning id`,
    [d.tipo, d.solicitud, d.hilo, d.modo ?? null, uid]))).rows[0].id as string;
  const v: Viva = { uid, parcial: '', progreso: null, escuchas: new Set(), fin: false };
  vivas.set(id, v);
  const emitir = (ev: EventoEjecucion) => { for (const f of v.escuchas) { try { f(ev); } catch { v.escuchas.delete(f); } } };
  let sucio = false;
  const guardar = async () => {
    if (!sucio) return;
    sucio = false;
    await comoUsuario(uid, (tx) => tx.query('update portal.ia_ejecuciones set parcial = $2, progreso = $3 where id = $1', [id, v.parcial.slice(0, 800000), v.progreso?.slice(0, 200) ?? null])).catch(() => { sucio = true; });
  };
  const latido = setInterval(() => { sucio = true; void guardar(); }, LATIDO_MS);
  latido.unref?.();
  const control: Control = {
    texto: (delta) => { v.parcial += delta; sucio = true; emitir({ t: 'texto', d: delta }); },
    estado: (e) => { v.progreso = e; sucio = true; emitir({ t: 'estado', d: e }); },
    modelo: (proveedor, modelo) => { void comoUsuario(uid, (tx) => tx.query('update portal.ia_ejecuciones set proveedor = $2, modelo = $3 where id = $1', [id, proveedor, modelo])).catch(() => {}); },
  };
  void (async () => {
    try {
      const resultado = await trabajo(control, id);
      clearInterval(latido);
      await comoUsuario(uid, (tx) => tx.query(`update portal.ia_ejecuciones set estado = 'listo', parcial = $2, resultado = $3, finalizado_at = now() where id = $1`, [id, v.parcial.slice(0, 800000), JSON.stringify(resultado ?? null)]));
      v.fin = true; emitir({ t: 'fin', estado: 'listo', resultado });
    } catch (e) {
      clearInterval(latido);
      const m = (e as Error).message ?? '';
      const error = /row-level|42501|Sin permiso/.test(m) ? 'No tienes permiso para esta operación.' : (e as Error).name === 'ErrorIA' || m.length < 180 ? m.slice(0, 380) : 'No se ha podido completar la operación.';
      console.error(`ejecución fallida ${id.slice(0, 8)}: ${(e as Error).name}`);
      await comoUsuario(uid, (tx) => tx.query(`update portal.ia_ejecuciones set estado = 'error', parcial = $2, error = $3, finalizado_at = now() where id = $1`, [id, v.parcial.slice(0, 800000), error])).catch(() => {});
      v.fin = true; emitir({ t: 'fin', estado: 'error', error });
    } finally {
      setTimeout(() => vivas.delete(id), 60_000).unref?.();
    }
  })();
  return id;
}

/** Estado guardado, sujeto a RLS. Quien no puede verla obtiene null: igual que si no existiera. */
export async function leerEjecucion(uid: string, id: string) {
  const f = (await comoUsuario(uid, (tx) => tx.query(`select id, tipo, estado, progreso, parcial, resultado, error, solicitud_id, hilo_id, modo, proveedor, modelo, creado_por,
      extract(epoch from now() - latido_at) * 1000 latido_ms from portal.ia_ejecuciones where id = $1`, [id]))).rows[0];
  if (!f) return null;
  const { latido_ms: ms, ...resto } = f;
  // Viva en este servidor, sigue en curso aunque el guardado se retrase; si no, un latido antiguo significa interrupción.
  if (f.estado === 'en_curso' && !vivas.has(id) && Number(ms) > INTERRUPCION_MS) return { ...resto, estado: 'error', error: 'La tarea se ha interrumpido (por ejemplo, al reiniciarse el servidor). Lo redactado hasta ese momento queda abajo; puedes volver a pedirla.', interrumpida: true };
  return { ...resto, interrumpida: false };
}

/** Flujo de eventos para el navegador. Cerrar la pestaña solo deja de escuchar: el trabajo continúa. */
export function flujoEjecucion(id: string, uid: string): Response | null {
  const v = vivas.get(id);
  if (!v || v.uid !== uid) return null;
  const enc = new TextEncoder();
  let quitar = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      const enviar = (ev: EventoEjecucion | { t: 'inicio'; parcial: string; progreso: string | null }) => c.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      enviar({ t: 'inicio', parcial: v.parcial, progreso: v.progreso });
      const escucha = (ev: EventoEjecucion) => { enviar(ev); if (ev.t === 'fin') { quitar(); try { c.close(); } catch { /* ya cerrado */ } } };
      const ping = setInterval(() => { try { c.enqueue(enc.encode(': ping\n\n')); } catch { quitar(); } }, 15_000);
      quitar = () => { v.escuchas.delete(escucha); clearInterval(ping); };
      v.escuchas.add(escucha);
    },
    cancel() { quitar(); },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no', connection: 'keep-alive' } });
}

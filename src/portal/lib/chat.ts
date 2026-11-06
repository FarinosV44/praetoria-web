import 'server-only';
import { detectarNormas, textoVerificacion, verificarNormas } from './boe';
import { comoUsuario } from './db';
import { lanzarEjecucion } from './ejecuciones';
import { contexto, fuentesBiblioteca, llamarIA, SISTEMA, SISTEMA_DESPACHO, verificarCitas, type Fuente, type Turno } from './ia';
import type { Modo, Proveedor } from './ia-modelos';

// Conversación con el Copiloto (despacho o expediente). El contexto se prepara con la identidad de la persona, por lo que la RLS
// decide qué entra; la llamada al modelo va fuera de la transacción; el resultado se guarda aunque se cierre la pestaña.

export type PeticionChat = {
  uid: string; solicitud: string | null; hilo: string | null; texto: string;
  pedido?: { proveedor?: Proveedor; modo?: Modo; modelo?: string }; adjuntos?: { nombre: string; texto: string }[];
};

const fuentesAdjuntos = (a: { nombre: string; texto: string }[] = []): Fuente[] =>
  a.slice(0, 5).map((x, i) => ({ id: `A${i + 1}`, tipo: 'adjunto', etiqueta: `Adjunto de esta consulta: ${x.nombre.replace(/[<>"]/g, '')}`, texto: x.texto.slice(0, 100_000) }));

export async function iniciarChat(p: PeticionChat): Promise<{ ejecucion: string; hilo: string }> {
  const prep = await comoUsuario(p.uid, async (tx) => {
    let hilo = p.hilo;
    if (hilo) {
      const h = (await tx.query('select id from portal.ia_hilos where id = $1 and solicitud_id is not distinct from $2', [hilo, p.solicitud])).rows[0];
      if (!h) throw new Error('Esa conversación no pertenece aquí.');
    } else {
      hilo = (await tx.query(`insert into portal.ia_hilos (solicitud_id, titulo, ambito, creado_por) values ($1, $2, $3, $4) returning id`,
        [p.solicitud, p.texto.slice(0, 80).padEnd(1, '.'), p.solicitud ? 'expediente' : 'despacho', p.uid])).rows[0].id as string;
    }
    const historial = (await tx.query(`select rol, texto from portal.ia_mensajes where hilo_id = $1 order by created_at`, [hilo])).rows as Turno[];
    await tx.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, autor_id) values ($1, $2, 'usuario', $3, $4)`, [hilo, p.solicitud, p.texto, p.uid]);
    const bib = (await tx.query('select portal.ia_usa_biblioteca() ok')).rows[0].ok
      ? await fuentesBiblioteca(tx, p.uid, p.texto, { limite: p.solicitud ? 5 : 10 }) : { fuentes: [] as Fuente[], semantica: false };
    const caso = p.solicitud ? await contexto(tx, p.solicitud, p.texto) : { fuentes: [] as Fuente[], limites: [] as string[] };
    return { hilo: hilo!, historial, fuentes: [...caso.fuentes, ...bib.fuentes, ...fuentesAdjuntos(p.adjuntos)], limites: caso.limites };
  });
  const ejecucion = await lanzarEjecucion(p.uid, { tipo: 'chat', solicitud: p.solicitud, hilo: prep.hilo, modo: p.pedido?.modo ?? null }, async (c) => {
    c.estado(p.solicitud ? 'Consultando el expediente y la biblioteca…' : 'Consultando la biblioteca del despacho…');
    const r = await llamarIA(prep.historial, p.texto, prep.fuentes, {
      uid: p.uid, solicitud: p.solicitud, tarea: p.solicitud ? 'chat_expediente' : 'chat_despacho', pedido: p.pedido,
      sistema: p.solicitud ? SISTEMA : SISTEMA_DESPACHO, onTexto: c.texto, onEstado: c.estado,
    });
    c.modelo(r.proveedor, r.modelo);
    const v = verificarCitas(r.texto, prep.fuentes);
    const limites = [...prep.limites];
    if (v.invalidas.length) limites.push(`Se han quitado ${v.invalidas.length} citas que no correspondían a ninguna fuente.`);
    if (!v.citas.length && prep.fuentes.length) limites.push('La respuesta no cita ninguna fuente: trátala con cautela.');
    if (r.cortado) limites.push('La respuesta llegó al máximo de extensión y puede estar incompleta.');
    if (r.fallback) limites.push(r.fallback);
    c.estado('Comprobando las normas citadas en el BOE…');
    for (const n of await verificarNormas(detectarNormas(v.texto), 12)) limites.push(textoVerificacion(n));
    const m = await comoUsuario(p.uid, (tx) => tx.query(`insert into portal.ia_mensajes (hilo_id, solicitud_id, rol, texto, citas, limites, modelo, tokens_entrada, tokens_salida, autor_id, proveedor, modo, fallback, coste_usd)
      values ($1, $2, 'asistente', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
    [prep.hilo, p.solicitud, v.texto, JSON.stringify(v.citas), JSON.stringify(limites), r.modelo, r.entrada, r.salida, p.uid, r.proveedor, r.modo, r.fallback, r.coste]));
    return { mensaje: m.rows[0].id, modelo: r.modelo, texto: v.texto, citas: v.citas, limites };
  });
  return { ejecucion, hilo: prep.hilo };
}

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import {
  contextoExpediente, crearConversacion, listarConversaciones, mensajes, preguntar, procesarMensaje, resumirAsunto,
} from '../../src/seguros/lib/ia/expediente';
import { fijarProveedorDePrueba, type PeticionIA, type ProveedorIA } from '../../src/seguros/lib/ia/proveedor';
import { descartarEscrito, guardarVersion, listarAsuntos, listarEscritos, obtenerEscrito, registrarEnvio, registrarRespuesta } from '../../src/seguros/lib/datos/escritos';
import { condicionesEnFecha, cronologia } from '../../src/seguros/lib/datos/expediente';
import { prevision, situacionPagos } from '../../src/seguros/lib/datos/recibos';
import { q1 } from '../../src/seguros/lib/db';
import { seguroAntiguo } from './escenario';
import { usuario } from './ayudas';

/** Referencia D# que el contexto asigna a un documento por su nombre. */
const refDe = (texto: string, nombre: string) => texto.match(new RegExp(`- (D\\d+): [^\\n]*«${nombre.replace(/\./g, '\\.')}»`))?.[1] ?? null;

/** Proveedor falso: registra lo que recibe y responde con lo que se le indique a partir del contexto. */
function falso(responder: (p: PeticionIA) => unknown) {
  const llamadas: PeticionIA[] = [];
  const p: ProveedorIA = { nombre: 'prueba', modelo: 'modelo-prueba', pedir: async (x) => { llamadas.push(x); return { datos: responder(x), modelo: 'modelo-prueba' }; } };
  fijarProveedorDePrueba(p);
  return llamadas;
}

describe('asistente de IA del expediente y escritos (seguro antiguo sintético)', () => {
  let admin: Usuario;
  let e: Awaited<ReturnType<typeof seguroAntiguo>>;
  beforeAll(async () => { admin = await usuario('admin'); e = await seguroAntiguo(admin, `ia${Date.now()}`); });
  afterEach(() => fijarProveedorDePrueba(undefined));

  it('el contexto solo contiene este seguro, separa vigente hoy / aplicable al siniestro y marca las notas como sin acreditar', async () => {
    const otro = await seguroAntiguo(admin, `otro${Date.now()}`);
    const ctx = await contextoExpediente(e.poliza, 'estado del siniestro filtración fontanero');
    expect(ctx.texto).toContain((await q1<{ numero: string }>('SELECT numero FROM polizas WHERE id = $1', [e.poliza]))!.numero);
    expect(ctx.texto).not.toContain((await q1<{ numero: string }>('SELECT numero FROM polizas WHERE id = $1', [otro.poliza]))!.numero);
    expect(ctx.texto).toMatch(/2026-03-01 – 2027-03-01 \[VIGENTE HOY\]/);
    expect(ctx.texto).toMatch(/condiciones aplicables: periodo 2024-03-01 – 2025-03-01/);
    expect(ctx.texto).toMatch(/NOTAS PROPIAS \(afirmaciones SIN ACREDITAR[^\n]*\n- 2024-12-10[^\n]*perito/);
    // La carta de petición (vinculada al siniestro) se selecciona como extracto
    expect(ctx.extractos).toContain('informe del fontanero');
  });

  it('responde sobre el estado del siniestro con citas comprobadas contra el documento y sin darlo por resuelto', async () => {
    const llamadas = falso((p) => {
      const d = refDe(p.texto, 'carta-peticion-documentacion.pdf');
      return {
        respuesta: 'Consta la declaración (12/11/2024), la petición de facturas e informe del fontanero (1/12/2024) y el envío de facturas (20/12/2024). No consta respuesta posterior; el informe del fontanero sigue pendiente. Según nota propia (sin acreditar), el perito iba a venir.',
        citas: [{ ref: d, pagina: 1, cita: 'necesitamos las facturas de reparacion y el informe del fontanero' }, { ref: d, pagina: 1, cita: 'cita inventada que no aparece' }],
      };
    });
    const conv = await crearConversacion(admin, e.poliza, e.asunto);
    const m = await preguntar(admin, conv, '¿En qué estado está el siniestro?');
    await procesarMensaje(m);
    const lista = await mensajes(admin, conv);
    const r = lista.find((x) => x.id === m)!;
    expect(r.estado).toBe('listo');
    expect(r.citas![0]).toMatchObject({ documento_id: e.docs.peticion, documento: 'carta-peticion-documentacion.pdf', pagina: 1, fecha: '2024-12-01', verificada: true });
    expect(r.citas![1]!.verificada).toBe(false);
    expect(r.escrito_id).toBeNull();
    // Recibió el expediente completo, en orden, y la pregunta
    expect(llamadas[0]!.texto).toContain('Usuario: ¿En qué estado está el siniestro?');
    expect(llamadas[0]!.texto.indexOf('Declaración del siniestro')).toBeLessThan(llamadas[0]!.texto.indexOf('Envío de documentación'));
    expect((await listarConversaciones(admin, e.poliza)).map((c) => c.id)).toContain(conv);
  });

  it('el resumen del asunto dice «no consta respuesta» si la IA no la acredita y no cierra el asunto', async () => {
    falso(() => ({ ocurrido: 'Filtración de agua el 10/11/2024.', ultima_actuacion: '20/12/2024: envío de facturas.', respuesta_recibida: null, documentacion_pendiente: 'Informe del fontanero.', siguiente_paso: 'Enviar el informe y reclamar respuesta.', citas: [] }));
    const r = await resumirAsunto(admin, e.asunto);
    expect(r.respuesta).toBe('No consta respuesta posterior a la última actuación.');
    expect(r.constan_respuesta).toBe(false);
    const a = (await listarAsuntos(admin, e.poliza)).find((x) => x.id === e.asunto)!;
    expect(a.estado).toBe('abierto');
    expect(a.resumen_desactualizado).toBe(false);
  });

  it('si faltan datos imprescindibles no genera escrito y los pregunta', async () => {
    falso(() => ({ respuesta: '¿Qué daños concretos y qué importe quieres reclamar?', citas: [], datos_faltantes: ['importe reclamado'], escrito: { tipo: 'reclamacion_falta_respuesta', titulo: 'X', texto: 'no debería guardarse' } }));
    const conv = await crearConversacion(admin, e.poliza, e.asunto);
    const antes = (await listarEscritos(admin, e.poliza)).length;
    await procesarMensaje(await preguntar(admin, conv, 'Reclama que no han respondido'));
    expect((await listarEscritos(admin, e.poliza)).length).toBe(antes);
  });

  it('genera un escrito editable en el mismo seguro y asunto; versiones; generar no es enviar; registra envío y respuesta', async () => {
    falso((p) => {
      const d = refDe(p.texto, 'carta-peticion-documentacion.pdf');
      return {
        respuesta: 'He preparado el borrador de reclamación por falta de respuesta.',
        citas: [{ ref: d, pagina: 1, cita: 'Para continuar la tramitacion necesitamos las facturas' }],
        datos_faltantes: [],
        escrito: { tipo: 'reclamacion_falta_respuesta', titulo: 'Reclamación por falta de respuesta – siniestro filtración', destinatario: 'Mutua Inventada de Seguros',
          texto: `Comercial Inventada S.L.\nA: Mutua Inventada de Seguros\nPóliza ANT-…\n\nEl 20/12/2024 remitimos las facturas solicitadas el 1/12/2024 y no consta respuesta.\n\nSolicitamos que nos indiquen el estado del expediente.` },
      };
    });
    const conv = await crearConversacion(admin, e.poliza, e.asunto);
    const m = await preguntar(admin, conv, 'Prepara un escrito para reclamar que todavía no han respondido');
    await procesarMensaje(m);
    const msg = (await mensajes(admin, conv)).find((x) => x.id === m)!;
    expect(msg.escrito_id).toBeTruthy();
    let es = await obtenerEscrito(admin, msg.escrito_id!);
    expect(es).toMatchObject({ poliza_id: e.poliza, asunto_id: e.asunto, conversacion_id: conv, estado: 'borrador', tipo: 'reclamacion_falta_respuesta', destinatario: 'Mutua Inventada de Seguros' });
    expect(es.versiones).toHaveLength(1);
    expect(es.versiones[0]).toMatchObject({ version: 1, origen: 'ia' });
    expect(es.versiones[0]!.citas![0]!.verificada).toBe(true);
    expect(es.comunicaciones).toHaveLength(0); // generar no es enviar

    // Edición: versión nueva conservando la anterior; guardar lo mismo no duplica
    expect(await guardarVersion(admin, es.id, es.versiones[0]!.texto + '\n\nAtentamente.')).toBe(2);
    expect(await guardarVersion(admin, es.id, es.versiones[0]!.texto + '\n\nAtentamente.')).toBe(2);
    // No puede haber respuesta a un borrador
    await expect(registrarRespuesta(admin, es.id, { fecha: '2026-11-10', medio: 'correo', resumen: 'x' })).rejects.toThrow();

    es = await obtenerEscrito(admin, es.id);
    const v2 = es.versiones.find((v) => v.version === 2)!;
    await registrarEnvio(admin, es.id, { fecha: '2026-11-06', medio: 'correo', destinatario: 'siniestros@mutua-inventada.test', version_id: v2.id });
    await registrarRespuesta(admin, es.id, { fecha: '2026-11-12', medio: 'correo', interlocutor: 'Tramitadora ficticia', resumen: 'Piden de nuevo el informe del fontanero.' });
    es = await obtenerEscrito(admin, es.id);
    expect(es.estado).toBe('respondido');
    expect(es.comunicaciones.map((c) => c.direccion)).toEqual(['enviada', 'recibida']);
    expect(es.comunicaciones[0]!.escrito_version_id).toBe(v2.id);
    // Queda en la cronología del seguro y el resumen del asunto pasa a desactualizado
    const crono = await cronologia(admin, e.poliza);
    expect(crono.some((i) => i.clase === 'escrito')).toBe(true);
    expect((await listarAsuntos(admin, e.poliza)).find((x) => x.id === e.asunto)!.resumen_desactualizado).toBe(true);
    // Un enviado no se puede descartar
    await descartarEscrito(admin, es.id);
    expect((await obtenerEscrito(admin, es.id)).estado).toBe('respondido');
  });

  it('error del proveedor: el mensaje queda en error, sin respuesta inventada', async () => {
    fijarProveedorDePrueba({ nombre: 'prueba', modelo: 'x', pedir: async () => { throw new Error('fallo simulado del proveedor'); } });
    const conv = await crearConversacion(admin, e.poliza, null);
    const m = await preguntar(admin, conv, 'Hola');
    await procesarMensaje(m);
    const r = (await mensajes(admin, conv)).find((x) => x.id === m)!;
    expect(r.estado).toBe('error');
    expect(r.texto).toBe('');
  });

  it('sin IA configurada no se aceptan preguntas', async () => {
    fijarProveedorDePrueba(null);
    const conv = await crearConversacion(admin, e.poliza, null);
    await expect(preguntar(admin, conv, '¿Qué cubre?')).rejects.toSatisfy((x: unknown) => /no está configurado/.test(JSON.stringify((x as { campos?: unknown }).campos)));
  });

  it('un colaborador sin acceso no ve conversaciones, asuntos ni escritos', async () => {
    const colab = await usuario('colaborador');
    await expect(listarConversaciones(colab, e.poliza)).rejects.toThrow();
    await expect(listarAsuntos(colab, e.poliza)).rejects.toThrow();
    await expect(listarEscritos(colab, e.poliza)).rejects.toThrow();
    const conv = await crearConversacion(admin, e.poliza, null);
    await expect(mensajes(colab, conv)).rejects.toThrow();
    await expect(preguntar(colab, conv, 'x')).rejects.toThrow();
    await expect(resumirAsunto(colab, e.asunto)).rejects.toThrow();
  });

  it('comprobación de aceptación con el seguro antiguo', async () => {
    // 1) todo en una sola póliza
    expect((await q1<{ n: number }>('SELECT count(*)::int n FROM polizas WHERE titular_id = $1', [e.titular]))!.n).toBe(1);
    // 2) últimos pagos y próximo cobro
    const s = await situacionPagos(e.poliza);
    expect(s.ultimos[0]!.fecha_pago).toBe('2026-03-02');
    expect(s.proximo).toBeTruthy();
    // 3) previsión mensual sin duplicados para este seguro
    const pv = (await prevision(admin, { desde: '2027-01', meses: 12, titularId: e.titular })).filter((x) => x.poliza_id === e.poliza);
    const claves = pv.map((x) => `${x.mes}`);
    expect(new Set(claves).size).toBe(claves.length);
    // 6) condiciones históricas tras la renovación: el día del siniestro no rige el suplemento de 2025
    const h = await condicionesEnFecha(admin, e.poliza, '2024-11-10');
    expect(h.anualidad?.inicio).toBe('2024-03-01');
    expect(h.modificaciones).toHaveLength(0);
    expect(h.anteriores).toHaveLength(0);
    const hoy = await condicionesEnFecha(admin, e.poliza, '2026-11-06');
    expect(hoy.anualidad?.inicio).toBe('2026-03-01');
    expect(hoy.modificaciones).toHaveLength(0); // ninguna en el periodo vigente…
    expect(hoy.anteriores.map((m) => m.descripcion).join()).toContain('60.000'); // …pero se conserva la del periodo anterior
  });
});

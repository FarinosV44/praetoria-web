import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { subirDocumento } from '../../src/seguros/lib/datos/documentos';
import { listarAnualidades, obtenerPoliza, actualizarAnualidad } from '../../src/seguros/lib/datos/polizas';
import { aplicarExtraccion, extraccionesDe, procesarColaExtraccion, solicitarExtraccion } from '../../src/seguros/lib/ia/extraccion';
import { fijarProveedorDePrueba, type ProveedorIA } from '../../src/seguros/lib/ia/proveedor';
import { abrirRenovacion, borradorSolicitud, compararOferta, crearOferta, datosActuales, obtenerRenovacion, registrarDecision } from '../../src/seguros/lib/datos/renovaciones';
import { planificar } from '../../src/seguros/lib/avisos/motor';
import { q, q1 } from '../../src/seguros/lib/db';
import { CONDICIONES_PARTICULARES, pdfSintetico } from './pdf-sintetico';
import { poliza, titular, usuario } from './ayudas';

const prov = (datos: unknown): ProveedorIA => ({ nombre: 'prueba', modelo: 'prueba', pedir: async () => ({ datos, modelo: 'prueba' }) });

describe('extracción revisable (#2)', () => {
  let admin: Usuario, pol: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    pol = await poliza(admin, await titular(admin, 'empresa', 'Empresa Sintética Extracción'), { inicio: '', fin: '', prima_anual: '', periodicidad: '' });
  });
  afterEach(() => fijarProveedorDePrueba(undefined));

  it('propone datos con página y cita verificada; la persona confirma y prevalece su corrección', async () => {
    const doc = (await subirDocumento(admin, { polizaId: pol, tipo: 'condiciones_particulares', nombre: 'cp.pdf', datos: CONDICIONES_PARTICULARES })).id;
    fijarProveedorDePrueba(prov({
      campos: {
        numero: { valor: 'SINT-0001', pagina: 1, cita: 'Poliza numero SINT-0001', confianza: 'alta' },
        inicio: { valor: '2026-01-15', pagina: 1, cita: 'Efecto: 2026-01-15', confianza: 'alta' },
        fin: { valor: '2027-01-15', pagina: 1, cita: 'Vencimiento: 2027-01-15', confianza: 'alta' },
        prima_anual: { valor: '640,00', pagina: 1, cita: 'Prima total anual: 640,00 euros', confianza: 'alta' },
        periodicidad: { valor: 'Anual', pagina: 1, cita: 'Forma de pago: anual', confianza: 'alta' },
        plazo_oposicion: { valor: '15/12/2026', pagina: 1, cita: 'inventada', confianza: 'media' },
        tomador: { valor: 'Persona Falsa', pagina: 1, cita: 'Tomador: Persona que no aparece', confianza: 'alta' },
      },
      listas: { garantias: [{ texto: 'Daños propios', pagina: 1, cita: null }] }, avisos: [],
    }));
    await solicitarExtraccion(admin, doc);
    expect((await q1<{ estado: string }>('SELECT estado FROM documentos WHERE id = $1', [doc]))!.estado).toBe('procesando');
    await procesarColaExtraccion();
    const [e] = await extraccionesDe(admin, doc);
    expect(e!.estado).toBe('revision');
    expect(e!.campos!.prima_anual).toMatchObject({ valor: '640.00', verificada: true, pagina: 1 });
    expect(e!.campos!.periodicidad!.valor).toBe('anual');
    expect(e!.campos!.plazo_oposicion).toBeUndefined(); // fecha no válida: no se propone
    expect(e!.avisos!.join(' ')).toMatch(/no es una fecha válida/);
    expect(e!.campos!.tomador).toMatchObject({ verificada: false, confianza: 'baja' }); // cita que no está en el PDF
    // Nada se ha aplicado todavía
    const [a0] = await listarAnualidades(admin, pol);
    expect(a0!.prima_anual).toBeNull();
    // La persona corrige la prima y solo confirma algunos campos
    await aplicarExtraccion(admin, e!.id, a0!.id, { prima_anual: '650,00', inicio: '2026-01-15', fin: '2027-01-15', numero: 'SINT-0001' }, ['prima_anual', 'inicio', 'fin', 'numero'], ['garantias']);
    const [a1] = await listarAnualidades(admin, pol);
    expect([a1!.prima_anual, a1!.inicio, a1!.fin]).toEqual(['650.00', '2026-01-15', '2027-01-15']);
    expect((await obtenerPoliza(admin, pol)).numero).toBe('SINT-0001');
    expect((await obtenerPoliza(admin, pol)).tomador).toBeNull();
    // Una relectura no sobrescribe lo confirmado
    fijarProveedorDePrueba(prov({ campos: { prima_anual: { valor: '999,00', pagina: 1, cita: null, confianza: 'alta' } }, listas: {}, avisos: [] }));
    await solicitarExtraccion(admin, doc);
    await procesarColaExtraccion();
    expect((await listarAnualidades(admin, pol))[0]!.prima_anual).toBe('650.00');
  });

  it('documento ilegible u OCR fallido: no crea ficha confirmada ni fechas inventadas', async () => {
    const doc = (await subirDocumento(admin, { polizaId: pol, tipo: 'otro', nombre: 'borroso.pdf', datos: pdfSintetico(['']) })).id;
    fijarProveedorDePrueba(prov({ campos: {}, listas: {}, avisos: ['El documento es ilegible.'] }));
    await solicitarExtraccion(admin, doc);
    await procesarColaExtraccion();
    const [e] = await extraccionesDe(admin, doc);
    expect(Object.keys(e!.campos!).filter((k) => k !== '_listas')).toHaveLength(0);
    expect(e!.avisos).toContain('El documento es ilegible.');
    // Fallo del proveedor: queda en error tras los reintentos, sin datos
    const doc2 = (await subirDocumento(admin, { polizaId: pol, tipo: 'otro', nombre: 'fallo.pdf', datos: pdfSintetico(['x']) })).id;
    fijarProveedorDePrueba({ nombre: 'prueba', modelo: 'prueba', pedir: async () => { throw new Error('caída'); } });
    await solicitarExtraccion(admin, doc2);
    for (let i = 0; i < 3; i++) await procesarColaExtraccion();
    expect((await extraccionesDe(admin, doc2))[0]!.estado).toBe('error');
    expect((await q1<{ estado: string }>('SELECT estado FROM documentos WHERE id = $1', [doc2]))!.estado).toBe('error');
  });
});

describe('renegociación (#6)', () => {
  let admin: Usuario, pol: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    pol = await poliza(admin, await titular(admin, 'empresa', 'Empresa Sintética Renovación'), { inicio: '2026-02-01', fin: '2027-02-01', prima_anual: '1.000,00' });
  });

  it('aviso → ofertas → comparación → decisión → nueva anualidad con histórico intacto', async () => {
    const [a] = await listarAnualidades(admin, pol);
    await actualizarAnualidad(admin, a!.id, { inicio: '2026-02-01', fin: '2027-02-01', prima_anual: '1.000,00', periodicidad: 'anual' });
    await q(`UPDATE anualidades SET franquicias = $2, exclusiones = $3, garantias = $4 WHERE id = $1`, [a!.id,
      JSON.stringify([{ texto: 'Franquicia de 150 euros' }]), JSON.stringify([{ texto: 'Desgaste' }]), JSON.stringify([{ texto: 'Daños propios' }, { texto: 'Robo' }])]);
    await planificar('2027-01-02');
    const id = await abrirRenovacion(admin, a!.id);
    expect(await abrirRenovacion(admin, a!.id)).toBe(id); // idempotente

    const barata = await crearOferta(admin, id, { aseguradora: 'Compañía Barata (ficticia)', prima_anual: '850,00', franquicias: 'Franquicia de 600 euros', exclusiones: 'Desgaste\nConductores menores de 25 años', garantias: 'Daños propios' });
    const r = await obtenerRenovacion(admin, id);
    const dif = compararOferta(r.ofertas.find((o) => o.id === barata)!, datosActuales(r.anualidad));
    const textos = dif.map((d) => d.texto).join(' | ');
    expect(textos).toMatch(/Más barata/);
    expect(textos).toMatch(/Franquicia superior/);
    expect(textos).toMatch(/Exclusión nueva o distinta: Conductores menores de 25 años/);
    expect(textos).toMatch(/No figura en la oferta: Robo/);
    expect(dif.filter((d) => d.gravedad === 'peor').length).toBeGreaterThanOrEqual(2);

    // Generar el borrador no cierra la negociación ni toca los avisos
    const texto = await borradorSolicitud(admin, id);
    expect(texto).toContain('1.000,00');
    expect((await obtenerRenovacion(admin, id)).estado).toBe('ofertas');
    expect((await q('SELECT 1 FROM avisos WHERE anualidad_id = $1 AND estado <> $2', [a!.id, 'obsoleto'])).length).toBeGreaterThan(0);

    await registrarDecision(admin, id, { decision: 'renovar', inicio: '2027-02-01', fin: '2028-02-01', prima_anual: '1.050,00', periodicidad: 'anual' });
    const anualidades = await listarAnualidades(admin, pol);
    expect(anualidades.map((x) => x.prima_anual)).toEqual(['1050.00', '1000.00']);
    expect((await obtenerRenovacion(admin, id)).estado).toBe('renovada');
    // Avisos de la anualidad anterior: obsoletos
    expect((await q(`SELECT 1 FROM avisos WHERE anualidad_id = $1 AND estado IN ('programado','emitido')`, [a!.id])).length).toBe(0);
  });

  it('cambio de compañía: nueva póliza enlazada y la anterior marcada como sustituida', async () => {
    const p2 = await poliza(admin, await titular(admin, 'particular', 'Particular Sintético Renovación'), { inicio: '2026-03-01', fin: '2027-03-01' });
    const [a] = await listarAnualidades(admin, p2);
    const id = await abrirRenovacion(admin, a!.id);
    await registrarDecision(admin, id, { decision: 'sustituir', aseguradora_nueva: 'Nueva Aseguradora (ficticia)', inicio: '2027-03-01', fin: '2028-03-01', prima_anual: '500,00' });
    const vieja = await obtenerPoliza(admin, p2);
    expect(vieja.estado).toBe('sustituida');
    const nueva = await obtenerPoliza(admin, vieja.sustituida_por!);
    expect(nueva.aseguradora).toBe('Nueva Aseguradora (ficticia)');
    expect((await listarAnualidades(admin, p2))).toHaveLength(1); // histórico de la anterior intacto
  });
});

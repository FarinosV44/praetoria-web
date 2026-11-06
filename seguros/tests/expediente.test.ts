import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { almacen } from '../../src/seguros/lib/almacen';
import { condicionesEnFecha, cronologia } from '../../src/seguros/lib/datos/expediente';
import { guardarRecibo, listarRecibos, prevision, situacionPagos, totalesPorMes } from '../../src/seguros/lib/datos/recibos';
import { panel } from '../../src/seguros/lib/datos/panel';
import { anadirArchivos, crearImportacion, importacionDe, procesarImportacion } from '../../src/seguros/lib/ia/importacion';
import { fijarProveedorDePrueba } from '../../src/seguros/lib/ia/proveedor';
import { q, q1 } from '../../src/seguros/lib/db';
import { pdfSintetico } from './pdf-sintetico';
import { seguroAntiguo } from './escenario';
import { usuario } from './ayudas';

// Expediente permanente, recibos y previsión con un seguro antiguo SINTÉTICO.
describe('expediente de un seguro antiguo', () => {
  let admin: Usuario;
  let e: Awaited<ReturnType<typeof seguroAntiguo>>;
  beforeAll(async () => { admin = await usuario('admin'); e = await seguroAntiguo(admin); });
  afterEach(() => fijarProveedorDePrueba(undefined));

  it('todo queda en el mismo seguro: una sola póliza con sus periodos, documentos, recibos, notas, comunicaciones y siniestro', async () => {
    expect((await q1<{ n: number }>('SELECT count(*)::int n FROM polizas WHERE titular_id = $1', [e.titular]))!.n).toBe(1);
    const c = await cronologia(admin, e.poliza);
    const clases = new Set(c.map((i) => i.clase));
    for (const k of ['documento', 'nota', 'comunicacion', 'modificacion', 'recibo', 'periodo', 'siniestro']) expect(clases).toContain(k);
    // Orden cronológico descendente y notas marcadas como no acreditadas
    expect(c.map((i) => i.fecha ?? '').every((f, i, a) => i === 0 || a[i - 1]! >= f)).toBe(true);
    expect(c.find((i) => i.clase === 'nota')!.acreditado).toBe(false);
    // Búsqueda dentro del contenido de los documentos
    const r = await cronologia(admin, e.poliza, { buscar: 'informe del fontanero' });
    expect(r.map((i) => i.id)).toContain(e.docs.peticion);
    expect((await cronologia(admin, e.poliza, { clase: 'recibo' })).every((i) => i.clase === 'recibo')).toBe(true);
  });

  it('condiciones históricas: las del día del siniestro no incluyen el suplemento posterior; las de hoy sí', async () => {
    const entonces = await condicionesEnFecha(admin, e.poliza, '2024-11-10');
    expect(entonces.anualidad!.id).toBe(e.anualidades.a2024);
    expect(entonces.modificaciones).toHaveLength(0);
    expect(entonces.documentos.map((d) => d.nombre_original)).toContain('condiciones-generales.pdf');
    const hoy = await condicionesEnFecha(admin, e.poliza, '2026-11-06');
    expect(hoy.anualidad!.id).toBe(e.anualidades.a2026);
    const conSup = await condicionesEnFecha(admin, e.poliza, '2025-10-01');
    expect(conSup.modificaciones.map((m) => m.descripcion)).toEqual(['Se amplía el contenido asegurado a 60.000 euros.']);
  });

  it('recibos: pagado exige fecha de pago, sin duplicados, con histórico de subidas y últimos pagos', async () => {
    await expect(guardarRecibo(admin, e.poliza, null, { importe: '350,00', estado: 'pagado' })).rejects.toThrow(/Revisa/);
    await expect(guardarRecibo(admin, e.poliza, null, { numero: 'R-2025-1', importe: '1,00', estado: 'pendiente' })).rejects.toThrow(/Revisa/);
    const lista = await listarRecibos(admin, e.poliza);
    expect(lista.find((r) => r.numero === 'R-2026-1')!.subida).toBe(6.1); // 330 → 350
    const s = await situacionPagos(e.poliza);
    expect(s.ultimos.map((r) => r.fecha_pago)).toEqual(['2026-03-02', '2025-09-02', '2025-03-03']);
    expect(s.proximo).toMatchObject({ estado: 'devuelto', importe: '350.00' });
  });

  it('previsión mensual: estimaciones sin día, sin contar dos veces un recibo real y su previsión', async () => {
    const antes = await prevision(admin, { desde: '2027-01', meses: 12, titularId: e.titular });
    const marzo = antes.filter((x) => x.mes === '2027-03');
    expect(marzo).toEqual([expect.objectContaining({ tipo: 'estimado', fecha: null, importe: '350.00' })]);
    expect(antes.filter((x) => x.tipo === 'estimado').map((x) => x.mes)).toEqual(['2027-03', '2027-09']);
    // Llega el recibo real de marzo: sustituye a la estimación
    await guardarRecibo(admin, e.poliza, null, { numero: 'R-2027-1', periodo_desde: '2027-03-01', periodo_hasta: '2027-09-01', fecha_cargo: '2027-03-05', importe: '365,00', periodicidad: 'semestral', estado: 'pendiente' });
    const despues = await prevision(admin, { desde: '2027-01', meses: 12, titularId: e.titular });
    expect(despues.filter((x) => x.mes === '2027-03')).toEqual([expect.objectContaining({ tipo: 'confirmado', fecha: '2027-03-05', importe: '365.00' })]);
    // La estimación de septiembre usa el último importe conocido (365)
    expect(despues.find((x) => x.mes === '2027-09')).toMatchObject({ tipo: 'estimado', importe: '365.00' });
    const t = totalesPorMes(despues);
    expect(t.find((x) => x.mes === '2027-03')).toMatchObject({ confirmado: 36500, estimado: 0, pagado: 0 });
    // Pagos ya acreditados aparecen como pagados en su mes
    const pasado = await prevision(admin, { desde: '2026-03', meses: 1, titularId: e.titular });
    expect(pasado).toEqual([expect.objectContaining({ tipo: 'pagado', fecha: '2026-03-02' })]);
    // El panel muestra el próximo cobro y el plazo de oposición
    const { filas } = await panel(admin, { titular: e.titular, orden: 'cobro' }, '2026-11-06');
    expect(filas[0]).toMatchObject({ plazo_oposicion: '2027-01-29' });
    expect(filas[0]!.proximo_cobro).toMatchObject({ tipo: 'confirmado', fecha: '2027-03-05' });
  });

  it('la IA añade un recibo a la póliza existente sin crear periodos ni pólizas, y un justificante posterior lo marca pagado', async () => {
    const recibo = pdfSintetico(['RECIBO (FICTICIO) R-2027-2\nPeriodo 2027-09-01 a 2028-03-01. Importe 365,00 euros. Fecha de cargo 2027-09-01.']);
    const justificante = pdfSintetico(['EXTRACTO (FICTICIO)\nCargo recibo R-2027-2 de 365,00 euros. Fecha valor 2027-09-02.']);
    const periodosAntes = (await q1<{ n: number }>('SELECT count(*)::int n FROM anualidades WHERE poliza_id = $1', [e.poliza]))!.n;
    const leer = async (nombre: string, datos: Buffer, tipo: string, acredita: boolean, fechaPago: string | null, cita: string) => {
      fijarProveedorDePrueba({ nombre: 'prueba', modelo: 'prueba', pedir: async () => ({ modelo: 'prueba', datos: { avisos: [], polizas: [{
        documentos: [{ indice: 1, tipo }], ramo: 'hogar',
        // Una IA descuidada podría tomar el periodo del recibo como periodo de cobertura: no debe crear un periodo.
        campos: { inicio: { valor: '2027-09-01', documento: 1, pagina: 1, cita: 'Periodo 2027-09-01', confianza: 'alta' }, fin: { valor: '2028-03-01', documento: 1, pagina: 1, cita: '2028-03-01', confianza: 'alta' } },
        recibos: [{ documento: 1, pagina: 1, cita, numero: 'R-2027-2', periodo_desde: '2027-09-01', periodo_hasta: '2028-03-01', fecha_cargo: '2027-09-01', fecha_pago: fechaPago, importe: '365,00', periodicidad: 'semestral', acredita_pago: acredita }],
      }] } }) });
      const id = await crearImportacion(admin, { polizaId: e.poliza });
      await anadirArchivos(admin, id, [{ clave: await almacen().guardar(id, datos, 'application/pdf'), nombre, datos }]);
      await procesarImportacion(id);
      return importacionDe(admin, id);
    };
    const i1 = await leer('recibo-2027-09.pdf', recibo, 'recibo', false, null, 'RECIBO (FICTICIO) R-2027-2');
    expect(i1.resultado!.polizas[0]).toMatchObject({ accion: 'actualizada', poliza_id: e.poliza, recibos: 1 });
    expect((await q1<{ n: number }>('SELECT count(*)::int n FROM anualidades WHERE poliza_id = $1', [e.poliza]))!.n).toBe(periodosAntes);
    let r = (await listarRecibos(admin, e.poliza)).find((x) => x.numero === 'R-2027-2')!;
    expect(r).toMatchObject({ estado: 'pendiente', fecha_pago: null, revisado: false, origen: 'ia', documento_nombre: 'recibo-2027-09.pdf' });

    await leer('cargo-2027-09.pdf', justificante, 'justificante_pago', true, '2027-09-02', 'Cargo recibo R-2027-2');
    const todos = (await listarRecibos(admin, e.poliza)).filter((x) => x.numero === 'R-2027-2');
    expect(todos).toHaveLength(1); // sin duplicar
    r = todos[0]!;
    expect(r).toMatchObject({ estado: 'pagado', fecha_pago: '2027-09-02', justificante_nombre: 'cargo-2027-09.pdf', documento_nombre: 'recibo-2027-09.pdf' });
    expect((await q1<{ n: number }>('SELECT count(*)::int n FROM polizas WHERE titular_id = $1', [e.titular]))!.n).toBe(1);
  });

  it('el siniestro ve los documentos del seguro vinculados, sin copiarlos', async () => {
    const n = await q<{ siniestro_id: string }>('SELECT siniestro_id FROM documento_siniestros WHERE documento_id = $1', [e.docs.peticion]);
    expect(n.map((x) => x.siniestro_id)).toEqual([e.siniestro]);
    expect((await q1<{ n: number }>('SELECT count(*)::int n FROM siniestro_archivos WHERE siniestro_id = $1', [e.siniestro]))!.n).toBe(0);
  });

  it('un colaborador sin acceso no ve nada del expediente', async () => {
    const colab = await usuario('colaborador');
    await expect(cronologia(colab, e.poliza)).rejects.toThrow(/No se ha encontrado/);
    await expect(listarRecibos(colab, e.poliza)).rejects.toThrow(/No se ha encontrado/);
    expect(await prevision(colab, {})).toEqual([]);
  });
});

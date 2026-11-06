import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { almacen } from '../../src/seguros/lib/almacen';
import { anadirArchivos, crearImportacion, importacionDe, procesarImportacion } from '../../src/seguros/lib/ia/importacion';
import { fijarProveedorDePrueba, type ProveedorIA, type RespuestaBusqueda } from '../../src/seguros/lib/ia/proveedor';
import { listarAnualidades, obtenerPoliza } from '../../src/seguros/lib/datos/polizas';
import { listarDocumentos } from '../../src/seguros/lib/datos/documentos';
import { q, q1 } from '../../src/seguros/lib/db';
import { pdfSintetico } from './pdf-sintetico';
import { usuario } from './ayudas';

// Alta automática de pólizas a partir de documentos SINTÉTICOS (todo inventado para las pruebas).
const CP = pdfSintetico([
  'CONDICIONES PARTICULARES DE PRUEBA\nAseguradora Ficticia de Seguros S.A.\nPoliza numero IMP-7788\nTomador: Transportes Inventados S.L. CIF B00000000\nVehiculo asegurado: Furgoneta 0000-XXX\nEfecto: 2026-03-01 Vencimiento: 2027-03-01\nPrima total anual: 812,40 euros. Forma de pago: trimestral\nRecibo trimestral: 203,10 euros',
  'Garantias contratadas: Responsabilidad civil obligatoria. Danos propios con franquicia de 300 euros.\nOposicion a la prorroga: con un mes de antelacion al vencimiento.\nTelefono de asistencia en viaje 24 horas: 900 000 111',
]);

const datosIA = (extra: Record<string, unknown> = {}) => ({
  polizas: [{
    documentos: [{ indice: 1, tipo: 'condiciones_particulares' }],
    titular: { tipo: 'empresa', nombre: { valor: 'Transportes Inventados S.L.', documento: 1, pagina: 1, cita: 'Tomador: Transportes Inventados S.L.', confianza: 'alta' }, nif: { valor: 'B00000000', documento: 1, pagina: 1, cita: 'CIF B00000000', confianza: 'alta' } },
    ramo: 'coche', denominacion: 'Furgoneta 0000-XXX',
    campos: {
      aseguradora: { valor: 'Aseguradora Ficticia de Seguros S.A.', documento: 1, pagina: 1, cita: 'Aseguradora Ficticia de Seguros S.A.', confianza: 'alta' },
      numero: { valor: 'IMP-7788', documento: 1, pagina: 1, cita: 'Poliza numero IMP-7788', confianza: 'alta' },
      riesgo: { valor: 'Furgoneta 0000-XXX', documento: 1, pagina: 1, cita: 'Vehiculo asegurado: Furgoneta 0000-XXX', confianza: 'alta' },
      inicio: { valor: '2026-03-01', documento: 1, pagina: 1, cita: 'Efecto: 2026-03-01', confianza: 'alta' },
      fin: { valor: '2027-03-01', documento: 1, pagina: 1, cita: 'Vencimiento: 2027-03-01', confianza: 'alta' },
      prima_anual: { valor: '812,40', documento: 1, pagina: 1, cita: 'Prima total anual: 812,40 euros', confianza: 'alta' },
      periodicidad: { valor: 'trimestral', documento: 1, pagina: 1, cita: 'Forma de pago: trimestral', confianza: 'alta' },
      importe_recibo: { valor: '203,10', documento: 1, pagina: 1, cita: 'Recibo trimestral: 203,10 euros', confianza: 'alta' },
      plazo_oposicion: { valor: '2027-02-01', documento: 1, pagina: 2, cita: 'con un mes de antelacion al vencimiento', confianza: 'alta' },
      asistencia_telefono: { valor: '900 000 111', documento: 1, pagina: 2, cita: 'Telefono de asistencia en viaje 24 horas: 900 000 111', confianza: 'alta' },
      mediador: { valor: 'Correduría Inexistente', documento: 1, pagina: 1, cita: 'Mediador: Correduría Inexistente', confianza: 'alta' }, // la cita NO está
      beneficiario: { valor: 'Banco Ficticio', documento: 1, pagina: 1, cita: null, confianza: 'baja' },
    },
    listas: { garantias: [{ texto: 'Responsabilidad civil obligatoria', documento: 1, pagina: 2, cita: 'Responsabilidad civil obligatoria' }, { texto: 'Inventada', pagina: 2, cita: 'cobertura que no existe en el texto' }] },
    ...extra,
  }],
  avisos: [],
});

const busqueda = (r: Partial<RespuestaBusqueda>): RespuestaBusqueda => ({ datos: {}, modelo: 'prueba', fuentes: [], ...r });
let buscadas = 0;
const proveedor = (datos: unknown, web: RespuestaBusqueda = busqueda({})): ProveedorIA => ({
  nombre: 'prueba', modelo: 'prueba',
  pedir: async () => ({ datos, modelo: 'prueba' }),
  buscar: async () => { buscadas++; return web; },
});

async function lote(u: Usuario, archivos: { nombre: string; datos: Buffer }[], opciones: { polizaId?: string } = {}) {
  const id = await crearImportacion(u, opciones);
  const subidos = [];
  for (const a of archivos) subidos.push({ clave: await almacen().guardar(id, a.datos, 'application/pdf'), nombre: a.nombre, datos: a.datos });
  await anadirArchivos(u, id, subidos);
  return id;
}

describe('alta de pólizas leyendo los documentos', () => {
  let admin: Usuario;
  beforeAll(async () => { admin = await usuario('admin'); });
  afterEach(() => fijarProveedorDePrueba(undefined));

  it('crea titular, póliza, anualidad y documento solo con los datos comprobados, y busca el teléfono de siniestros en internet', async () => {
    buscadas = 0;
    fijarProveedorDePrueba(proveedor(datosIA(), busqueda({
      datos: {
        siniestros_telefono: { valor: '+34 910 000 222', url: 'https://www.aseguradora-ficticia.test/siniestros' },
        asistencia_telefono: { valor: '900 999 999', url: 'https://www.aseguradora-ficticia.test/asistencia' }, // ya consta en la póliza: no se toca
        siniestros_web: { valor: 'https://www.aseguradora-ficticia.test/declarar', url: 'https://pagina-no-consultada.test/' }, // fuente no consultada
      },
      fuentes: [{ url: 'https://www.aseguradora-ficticia.test/siniestros', titulo: 'Siniestros · Aseguradora Ficticia' }],
    })));
    const id = await lote(admin, [{ nombre: 'cp-furgoneta.pdf', datos: CP }]);
    await procesarImportacion(id);
    const i = await importacionDe(admin, id);
    expect(i.estado).toBe('hecha');
    const r = i.resultado!.polizas[0]!;
    expect(r.accion).toBe('creada');
    expect(r.titular_creado).toBe(true);

    const p = await obtenerPoliza(admin, r.poliza_id!);
    expect(p).toMatchObject({ nombre: 'Furgoneta 0000-XXX', aseguradora: 'Aseguradora Ficticia de Seguros S.A.', numero: 'IMP-7788', titular_tipo: 'empresa', titular_nombre: 'Transportes Inventados S.L.', asistencia_telefono: '900 000 111' });
    // Cita inexistente y lectura dudosa: pendientes, nunca inventados
    expect(p.mediador).toBeNull();
    expect(p.beneficiario).toBeNull();
    expect(r.pendientes).toEqual(expect.arrayContaining(['mediador', 'beneficiario']));
    // Procedencia
    expect(p.origen_datos.numero).toMatchObject({ origen: 'documento', documento: 'cp-furgoneta.pdf', pagina: 1 });
    // Internet: solo lo que tiene una fuente consultada de verdad
    expect(p.siniestros_telefono).toBe('910 000 222');
    expect(p.origen_datos.siniestros_telefono).toMatchObject({ origen: 'internet', url: 'https://www.aseguradora-ficticia.test/siniestros' });
    expect(p.siniestros_web).toBeNull();
    expect(r.contactos).toEqual([expect.objectContaining({ campo: 'siniestros_telefono', valor: '910 000 222' })]);

    const [a] = await listarAnualidades(admin, p.id);
    expect(a).toMatchObject({ inicio: '2026-03-01', fin: '2027-03-01', prima_anual: '812.40', periodicidad: 'trimestral', importe_recibo: '203.10', plazo_oposicion: '2027-02-01', plazo_oposicion_confirmado: true });
    expect(a!.plazo_oposicion_fuente).toContain('cp-furgoneta.pdf, pág. 2');
    expect((a as unknown as { garantias: { texto: string }[] }).garantias.map((g) => g.texto)).toEqual(['Responsabilidad civil obligatoria']);
    const docs = await listarDocumentos(admin, p.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ tipo: 'condiciones_particulares', anualidad_id: a!.id });

    // La búsqueda se reutiliza para la misma aseguradora y tipo de seguro
    expect(buscadas).toBe(1);
  });

  it('un documento posterior de la misma póliza la completa sin sobrescribir y anota las discrepancias; una renovación crea anualidad nueva', async () => {
    const renovacion = pdfSintetico(['RENOVACION DE PRUEBA\nAseguradora Ficticia de Seguros S.A.\nPoliza numero IMP-7788\nEfecto: 2027-03-01 Vencimiento: 2028-03-01\nPrima total anual: 845,00 euros\nVehiculo asegurado: Furgoneta 1111-YYY\nMediador: Correduria Sintetica']);
    fijarProveedorDePrueba(proveedor({
      polizas: [{
        documentos: [{ indice: 1, tipo: 'renovacion' }], ramo: 'coche',
        campos: {
          aseguradora: { valor: 'Aseguradora Ficticia de Seguros S.A.', documento: 1, pagina: 1, cita: 'Aseguradora Ficticia de Seguros S.A.', confianza: 'alta' },
          numero: { valor: 'IMP 7788', documento: 1, pagina: 1, cita: 'Poliza numero IMP-7788', confianza: 'alta' },
          inicio: { valor: '2027-03-01', documento: 1, pagina: 1, cita: 'Efecto: 2027-03-01', confianza: 'alta' },
          fin: { valor: '2028-03-01', documento: 1, pagina: 1, cita: 'Vencimiento: 2028-03-01', confianza: 'alta' },
          prima_anual: { valor: '845,00', documento: 1, pagina: 1, cita: 'Prima total anual: 845,00 euros', confianza: 'alta' },
          riesgo: { valor: 'Furgoneta 1111-YYY', documento: 1, pagina: 1, cita: 'Vehiculo asegurado: Furgoneta 1111-YYY', confianza: 'alta' },
          mediador: { valor: 'Correduria Sintetica', documento: 1, pagina: 1, cita: 'Mediador: Correduria Sintetica', confianza: 'alta' },
        },
      }],
      avisos: [],
    }));
    const id = await lote(admin, [{ nombre: 'renovacion-2027.pdf', datos: renovacion }]);
    await procesarImportacion(id);
    const r = (await importacionDe(admin, id)).resultado!.polizas[0]!;
    expect(r.accion).toBe('actualizada');
    expect(r.anualidad).toBe('creada');
    expect(r.guardados).toContain('mediador');
    expect(r.discrepancias.join(' ')).toContain('Furgoneta 0000-XXX');
    const p = await obtenerPoliza(admin, r.poliza_id!);
    expect(p.riesgo).toBe('Furgoneta 0000-XXX'); // no se sobrescribe
    expect(p.mediador).toBe('Correduria Sintetica'); // faltaba: se completa
    const anualidades = await listarAnualidades(admin, p.id);
    expect(anualidades.map((a) => a.inicio).sort()).toEqual(['2026-03-01', '2027-03-01']);
    expect((await q<{ n: number }>('SELECT count(*)::int AS n FROM polizas WHERE numero = $1', ['IMP-7788']))[0]!.n).toBe(1);
  });

  it('las condiciones sin número y un suplemento posterior con número del mismo bien van a la misma póliza', async () => {
    const sufijo = String(Date.now());
    const titular = `Particular Inventado ${sufijo}`;
    const c = (valor: string, cita: string) => ({ valor, documento: 1, pagina: 1, cita, confianza: 'alta' });
    const cp = pdfSintetico([`CONDICIONES PARTICULARES (FICTICIAS)\nMutua Imaginaria de Seguros, S.A.\nTomador: ${titular}\nRiesgo: Chalet, calle Inventada 7, 46999 Pueblo Ficticio (Valencia)`]);
    fijarProveedorDePrueba(proveedor({ polizas: [{ documentos: [{ indice: 1, tipo: 'condiciones_particulares' }], ramo: 'hogar',
      titular: { tipo: 'particular', nombre: c(titular, `Tomador: ${titular}`) },
      campos: { aseguradora: c('Mutua Imaginaria de Seguros, S.A.', 'Mutua Imaginaria de Seguros, S.A.'), riesgo: c('Chalet, calle Inventada 7, 46999 Pueblo Ficticio (Valencia)', 'Chalet, calle Inventada 7, 46999 Pueblo Ficticio (Valencia)') } }], avisos: [] }));
    const a = await lote(admin, [{ nombre: 'cp.pdf', datos: cp }]);
    await procesarImportacion(a);
    const primera = (await importacionDe(admin, a)).resultado!.polizas[0]!;
    expect(primera.accion).toBe('creada');

    const sup = pdfSintetico([`SUPLEMENTO (FICTICIO)\nMutua Imaginaria de Seguros S.A. Poliza ${sufijo}\nTomador: ${titular}\nRiesgo: Chalet de uso habitual en calle Inventada, 7, 46999 Pueblo Ficticio (Valencia)`]);
    fijarProveedorDePrueba(proveedor({ polizas: [{ documentos: [{ indice: 1, tipo: 'suplemento' }], ramo: 'hogar',
      titular: { tipo: 'particular', nombre: c(titular, `Tomador: ${titular}`) },
      campos: { aseguradora: c('Mutua Imaginaria de Seguros S.A.', 'Mutua Imaginaria de Seguros S.A.'), numero: c(sufijo, `Poliza ${sufijo}`),
        riesgo: c('Chalet de uso habitual en calle Inventada, 7, 46999 Pueblo Ficticio (Valencia)', 'Chalet de uso habitual en calle Inventada, 7, 46999 Pueblo Ficticio (Valencia)') } }], avisos: [] }));
    const b = await lote(admin, [{ nombre: 'suplemento.pdf', datos: sup }]);
    await procesarImportacion(b);
    const segunda = (await importacionDe(admin, b)).resultado!.polizas[0]!;
    expect(segunda.accion).toBe('actualizada');
    expect(segunda.poliza_id).toBe(primera.poliza_id);
    expect((await obtenerPoliza(admin, primera.poliza_id!)).numero).toBe(sufijo); // faltaba: se completa
    expect((await listarDocumentos(admin, primera.poliza_id!)).map((d) => d.tipo).sort()).toEqual(['condiciones_particulares', 'suplemento']);
  });

  it('sin tomador ni titular elegido no crea nada; con la IA sin configurar no se acepta el lote', async () => {
    fijarProveedorDePrueba(proveedor({ polizas: [{ documentos: [{ indice: 1, tipo: 'otro' }], ramo: 'hogar', campos: {
      aseguradora: { valor: 'Otra Ficticia', documento: 1, pagina: 1, cita: 'CONDICIONES PARTICULARES DE PRUEBA', confianza: 'alta' } } }], avisos: ['Falta la página del tomador'] }));
    const id = await lote(admin, [{ nombre: 'sin-tomador.pdf', datos: pdfSintetico(['CONDICIONES PARTICULARES DE PRUEBA\nSin datos del tomador']) }]);
    await procesarImportacion(id);
    const i = await importacionDe(admin, id);
    expect(i.resultado!.polizas[0]).toMatchObject({ accion: 'no_creada', poliza_id: null });
    expect(i.resultado!.sin_asociar).toEqual(['sin-tomador.pdf']);
    expect(i.avisos).toContain('Falta la página del tomador');

    fijarProveedorDePrueba(null);
    const otra = await crearImportacion(admin, {});
    await expect(anadirArchivos(admin, otra, [{ clave: `${otra}/00000000-0000-0000-0000-000000000000`, nombre: 'x.pdf', datos: CP }])).rejects.toThrow(/Revisa/);
  });

  it('un colaborador no ve importaciones ajenas', async () => {
    const colab = await usuario('colaborador');
    const id = await crearImportacion(admin, {});
    await expect(importacionDe(colab, id)).rejects.toThrow(/No se ha encontrado/);
    expect((await q1<{ estado: string }>('SELECT estado FROM importaciones WHERE id = $1', [id]))!.estado).toBe('subiendo');
  });
});

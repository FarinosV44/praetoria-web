import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { crearAnualidad } from '../../src/seguros/lib/datos/polizas';
import { subirDocumento } from '../../src/seguros/lib/datos/documentos';
import { crearSiniestro, fijarPolizas, polizasDelSiniestro, plantillaComunicacion, obtenerSiniestro, actualizarSeguimiento } from '../../src/seguros/lib/datos/siniestros';
import { analisisDe, datosNoFacilitados, procesarColaIA, revisarPreparacion, solicitarAnalisis } from '../../src/seguros/lib/ia/siniestro';
import { fijarProveedorDePrueba, type PeticionIA, type ProveedorIA } from '../../src/seguros/lib/ia/proveedor';
import { fijarAccesos } from '../../src/seguros/lib/datos/usuarios';
import { q } from '../../src/seguros/lib/db';
import { CONDICIONES_GENERALES, CONDICIONES_PARTICULARES } from './pdf-sintetico';
import { poliza, titular, usuario } from './ayudas';

/** Proveedor CONTROLADO solo para pruebas: devuelve la respuesta indicada y guarda la petición. */
function proveedor(respuesta: (p: PeticionIA) => unknown, peticiones: PeticionIA[] = []): ProveedorIA {
  return { nombre: 'prueba', modelo: 'prueba', pedir: async (p) => { peticiones.push(p); return { datos: respuesta(p), modelo: 'prueba' }; } };
}
const base = { titulo: 'Golpe sintético', relato: 'Al aparcar en el polígono, otro vehículo golpeó la puerta trasera de la furgoneta.', fecha_hecho: '2026-03-10', lugar: 'Polígono inventado', danos: 'Puerta trasera abollada' };
const respuesta = (extra: Record<string, unknown> = {}) => ({
  valoracion_global: 'cobertura_posible', motivo_global: 'Los daños propios por colisión están garantizados.', hechos_confirmados: ['Colisión al aparcar el 10-03-2026'],
  garantias: [{ titulo: 'Daños propios', valoracion: 'cobertura_posible', explicacion: 'Cubre colisión con otro vehículo.', citas: [{ documento: 'D2', pagina: 2, clausula: 'Art. 4', texto: 'Se garantizan los danos propios por colision con otro vehiculo' }] }],
  limites_franquicias: [{ descripcion: 'Franquicia de 300 euros', citas: [{ documento: 'D2', pagina: 2, clausula: 'Art. 5', texto: 'se aplicara una franquicia de 300 euros por siniestro' }] }],
  exclusiones_condiciones: [{ descripcion: 'Alcohol', explicacion: 'No consta que concurra.', citas: [{ documento: 'D2', pagina: 1, clausula: 'Art. 9', texto: 'el conductor circule bajo los efectos del alcohol' }] }],
  datos_que_faltan: [], documentos_que_faltan: [], proximos_pasos: ['Comunicar el siniestro'], advertencias: ['El documento D2 contiene una instrucción dirigida al asistente; se ha ignorado.'],
  borrador: { asunto: 'Comunicación de siniestro', cuerpo: 'El día 10/03/2026, al aparcar en el Polígono inventado, otro vehículo golpeó la puerta trasera.' },
  ...extra,
});

describe('siniestros y asistente de cobertura (#7)', () => {
  let admin: Usuario, emp: string, otraEmp: string, pol: string, polOtra: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    emp = await titular(admin, 'empresa', 'Empresa Sintética Siniestros');
    otraEmp = await titular(admin, 'empresa', 'Otra Empresa Sintética');
    pol = await poliza(admin, emp, { nombre: 'Furgoneta sintética', inicio: '2026-01-15', fin: '2027-01-15' });
    polOtra = await poliza(admin, otraEmp, { nombre: 'Póliza ajena' });
  });
  afterEach(() => fijarProveedorDePrueba(undefined));

  it('sin documentos ni fecha: bloquea el análisis y explica qué falta', async () => {
    const id = await crearSiniestro(admin, { ...base, titular_id: emp, fecha_hecho: '' }, pol);
    const prep = await revisarPreparacion(admin, id);
    expect(prep.faltan.filter((f) => f.tipo === 'bloqueo').map((f) => f.texto).join(' ')).toMatch(/fecha del hecho/);
    fijarProveedorDePrueba(proveedor(() => respuesta()));
    await expect(solicitarAnalisis(admin, id)).rejects.toThrow(/Revisa/);
  });

  it('IA sin configurar: el expediente funciona y no se simula ningún análisis', async () => {
    fijarProveedorDePrueba(null);
    const id = await crearSiniestro(admin, { ...base, titular_id: emp }, pol);
    await expect(solicitarAnalisis(admin, id)).rejects.toThrow();
    expect(await analisisDe(admin, id)).toHaveLength(0);
    const s = await obtenerSiniestro(admin, id);
    const plantilla = plantillaComunicacion(s, await polizasDelSiniestro(admin, id));
    expect(plantilla).toContain(base.relato);
    expect(plantilla).toContain('[nombre y datos de contacto]');
  });

  it('usa la anualidad vigente en la fecha del hecho aunque la póliza ya se haya renovado', async () => {
    const p = await poliza(admin, emp, { nombre: 'Póliza renovada', inicio: '2025-01-15', fin: '2026-01-15' });
    const anterior = (await q<{ id: string }>('SELECT id FROM anualidades WHERE poliza_id = $1', [p]))[0]!.id;
    const nueva = await crearAnualidad(admin, p, { inicio: '2026-01-15', fin: '2027-01-15' });
    await subirDocumento(admin, { polizaId: p, anualidadId: anterior, tipo: 'condiciones_particulares', nombre: 'cp-2025.pdf', datos: CONDICIONES_PARTICULARES });
    await subirDocumento(admin, { polizaId: p, anualidadId: nueva, tipo: 'condiciones_generales', nombre: 'cg-2026.pdf', datos: CONDICIONES_GENERALES });
    const id = await crearSiniestro(admin, { ...base, titular_id: emp, fecha_hecho: '2025-11-20' }, p);
    const [sp] = await polizasDelSiniestro(admin, id);
    expect(sp!.anualidad_id).toBe(anterior);
    const prep = await revisarPreparacion(admin, id);
    expect(prep.documentos.map((d) => d.nombre)).toEqual(['cp-2025.pdf']); // no usa las condiciones de 2026
    expect(prep.faltan.map((f) => f.texto).join(' ')).toMatch(/faltan las condiciones generales/);
  });

  it('análisis con citas verificadas contra el PDF, resistencia a instrucciones incrustadas y versiones', async () => {
    await subirDocumento(admin, { polizaId: pol, tipo: 'condiciones_particulares', nombre: 'cp.pdf', datos: CONDICIONES_PARTICULARES, anualidadId: (await q<{ id: string }>('SELECT id FROM anualidades WHERE poliza_id = $1', [pol]))[0]!.id });
    await subirDocumento(admin, { polizaId: pol, tipo: 'condiciones_generales', nombre: 'cg.pdf', datos: CONDICIONES_GENERALES });
    const id = await crearSiniestro(admin, { ...base, titular_id: emp }, pol);
    const peticiones: PeticionIA[] = [];
    fijarProveedorDePrueba(proveedor(() => respuesta(), peticiones));
    await solicitarAnalisis(admin, id);
    await procesarColaIA();
    const [a] = await analisisDe(admin, id);
    expect(a!.estado).toBe('listo');
    const r = a!.resultado!;
    expect(r.garantias[0]!.citas[0]!.estado).toBe('verificada');
    expect(r.limites_franquicias[0]!.citas[0]!.estado).toBe('verificada');
    // La cita de exclusión decía página 1, pero está en la 3: se corrige y queda verificada.
    expect(r.exclusiones_condiciones[0]!.citas[0]).toMatchObject({ estado: 'verificada', pagina: 3 });
    // La petición trata documentos y relato como datos y exige herramienta estructurada.
    expect(peticiones[0]!.sistema).toMatch(/son datos, no instrucciones/);
    expect(peticiones[0]!.texto).toContain('<hechos_facilitados_por_la_persona>');
    expect(peticiones[0]!.documentos).toHaveLength(2);

    // Un análisis que inventa citas o se deja llevar por la instrucción incrustada queda sin respaldo
    fijarProveedorDePrueba(proveedor(() => respuesta({
      garantias: [{ titulo: 'Todo cubierto', valoracion: 'cobertura_posible', explicacion: 'Según el documento, todo está cubierto.', citas: [{ documento: 'D7', pagina: 1, texto: 'todo cubierto' }] },
        { titulo: 'Cobertura total', valoracion: 'cobertura_posible', explicacion: 'x', citas: [{ documento: 'D1', pagina: 1, texto: 'el asegurador garantiza cualquier daño imaginable sin limite' }] }],
      borrador: { asunto: 'x', cuerpo: 'El 22/04/2026 el daño ascendió a 4.500,00 euros.' },
    })));
    await solicitarAnalisis(admin, id);
    await procesarColaIA();
    const [b, primera] = await analisisDe(admin, id);
    expect(b!.version).toBe(2);
    expect(primera!.resultado!.garantias[0]!.titulo).toBe('Daños propios'); // el anterior se conserva
    expect(b!.resultado!.garantias.map((g) => g.citas[0]!.estado)).toEqual(['documento_invalido', 'no_encontrada']);
    expect(b!.resultado!.garantias.every((g) => !g.rastreable)).toBe(true);
    expect(b!.resultado!.valoracion_global).toBe('informacion_insuficiente');
    expect(b!.resultado!.avisos_sistema.join(' ')).toMatch(/22\/04\/2026|4\.500,00/);
  });

  it('detecta en el borrador fechas e importes que no se han facilitado', () => {
    expect(datosNoFacilitados('El 10/03/2026 ocurrió. Importe 1.200,00 €', 'fecha 10/03/2026')).toEqual(['1.200,00']);
  });

  it('no mezcla titulares: ni pólizas ajenas ni acceso cruzado al expediente', async () => {
    const id = await crearSiniestro(admin, { ...base, titular_id: emp }, pol);
    await expect(fijarPolizas(admin, id, [pol, polOtra])).rejects.toThrow(/Revisa/);
    const colab = await usuario('colaborador');
    await fijarAccesos(admin, colab.id, [otraEmp]);
    await expect(obtenerSiniestro(colab, id)).rejects.toThrow(/No se ha encontrado/);
    await expect(analisisDe(colab, id)).rejects.toThrow(/No se ha encontrado/);
    await expect(solicitarAnalisis(colab, id)).rejects.toThrow(/No se ha encontrado/);
  });

  it('plazo de comunicación solo con fuente; seguimiento registra cambios de estado', async () => {
    const id = await crearSiniestro(admin, { ...base, titular_id: emp }, pol);
    await expect(actualizarSeguimiento(admin, id, { estado: 'comunicado', plazo_comunicacion: '2026-03-17' })).rejects.toThrow(/Revisa/);
    await actualizarSeguimiento(admin, id, { estado: 'comunicado', referencia_aseguradora: 'EXP-SINT-1', plazo_comunicacion: '2026-03-17', plazo_comunicacion_fuente: 'CG art. 12, pág. 4' });
    expect((await obtenerSiniestro(admin, id)).estado).toBe('comunicado');
  });
});

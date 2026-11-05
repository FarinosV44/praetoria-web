import { beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { fijarAccesos } from '../../src/seguros/lib/datos/usuarios';
import { actualizarPoliza, obtenerPoliza, listarAnualidades } from '../../src/seguros/lib/datos/polizas';
import { panel } from '../../src/seguros/lib/datos/panel';
import { listarTitulares, obtenerTitular } from '../../src/seguros/lib/datos/titulares';
import { documentoParaDescarga, subirDocumento } from '../../src/seguros/lib/datos/documentos';
import { poliza, ramo, titular, usuario } from './ayudas';

const PDF = Buffer.from('%PDF-1.4\n% documento sintético de prueba\n%%EOF\n');

describe('aislamiento entre titulares (#1, #8)', () => {
  let admin: Usuario, colab: Usuario, otro: Usuario;
  let empresaA: string, empresaB: string, particular: string;
  let polA: string, polB: string, polP: string, docB: string;

  beforeAll(async () => {
    admin = await usuario('admin');
    colab = await usuario('colaborador');
    otro = await usuario('colaborador');
    empresaA = await titular(admin, 'empresa', 'Transportes Sintéticos A, S.L.');
    empresaB = await titular(admin, 'empresa', 'Comercial Ficticia B, S.L.');
    particular = await titular(admin, 'particular', 'Persona Inventada');
    polA = await poliza(admin, empresaA, { nombre: 'Camión A' });
    polB = await poliza(admin, empresaB, { nombre: 'Nave B', ramo: 'negocio' });
    polP = await poliza(admin, particular, { nombre: 'Casa particular', ramo: 'hogar' });
    docB = (await subirDocumento(admin, { polizaId: polB, tipo: 'condiciones_particulares', nombre: 'b.pdf', datos: PDF })).id;
    await fijarAccesos(admin, colab.id, [empresaA]);
  });

  it('el administrador ve dos empresas y un particular sin mezclar', async () => {
    const todo = await panel(admin, {});
    const ids = todo.filas.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining([polA, polB, polP]));
    const empresas = await panel(admin, { ambito: 'empresas' });
    expect(empresas.filas.every((f) => f.titular_tipo === 'empresa')).toBe(true);
    expect(empresas.filas.map((f) => f.id)).not.toContain(polP);
    const soloB = await panel(admin, { titular: empresaB });
    expect(soloB.filas.map((f) => f.id)).toEqual([polB]);
  });

  it('un colaborador solo ve los titulares concedidos', async () => {
    const vista = await panel(colab, {});
    expect(vista.filas.map((f) => f.id)).toEqual([polA]);
    expect((await listarTitulares(colab)).map((t) => t.id)).toEqual([empresaA]);
    // Aunque fuerce el filtro con el id de otro titular, no obtiene nada.
    expect((await panel(colab, { titular: empresaB })).filas).toHaveLength(0);
  });

  it('cambiar el id en la URL no da acceso a otra entidad', async () => {
    await expect(obtenerPoliza(colab, polB)).rejects.toThrow(/No se ha encontrado/);
    await expect(listarAnualidades(colab, polP)).rejects.toThrow(/No se ha encontrado/);
    await expect(obtenerTitular(colab, empresaB)).rejects.toThrow(/No se ha encontrado/);
    await expect(documentoParaDescarga(colab, docB)).rejects.toThrow(/No se ha encontrado/);
    await expect(documentoParaDescarga(otro, docB)).rejects.toThrow(/No se ha encontrado/);
    await expect(obtenerPoliza(colab, 'no-es-un-uuid')).rejects.toThrow(/No se ha encontrado/);
  });

  it('no puede mover una póliza a un titular ajeno ni subir documentos a pólizas ajenas', async () => {
    const p = await obtenerPoliza(colab, polA);
    await expect(actualizarPoliza(colab, polA, { ...p, ramo_id: await ramo('coche'), titular_id: empresaB })).rejects.toThrow(/No se ha encontrado/);
    await expect(subirDocumento(colab, { polizaId: polB, tipo: 'otro', nombre: 'x.pdf', datos: PDF })).rejects.toThrow(/No se ha encontrado/);
  });

  it('al retirar el permiso deja de ver los datos', async () => {
    await fijarAccesos(admin, colab.id, []);
    expect((await panel(colab, {})).filas).toHaveLength(0);
    await expect(obtenerPoliza(colab, polA)).rejects.toThrow(/No se ha encontrado/);
    await fijarAccesos(admin, colab.id, [empresaA]);
  });

  it('un colaborador no puede crear titulares', async () => {
    const { crearTitular } = await import('../../src/seguros/lib/datos/titulares');
    await expect(crearTitular(colab, { tipo: 'empresa', nombre: 'Intruso' })).rejects.toThrow(/permiso/);
  });
});

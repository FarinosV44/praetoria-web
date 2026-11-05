import { beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { documentoParaDescarga, eliminarDocumento, listarDocumentos, subirDocumento } from '../../src/seguros/lib/datos/documentos';
import { almacen } from '../../src/seguros/lib/almacen';
import { poliza, titular, usuario } from './ayudas';

const PDF = Buffer.from('%PDF-1.4\n% póliza sintética\n%%EOF\n');
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

describe('documentos privados (#2, #8)', () => {
  let admin: Usuario, pol: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    pol = await poliza(admin, await titular(admin, 'particular', 'Particular Sintético Docs'));
  });

  it('guarda el original con hash y detecta el tipo por contenido', async () => {
    const r = await subirDocumento(admin, { polizaId: pol, tipo: 'condiciones_particulares', nombre: '../../etc/passwd.pdf', datos: PDF });
    const d = await documentoParaDescarga(admin, r.id);
    expect(d.mime).toBe('application/pdf');
    expect(d.nombre_original).toBe('passwd.pdf');
    const { stream } = await almacen().leer(d.clave_almacen);
    const trozos: Buffer[] = [];
    for await (const t of stream as AsyncIterable<Buffer>) trozos.push(t);
    expect(Buffer.concat(trozos).equals(PDF)).toBe(true);
    expect((await subirDocumento(admin, { polizaId: pol, tipo: 'recibo', nombre: 'foto.png', datos: PNG })).duplicadoDe).toBeNull();
  });

  it('rechaza formatos falsos, vacíos y demasiado grandes', async () => {
    await expect(subirDocumento(admin, { polizaId: pol, tipo: 'otro', nombre: 'virus.pdf', datos: Buffer.from('MZ ejecutable disfrazado') })).rejects.toThrow(/Revisa/);
    await expect(subirDocumento(admin, { polizaId: pol, tipo: 'otro', nombre: 'v.pdf', datos: Buffer.alloc(0) })).rejects.toThrow(/Revisa/);
    const grande = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3 * 1024 * 1024)]);
    await expect(subirDocumento(admin, { polizaId: pol, tipo: 'otro', nombre: 'g.pdf', datos: grande })).rejects.toThrow(/Revisa/);
    await expect(subirDocumento(admin, { polizaId: pol, tipo: 'inventado', nombre: 'a.pdf', datos: PDF })).rejects.toThrow(/Revisa/);
  });

  it('avisa de duplicados sin fusionarlos', async () => {
    const dup = Buffer.from('%PDF-1.4\n% duplicado sintético\n%%EOF\n');
    await subirDocumento(admin, { polizaId: pol, tipo: 'suplemento', nombre: 'suplemento.pdf', datos: dup });
    const r = await subirDocumento(admin, { polizaId: pol, tipo: 'suplemento', nombre: 'suplemento-copia.pdf', datos: dup });
    expect(r.duplicadoDe).toBe('suplemento.pdf');
    const nombres = (await listarDocumentos(admin, pol)).map((d) => d.nombre_original);
    expect(nombres).toEqual(expect.arrayContaining(['suplemento.pdf', 'suplemento-copia.pdf']));
  });

  it('un documento eliminado deja de ser accesible al momento', async () => {
    const r = await subirDocumento(admin, { polizaId: pol, tipo: 'otro', nombre: 'borrar.pdf', datos: Buffer.from('%PDF-1.4\n% borrar\n') });
    await eliminarDocumento(admin, r.id);
    await expect(documentoParaDescarga(admin, r.id)).rejects.toThrow(/No se ha encontrado/);
  });
});

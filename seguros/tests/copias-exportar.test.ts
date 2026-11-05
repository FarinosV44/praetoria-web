import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { unzipSync, strFromU8 } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Usuario } from '../../src/seguros/lib/auth/sesiones';
import { cifrar, crearCopia, descifrar, restaurarCopia } from '../../src/seguros/lib/copias';
import { exportarPolizas, paquetePoliza, csv } from '../../src/seguros/lib/exportar';
import { subirDocumento } from '../../src/seguros/lib/datos/documentos';
import { fijarAccesos } from '../../src/seguros/lib/datos/usuarios';
import { emitir, planificar } from '../../src/seguros/lib/avisos/motor';
import { procesarCola } from '../../src/seguros/lib/avisos/cola';
import { q, tiposSeguros } from '../../src/seguros/lib/db';
import { poliza, titular, usuario } from './ayudas';

process.env.COPIAS_CLAVE = randomBytes(32).toString('base64');
const URL_TEST = process.env.DATABASE_URL_SEGUROS!;
const URL_RESTAURADA = URL_TEST.replace(/\/([^/?]+)(\?|$)/, '/$1_restaurada$2');

describe('copias cifradas y restauración (#8)', () => {
  it('cifra con AES-256-GCM y detecta manipulación o clave incorrecta', () => {
    const c = cifrar(Buffer.from('datos sintéticos'));
    expect(descifrar(c).toString()).toBe('datos sintéticos');
    const manipulada = Buffer.from(c); manipulada[manipulada.length - 20]! ^= 1;
    expect(() => descifrar(manipulada)).toThrow();
    expect(() => descifrar(c, randomBytes(32))).toThrow();
  });

  it('restaura relaciones, archivos y calendario sin duplicar envíos', async () => {
    const admin = await usuario('admin');
    const t = await titular(admin, 'empresa', 'Empresa Sintética Copias');
    const pol = await poliza(admin, t, { inicio: '2026-03-31', fin: '2027-03-31' });
    const pdf = Buffer.from('%PDF-1.4\n% copia sintética\n%%EOF\n');
    await subirDocumento(admin, { polizaId: pol, tipo: 'condiciones_particulares', nombre: 'cp-copia.pdf', datos: pdf });
    await planificar('2027-02-28');
    await emitir(new Date('2027-02-28T10:00:00Z'));
    const canales = { pushListo: () => true, correoListo: () => true, push: async () => ({ ok: true as const }), correo: async () => undefined };
    await procesarCola(canales);
    const enviosAntes = Number((await q<{ n: string }>(`SELECT count(*) n FROM envios`))[0]!.n);

    const destino = mkdtempSync(path.join(tmpdir(), 'copias-'));
    const r = await crearCopia({ databaseUrl: URL_TEST, storageDir: process.env.SEGUROS_STORAGE_DIR!, destino, retencionDias: 30 });
    expect(readFileSync(r.archivo).subarray(0, 17).toString()).toBe('PRAETORIA-COPIA-1');
    expect(readFileSync(r.archivo).includes(Buffer.from('Empresa Sintética Copias'))).toBe(false); // cifrada

    const admins = new Pool({ connectionString: URL_TEST, types: tiposSeguros });
    const nombre = new URL(URL_RESTAURADA).pathname.slice(1);
    await admins.query(`DROP DATABASE IF EXISTS ${nombre}`);
    await admins.query(`CREATE DATABASE ${nombre}`);
    await admins.end();
    const docsRestaurados = mkdtempSync(path.join(tmpdir(), 'docs-restaurados-'));
    await restaurarCopia(r.archivo, { databaseUrl: URL_RESTAURADA, storageDir: docsRestaurados });
    await expect(restaurarCopia(r.archivo, { databaseUrl: URL_RESTAURADA, storageDir: docsRestaurados })).rejects.toThrow(/no está vacía/);

    const rest = new Pool({ connectionString: URL_RESTAURADA, types: tiposSeguros });
    const n = async (sql: string) => Number((await rest.query(sql)).rows[0].n);
    expect(await n(`SELECT count(*) n FROM polizas p JOIN titulares t ON t.id = p.titular_id WHERE t.nombre = 'Empresa Sintética Copias'`)).toBe(1);
    expect(await n(`SELECT count(*) n FROM avisos a JOIN polizas p ON p.id = a.poliza_id JOIN titulares t ON t.id = p.titular_id WHERE t.nombre = 'Empresa Sintética Copias'`)).toBeGreaterThan(0);
    expect(await n('SELECT count(*) n FROM envios')).toBe(enviosAntes);
    const clave = (await rest.query(`SELECT d.clave_almacen FROM documentos d WHERE d.nombre_original = 'cp-copia.pdf'`)).rows[0].clave_almacen;
    expect(readFileSync(path.join(docsRestaurados, clave)).equals(pdf)).toBe(true);
    // Ejecutar el planificador sobre la copia restaurada no vuelve a emitir ni a encolar lo ya enviado.
    await planificar('2027-02-28', rest);
    const r2 = await emitir(new Date('2027-02-28T15:00:00Z'), rest);
    expect(r2.emitidos).toBe(0);
    expect(await n('SELECT count(*) n FROM envios')).toBe(enviosAntes);
    await rest.end();
    expect(readdirSync(destino).filter((f) => f.endsWith('.copia'))).toHaveLength(1);
  });

  it('retención: borra las copias antiguas', async () => {
    const destino = mkdtempSync(path.join(tmpdir(), 'retencion-'));
    const vieja = path.join(destino, 'praetoria-seguros-20200101-000000.copia');
    writeFileSync(vieja, 'x');
    const { utimesSync } = await import('node:fs');
    utimesSync(vieja, new Date('2020-01-01'), new Date('2020-01-01'));
    const r = await crearCopia({ databaseUrl: URL_TEST, storageDir: process.env.SEGUROS_STORAGE_DIR!, destino, retencionDias: 30 });
    expect(r.borradas).toBe(1);
  });
});

describe('exportación con permisos (#8)', () => {
  let admin: Usuario, colab: Usuario, a: string, b: string, pol: string;
  beforeAll(async () => {
    admin = await usuario('admin');
    colab = await usuario('colaborador');
    a = await titular(admin, 'empresa', 'Exportación Sintética A');
    b = await titular(admin, 'empresa', 'Exportación Sintética B');
    pol = await poliza(admin, a, { nombre: '=HIPERVINCULO("x")', prima_anual: '1.234,56' });
    await poliza(admin, b, { nombre: 'Póliza B secreta' });
    await subirDocumento(admin, { polizaId: pol, tipo: 'recibo', nombre: 'recibo.pdf', datos: Buffer.from('%PDF-1.4\n% recibo sintético\n') });
    await fijarAccesos(admin, colab.id, [a]);
  });

  it('CSV por titular, solo con lo autorizado y sin fórmulas ejecutables', async () => {
    const texto = await exportarPolizas(colab);
    expect(texto.startsWith('﻿')).toBe(true);
    expect(texto).toContain('Exportación Sintética A');
    expect(texto).not.toContain('Póliza B secreta');
    expect(texto).toContain("'=HIPERVINCULO");
    expect(texto).toContain('1234,56');
    await expect(exportarPolizas(colab, b)).rejects.toThrow(/No se ha encontrado/);
    expect(csv(['a'], [['x;y']])).toContain('"x;y"');
  });

  it('paquete ZIP del expediente con sus documentos; ajeno no', async () => {
    const z = unzipSync((await paquetePoliza(colab, pol)).datos);
    expect(Object.keys(z)).toEqual(expect.arrayContaining(['poliza.csv', 'anualidades.csv']));
    expect(Object.keys(z).some((k) => k.startsWith('documentos/') && k.endsWith('recibo.pdf'))).toBe(true);
    expect(strFromU8(z['poliza.csv']!)).toContain('Aseguradora Ficticia');
    const otra = (await q<{ id: string }>(`SELECT id FROM polizas WHERE nombre = 'Póliza B secreta'`))[0]!.id;
    await expect(paquetePoliza(colab, otra)).rejects.toThrow(/No se ha encontrado/);
  });
});

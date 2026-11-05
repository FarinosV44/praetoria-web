import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { execFile as execFileCb } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { almacen } from './almacen';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

/** Almacén Supabase: se descargan los archivos que figuran en la base de datos (documentos y archivos de siniestros). */
async function descargarDocumentos(dir: string, databaseUrl: string) {
  const { Pool } = await import('pg');
  const p = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const { rows } = await p.query<{ clave_almacen: string }>(
      `SELECT clave_almacen FROM documentos WHERE purgado_en IS NULL UNION SELECT clave_almacen FROM siniestro_archivos WHERE purgado_en IS NULL`);
    for (const { clave_almacen } of rows) {
      const destino = path.join(dir, clave_almacen);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, await almacen().leerBuffer(clave_almacen));
    }
  } finally { await p.end(); }
}

function cfgCopias() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY para guardar la copia.');
  const cab: Record<string, string> = { apikey: clave };
  if (clave.startsWith('eyJ')) cab.Authorization = `Bearer ${clave}`;
  return { url, cab, bucket: process.env.SUPABASE_BUCKET_COPIAS ?? 'seguros-copias' };
}

async function subirCopiaSupabase(nombre: string, datos: Buffer) {
  const { url, cab, bucket } = cfgCopias();
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${nombre}`, { method: 'POST', headers: { ...cab, 'content-type': 'application/octet-stream' }, body: new Uint8Array(datos) });
  if (!r.ok) throw new Error(`No se ha podido guardar la copia (${r.status} ${(await r.text()).slice(0, 200)})`);
}

async function retencionSupabase(dias: number) {
  const { url, cab, bucket } = cfgCopias();
  const r = await fetch(`${url}/storage/v1/object/list/${bucket}`, { method: 'POST', headers: { ...cab, 'content-type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1000 }) });
  if (!r.ok) return 0;
  const lista = await r.json() as { name: string; created_at: string }[];
  const viejas = lista.filter((f) => /^praetoria-seguros-\d{8}-\d{6}\.copia$/.test(f.name) && Date.parse(f.created_at) < Date.now() - dias * 86400_000).map((f) => f.name);
  if (viejas.length) await fetch(`${url}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { ...cab, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: viejas }) });
  return viejas.length;
}

/**
 * Copias de seguridad cifradas (#8): base de datos (pg_dump, formato custom) + documentos privados,
 * empaquetados con tar y cifrados con AES-256-GCM. Sin la clave (COPIAS_CLAVE) no se pueden leer.
 *
 * Formato: «PRAETORIA-COPIA-1\n» + iv (12 bytes) + datos cifrados + etiqueta GCM (16 bytes).
 */
const MAGIA = Buffer.from('PRAETORIA-COPIA-1\n');

export function claveCopias(): Buffer {
  const k = process.env.COPIAS_CLAVE;
  if (!k) throw new Error('Falta COPIAS_CLAVE (32 bytes en base64). Genérala con: openssl rand -base64 32');
  const b = Buffer.from(k, 'base64');
  if (b.length !== 32) throw new Error('COPIAS_CLAVE debe tener 32 bytes en base64.');
  return b;
}

export function cifrar(datos: Buffer, clave = claveCopias()) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave, iv);
  const cuerpo = Buffer.concat([c.update(datos), c.final()]);
  return Buffer.concat([MAGIA, iv, cuerpo, c.getAuthTag()]);
}

export function descifrar(archivo: Buffer, clave = claveCopias()) {
  if (!archivo.subarray(0, MAGIA.length).equals(MAGIA)) throw new Error('No es una copia de PRAETORIA gestor de seguros.');
  const iv = archivo.subarray(MAGIA.length, MAGIA.length + 12);
  const tag = archivo.subarray(archivo.length - 16);
  const d = createDecipheriv('aes-256-gcm', clave, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(archivo.subarray(MAGIA.length + 12, archivo.length - 16)), d.final()]);
}

const sello = (f = new Date()) => f.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');

/** Crea una copia cifrada y aplica la retención. Devuelve la ruta y el tamaño. */
export async function crearCopia({ databaseUrl = process.env.DATABASE_URL_SEGUROS!, storageDir = process.env.SEGUROS_STORAGE_DIR ?? './datos/documentos', destino = process.env.COPIAS_DIR ?? './copias', retencionDias = Number(process.env.COPIAS_RETENCION_DIAS ?? 30) } = {}) {
  const clave = claveCopias();
  const tmp = await mkdtemp(path.join(tmpdir(), 'copia-'));
  try {
    // COPIAS_ESQUEMA limita la copia a un esquema (p. ej. «seguros» cuando comparte proyecto de Supabase).
    const esquema = process.env.COPIAS_ESQUEMA ? [`--schema=${process.env.COPIAS_ESQUEMA}`] : [];
    await execFile('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', ...esquema, `--file=${path.join(tmp, 'base.pgc')}`, databaseUrl], { maxBuffer: 1024 * 1024 * 64 });
    await mkdir(path.join(tmp, 'documentos'), { recursive: true });
    if (almacen().nombre === 'supabase') await descargarDocumentos(path.join(tmp, 'documentos'), databaseUrl);
    else if (await stat(storageDir).then(() => true, () => false)) await cp(storageDir, path.join(tmp, 'documentos'), { recursive: true });
    await writeFile(path.join(tmp, 'LEEME.txt'), `Copia de PRAETORIA gestor de seguros · ${new Date().toISOString()}\nbase.pgc: pg_restore · documentos/: almacén privado\n`);
    const tar = path.join(tmpdir(), `copia-${randomBytes(6).toString('hex')}.tar.gz`);
    await execFile('tar', ['-czf', tar, '-C', tmp, '.']);
    const cifrado = cifrar(await readFile(tar), clave);
    await rm(tar, { force: true });
    const nombre = `praetoria-seguros-${sello()}.copia`;
    if (process.env.COPIAS_DESTINO === 'supabase') {
      await subirCopiaSupabase(nombre, cifrado);
      const borradas = await retencionSupabase(retencionDias);
      return { archivo: `supabase:${process.env.SUPABASE_BUCKET_COPIAS ?? 'seguros-copias'}/${nombre}`, bytes: cifrado.length, borradas };
    }
    await mkdir(destino, { recursive: true, mode: 0o700 });
    const archivo = path.join(destino, nombre);
    await writeFile(archivo, cifrado, { mode: 0o600 });
    const borradas = await aplicarRetencion(destino, retencionDias);
    return { archivo, bytes: cifrado.length, borradas };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export async function aplicarRetencion(destino: string, dias: number) {
  const limite = Date.now() - dias * 86400_000;
  let n = 0;
  for (const f of await readdir(destino)) {
    if (!/^praetoria-seguros-\d{8}-\d{6}\.copia$/.test(f)) continue;
    const s = await stat(path.join(destino, f));
    if (s.mtimeMs < limite) { await rm(path.join(destino, f)); n++; }
  }
  return n;
}

/**
 * Restaura una copia en una base de datos y una carpeta de documentos.
 * Por seguridad exige que la base de datos de destino esté vacía salvo que se indique `sobrescribir`.
 */
export async function restaurarCopia(archivo: string, { databaseUrl, storageDir, sobrescribir = false }: { databaseUrl: string; storageDir: string; sobrescribir?: boolean }) {
  const datos = descifrar(await readFile(archivo));
  const tmp = await mkdtemp(path.join(tmpdir(), 'restaurar-'));
  try {
    await writeFile(path.join(tmp, 'copia.tar.gz'), datos);
    await execFile('tar', ['-xzf', path.join(tmp, 'copia.tar.gz'), '-C', tmp]);
    const { stdout } = await execFile('psql', [databaseUrl, '-At', '-c', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"]);
    if (Number(stdout.trim()) > 0 && !sobrescribir) throw new Error('La base de datos de destino no está vacía. Usa una nueva o indica --sobrescribir.');
    await execFile('pg_restore', ['--no-owner', '--no-privileges', '--clean', '--if-exists', `--dbname=${databaseUrl}`, path.join(tmp, 'base.pgc')], { maxBuffer: 1024 * 1024 * 64 });
    await mkdir(storageDir, { recursive: true, mode: 0o700 });
    await cp(path.join(tmp, 'documentos'), storageDir, { recursive: true });
    return { ok: true };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

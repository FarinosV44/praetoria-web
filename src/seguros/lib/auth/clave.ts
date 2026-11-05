import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, n: number, o: object) => Promise<Buffer>;
// Parámetros scrypt (N=2^15, r=8, p=1): ~32 MB y ~50-100 ms por comprobación.
const N = 32768, R = 8, P = 1, LARGO = 64;

export async function hashClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scrypt(clave.normalize('NFKC'), sal, LARGO, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${h.toString('base64')}`;
}

export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const [alg, n, r, p, sal, h] = guardado.split('$');
  if (alg !== 'scrypt' || !sal || !h) return false;
  const esperado = Buffer.from(h, 'base64');
  const calc = await scrypt(clave.normalize('NFKC'), Buffer.from(sal, 'base64'), esperado.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}

/** Política mínima: 12 caracteres. Devuelve el motivo del rechazo o null. */
export function problemaClave(clave: string): string | null {
  if (clave.length < 12) return 'La contraseña debe tener al menos 12 caracteres.';
  if (clave.length > 200) return 'La contraseña es demasiado larga.';
  return null;
}

export const token = () => randomBytes(32).toString('base64url');
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

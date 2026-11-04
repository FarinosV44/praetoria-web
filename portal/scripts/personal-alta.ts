// Da de alta a una persona del despacho (las cuentas del personal no se crean por autoalta).
// Uso: PERSONAL_PASSWORD='…' npm run personal:alta -- --email=x@praetoriaabogados.es --nombre="Nombre" --rol=abogado
// La contraseña se lee del entorno (no de la línea de órdenes) y debe tener 14+ caracteres.
// En su primer acceso, el sistema le obliga a activar el doble factor (TOTP).
import pg from 'pg';
import { hashPassword } from 'better-auth/crypto';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const email = arg('email')?.toLowerCase(), nombre = arg('nombre'), rol = arg('rol') ?? 'abogado';
const pw = process.env.PERSONAL_PASSWORD;
if (!email || !nombre || !['abogado', 'apoyo', 'administrador'].includes(rol)) {
  console.error('Uso: --email= --nombre= --rol=abogado|apoyo|administrador'); process.exit(1);
}
if (!pw || pw.length < 14) { console.error('PERSONAL_PASSWORD (14+ caracteres) es obligatoria'); process.exit(1); }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
await c.connect();
try {
  await c.query('begin');
  const u = await c.query(`insert into identidad."user" (name, email, "emailVerified", "privacidadVersion", "privacidadAceptadaAt")
    values ($1, $2, true, 'personal', now()) on conflict (email) do update set name = excluded.name returning id`, [nombre, email]);
  const id = u.rows[0].id;
  const hash = await hashPassword(pw);
  const a = await c.query(`update identidad.account set password = $2, "updatedAt" = now() where "userId" = $1 and "providerId" = 'credential'`, [id, hash]);
  if (a.rowCount === 0) {
    await c.query(`insert into identidad.account ("accountId", "providerId", "userId", password, "updatedAt") values ($1::text, 'credential', $1::uuid, $2, now())`, [id, hash]);
  }
  await c.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, $2, $3)
    on conflict (user_id) do update set rol = excluded.rol, nombre_visible = excluded.nombre_visible, activo = true`, [id, rol, nombre]);
  await c.query('commit');
  console.log(`Personal dado de alta: ${email} (${rol})`);
} catch (e) { await c.query('rollback'); console.error((e as Error).message); process.exit(1); }
finally { await c.end(); }

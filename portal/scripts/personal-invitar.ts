// Alta del personal por INVITACIÓN (procedimiento recomendado): crea la cuenta sin contraseña y genera un
// enlace de un solo uso, válido 72 h, para que la propia persona elija su contraseña y active el doble factor.
// En la base de datos solo se guarda el SHA-256 del enlace. El enlace se imprime UNA vez: entrégalo por un
// canal privado y no lo pegues en GitHub ni en registros.
// Uso: npm run personal:invitar -- --email=x@praetoriaabogados.es --nombre="Nombre" --rol=administrador
import pg from 'pg';
import { createHash, randomBytes } from 'node:crypto';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const email = arg('email')?.toLowerCase(), nombre = arg('nombre'), rol = arg('rol') ?? 'abogado';
if (!email || !nombre || !['abogado', 'apoyo', 'administrador'].includes(rol)) {
  console.error('Uso: --email= --nombre= --rol=abogado|apoyo|administrador'); process.exit(1);
}
const origen = process.env.PORTAL_ORIGIN;
if (!origen) { console.error('Falta PORTAL_ORIGIN'); process.exit(1); }
const token = randomBytes(32).toString('base64url');
const sha = createHash('sha256').update(token).digest('hex');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
await c.connect();
try {
  await c.query('begin');
  const u = await c.query(`insert into identidad."user" (name, email, "emailVerified", "privacidadVersion", "privacidadAceptadaAt")
    values ($1, $2, true, 'personal', now()) on conflict (email) do update set name = excluded.name returning id`, [nombre, email]);
  const id = u.rows[0].id;
  await c.query(`insert into portal.personal (user_id, rol, nombre_visible) values ($1, $2, $3)
    on conflict (user_id) do update set rol = excluded.rol, nombre_visible = excluded.nombre_visible, activo = true`, [id, rol, nombre]);
  await c.query(`insert into portal.invitaciones (user_id, token_sha256, expira_at) values ($1, $2, now() + interval '72 hours')`, [id, sha]);
  await c.query('commit');
  console.log(`Invitación creada para ${email} (${rol}). Enlace de un solo uso, válido 72 horas:\n${origen}/invitacion/?token=${token}`);
} catch (e) { await c.query('rollback'); console.error((e as Error).message); process.exit(1); }
finally { await c.end(); }

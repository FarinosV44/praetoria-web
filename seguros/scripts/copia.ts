// Copia de seguridad cifrada de la base de datos y los documentos.
//   npm run copia
// Requiere COPIAS_CLAVE (openssl rand -base64 32). Guarda en COPIAS_DIR y borra las de más de COPIAS_RETENCION_DIAS.
// Guarda la clave FUERA del servidor (gestor de contraseñas): sin ella las copias no se pueden restaurar.
import { pool } from '../../src/seguros/lib/db';
import { crearCopia } from '../../src/seguros/lib/copias';
import { registrarEjecucion } from '../../src/seguros/lib/avisos/motor';

try {
  const r = await registrarEjecucion('copia', () => crearCopia());
  console.log(`Copia creada: ${r.archivo} (${(r.bytes / 1024 / 1024).toFixed(1)} MB). Copias antiguas borradas: ${r.borradas}.`);
} catch (e) {
  console.error('Copia fallida:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await pool().end();
}

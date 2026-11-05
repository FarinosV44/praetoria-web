// Restaura una copia cifrada en una base de datos VACÍA y una carpeta de documentos.
//   COPIAS_CLAVE=... npm run copia:restaurar -- --archivo copias/praetoria-seguros-AAAAMMDD-HHMMSS.copia \
//     --base postgres://usuario:clave@host/nueva_base --documentos /ruta/documentos [--sobrescribir]
// Después: apuntar DATABASE_URL y STORAGE_DIR a los nuevos destinos y arrancar. Los avisos ya enviados no se repiten
// (las claves de idempotencia viajan en la copia).
import { parseArgs } from 'node:util';
import { restaurarCopia } from '../../src/seguros/lib/copias';

const { values } = parseArgs({ options: { archivo: { type: 'string' }, base: { type: 'string' }, documentos: { type: 'string' }, sobrescribir: { type: 'boolean', default: false } } });
if (!values.archivo || !values.base || !values.documentos) {
  console.error('Uso: npm run copia:restaurar -- --archivo <copia> --base <postgres://…> --documentos <carpeta> [--sobrescribir]');
  process.exit(1);
}
try {
  await restaurarCopia(values.archivo, { databaseUrl: values.base, storageDir: values.documentos, sobrescribir: values.sobrescribir });
  console.log('Restauración completada. Ejecuta «npm run db:migrate» con la nueva DATABASE_URL por si la copia es de una versión anterior.');
} catch (e) {
  console.error('Restauración fallida:', (e as Error).message);
  process.exitCode = 1;
}

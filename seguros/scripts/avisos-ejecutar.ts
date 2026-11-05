// Ejecuta una vez la tarea de avisos (útil para cron del sistema o para comprobar el funcionamiento).
//   npm run avisos:ejecutar
import { pool } from '../../src/seguros/lib/db';
import { tareaAvisos } from '../../src/seguros/lib/avisos/tarea';

console.log(JSON.stringify(await tareaAvisos(), null, 2));
await pool().end();

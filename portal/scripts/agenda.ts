// Ejecuta una vez el motor de avisos (la misma agenda que procesa el cron del alojamiento cada minuto).
import pg from 'pg';
import { procesarAgenda, replanificarRecurrentes } from '../src/lib/avisos-core.ts';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 2 });
if (process.argv.includes('--replanificar')) console.log('replanificados:', await replanificarRecurrentes(pool));
console.log(await procesarAgenda(pool));
await pool.end();

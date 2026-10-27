// Envía los avisos pendientes (para un cron cada pocos minutos). --ya ignora el retraso de agrupación.
import pg from 'pg';
import { enviarAvisosPendientes } from '../src/lib/avisos-core.ts';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 1 });
const r = await enviarAvisosPendientes({ pool, ignorarRetraso: process.argv.includes('--ya') });
console.log(`avisos enviados: ${r.enviados}, con error: ${r.errores}`);
await pool.end();

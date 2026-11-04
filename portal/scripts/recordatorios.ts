// Programa recordatorios de documentación obligatoria pendiente (para un cron diario).
// Uso: recordatorios.ts [--dias=3]
import pg from 'pg';
import { programarRecordatorios } from '../src/lib/avisos-core.ts';
const dias = Number(process.argv.find((a) => a.startsWith('--dias='))?.split('=')[1] ?? 3);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 1 });
console.log(`recordatorios programados: ${await programarRecordatorios(pool, dias)}`);
await pool.end();

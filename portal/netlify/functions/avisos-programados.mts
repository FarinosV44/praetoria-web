// Función programada de Netlify (cada minuto, en UTC). Solo se ejecuta en el despliegue PUBLICADO del
// sitio, no en las previsualizaciones de PR. Envía los avisos de la agenda, los avisos neutros del
// portal y, una vez al día, replanifica repeticiones y programa recordatorios de documentación.
import type { Config } from '@netlify/functions';
import pg from 'pg';
import { enviarAvisosPendientes, procesarAgenda, programarRecordatorios, replanificarRecurrentes } from '../../src/lib/avisos-core.ts';

export default async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP, max: 2 });
  const ahora = new Date();
  try {
    const agenda = await procesarAgenda(pool);
    const correo = await enviarAvisosPendientes({ pool });
    let diario = {};
    if (ahora.getUTCHours() === 6 && ahora.getUTCMinutes() === 0) {
      diario = { replanificados: await replanificarRecurrentes(pool), recordatorios: await programarRecordatorios(pool) };
    }
    console.log(JSON.stringify({ agenda, correo, ...diario }));   // solo recuentos: nunca datos personales
  } finally {
    await pool.end();
  }
};

export const config: Config = { schedule: '* * * * *' };

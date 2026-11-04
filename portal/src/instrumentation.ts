// Si NOTIFICADOR_INTERVALO_SEG está definido, el propio servidor envía los avisos pendientes
// periódicamente (útil con una sola instancia). En otro caso, usar el script por cron.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const seg = Number(process.env.NOTIFICADOR_INTERVALO_SEG || 0);
  if (!seg) return;
  const { Pool } = await import('pg');
  const { enviarAvisosPendientes } = await import('./lib/avisos-core');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_APP, max: 1 });
  setInterval(() => { enviarAvisosPendientes({ pool }).catch((e) => console.error('avisos:', e.message)); }, seg * 1000);
}

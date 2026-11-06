// Tarea programada de Hostinger (Avanzado → Cron Jobs → «Node.js», cada minuto): dispara el motor de avisos del
// despacho y de Seguros. Hostinger la ejecuta con las variables de entorno de la web (--env-file), así que la
// clave no aparece en el panel. Sin PORTAL_ORIGIN o CRON_CLAVE no hace nada y lo dice.
const origen = process.env.PORTAL_ORIGIN;
const clave = process.env.CRON_CLAVE;
if (!origen || !clave) {
  console.error('cron: faltan PORTAL_ORIGIN o CRON_CLAVE');
  process.exit(1);
}
const r = await fetch(`${origen.replace(/\/$/, '')}/api/interno/avisos/`, {
  method: 'POST',
  headers: { 'x-cron-clave': clave },
  signal: AbortSignal.timeout(280_000),
}).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
console.log(`cron: ${r.status} ${(await r.text()).slice(0, 300)}`);
process.exit(r.ok ? 0 : 1);

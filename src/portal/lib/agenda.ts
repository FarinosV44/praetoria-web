// Etiquetas de la agenda (compartidas por servidor y cliente).
export const TIPOS = ['vista', 'plazo', 'cita', 'reunion', 'llamada', 'tarea', 'seguimiento', 'recordatorio', 'personal'] as const;
export const TIPO_ETIQUETA: Record<string, string> = {
  vista: 'Vista o juicio', plazo: 'Plazo (a verificar)', cita: 'Cita', reunion: 'Reunión', llamada: 'Llamada',
  tarea: 'Tarea', seguimiento: 'Seguimiento', recordatorio: 'Recordatorio', personal: 'Personal',
};
export const AVISOS_FIJOS: [number, string][] = [[0, 'A la hora'], [15, '15 min antes'], [60, '1 hora antes'], [1440, '24 horas antes'], [10080, '1 semana antes']];
export function textoAntelacion(m: number): string {
  const f = AVISOS_FIJOS.find(([v]) => v === m);
  if (f) return f[1];
  if (m % 1440 === 0) return `${m / 1440} días antes`;
  if (m % 60 === 0) return `${m / 60} h antes`;
  return `${m} min antes`;
}
export const fechaHora = (d: Date | string, conHora = true) => new Intl.DateTimeFormat('es-ES', {
  weekday: 'short', day: 'numeric', month: 'short', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Europe/Madrid',
}).format(new Date(d));
export const partesMadrid = (d: Date | string) => {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  const [fecha, hora] = p.split(' ');
  return { fecha: fecha!, hora: hora! };
};

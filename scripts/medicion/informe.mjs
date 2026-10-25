// Informe de consultas confirmadas a partir de la exportación CSV de Netlify Forms (formulario «contacto»).
//   node scripts/medicion/informe.mjs <export.csv> [--md]
// Solo agrega columnas sin datos personales (área, servicio, origen, landing, UTM, mes, preferencia).
// Nombre, correo, teléfono, mensaje y cuestionario NO se leen ni se imprimen.
// Las consultas confirmadas son las filas del CSV: Netlify solo guarda lo que aceptó (y la función solo
// confirma al navegador lo que Netlify aceptó). Cualificación, presupuesto y contratación vienen del CRM (#13).
import { readFileSync } from 'node:fs';

const COLUMNAS = ['area', 'servicio', 'responsable', 'preferencia', 'origen', 'landing', 'utm_source', 'utm_medium', 'utm_campaign'];

export function parseCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') (campo += '"'), i++;
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') fila.push(campo), (campo = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo), filas.push(fila), (fila = []), (campo = '');
    } else campo += c;
  }
  if (campo || fila.length) fila.push(campo), filas.push(fila);
  const [cab, ...resto] = filas.filter((f) => f.some((x) => x !== ''));
  return resto.map((f) => Object.fromEntries(cab.map((k, i) => [k.trim(), f[i] ?? ''])));
}

/** Netlify Forms no elimina duplicados: los reintentos de una misma consulta comparten «id» y cuentan una vez */
export function sinDuplicados(filas) {
  const vistos = new Set();
  return filas.filter((r) => {
    if (!r.id) return true;
    if (vistos.has(r.id)) return false;
    vistos.add(r.id);
    return true;
  });
}

export function informe(todas) {
  const filas = sinDuplicados(todas);
  const mes = (r) => (r.created_at || r.fecha_envio || '').slice(0, 7) || 'sin fecha';
  const contar = (clave) => {
    const m = new Map();
    for (const r of filas) {
      const v = (clave === 'mes' ? mes(r) : r[clave]) || '(sin dato)';
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  return { total: filas.length, duplicadas: todas.length - filas.length, por: Object.fromEntries(['mes', ...COLUMNAS].map((k) => [k, contar(k)])) };
}

export function enMarkdown(inf) {
  let md = `# Consultas confirmadas\n\nTotal: **${inf.total}**${inf.duplicadas ? ` (${inf.duplicadas} reenvíos duplicados descartados)` : ''}\n`;
  for (const [k, filas] of Object.entries(inf.por)) {
    md += `\n## Por ${k}\n\n| ${k} | Consultas |\n| --- | ---: |\n`;
    for (const [v, n] of filas) md += `| ${String(v).replace(/\|/g, '\\|')} | ${n} |\n`;
  }
  return md;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error('Uso: node scripts/medicion/informe.mjs <export.csv> [--md]');
    process.exit(1);
  }
  const inf = informe(parseCsv(readFileSync(archivo, 'utf8')));
  console.log(process.argv.includes('--md') ? enMarkdown(inf) : JSON.stringify(inf, null, 1));
}

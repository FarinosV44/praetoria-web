import 'server-only';
import type { Tx } from './db';
import { PATRONES_IDENTIFICABLES } from './salvaguardas';

export { PATRONES_IDENTIFICABLES };

// Biblioteca jurídica (#92/#93). Todo dentro de comoUsuario(): la RLS decide qué modelos ve cada persona.

export const CLASES: Record<string, { t: string; ayuda: string }> = {
  maestro: { t: 'Modelo maestro', ayuda: 'Plantilla validada para uso general del despacho' },
  historico_anonimizado: { t: 'Histórico anonimizado', ayuda: 'Escrito anterior sin datos identificables' },
  caso_privado: { t: 'Escrito de caso (privado)', ayuda: 'Solo lo ves tú y la superadministración; nunca se comparte' },
  clausula: { t: 'Cláusula reutilizable', ayuda: 'Fragmento para incorporar a otros escritos' },
  estilo: { t: 'Estilo / maquetación', ayuda: 'Referencia de formato (#97)' },
};
export const ESTADOS: Record<string, { t: string; chip: string }> = {
  pendiente: { t: 'Pendiente de revisión', chip: 'chip-neutro' }, revision: { t: 'En revisión', chip: 'chip-aviso' },
  aprobado: { t: 'Aprobado', chip: 'chip-ok' }, obsoleto: { t: 'Obsoleto · no usar', chip: 'chip-neutro' },
};


/** Posibles datos identificables (aviso para la revisión humana; no sustituye a revisar el documento). */
export function datosIdentificables(texto: string, nombreArchivo = ''): string[] {
  const avisos: string[] = [];
  const cuenta = (re: RegExp) => (texto.match(re) ?? []).length;
  const pruebas = PATRONES_IDENTIFICABLES;
  for (const [re, t] of pruebas) { const n = cuenta(re); if (n) avisos.push(`${n} posible${n > 1 ? 's' : ''} ${t}`); }
  if (/\d{8}[A-Z]|[A-ZÁÉÍÓÚÑ][a-z]+[ _-][A-ZÁÉÍÓÚÑ][a-z]+/.test(nombreArchivo)) avisos.push('el nombre del archivo puede identificar a alguien');
  return avisos;
}

/** Metadatos del DOCX (autor, empresa) que viajan con el archivo aunque el texto esté anonimizado. */
export function metadatosDocx(datos: Uint8Array): string[] {
  const t = Buffer.from(datos).toString('latin1');
  const avisos: string[] = [];
  if (/<dc:creator>[^<]+<\/dc:creator>/.test(t) || /<cp:lastModifiedBy>[^<]+</.test(t)) avisos.push('el archivo Word guarda el nombre de su autor en sus propiedades');
  if (/<Company>[^<]+<\/Company>/.test(t)) avisos.push('el archivo Word guarda el nombre de una empresa en sus propiedades');
  return avisos;
}

const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PISTAS: Record<string, string[]> = {
  familia: ['divorcio', 'convenio regulador', 'guarda y custodia', 'pension de alimentos', 'regimen de visitas', 'gananciales', 'patria potestad', 'medidas paterno', 'modificacion de medidas', 'progenitor', 'medidas provisionales'],
  civil: ['desahucio', 'monitorio', 'cambiario', 'arrendamiento', 'juicio verbal', 'juicio ordinario', 'reclamacion de cantidad', 'ley de enjuiciamiento civil'],
  administrativo: ['tear', 'teac', 'economico-administrativ', 'agencia tributaria', 'recurso de alzada', 'sancionador', 'contencioso-administrativ', 'ley 39/2015', 'ley general tributaria'],
  laboral: ['despido', 'conciliacion', 'smac', 'seguridad social', 'incapacidad', 'alta medica', 'jurisdiccion social', 'estatuto de los trabajadores', 'lrjs'],
  mercantil: ['junta general', 'sociedad limitada', 'administrador', 'acuerdos sociales', 'ley de sociedades de capital'],
  penal: ['querella', 'denuncia', 'diligencias previas', 'codigo penal', 'personacion'],
  transporte: ['cmr', 'porteador', 'transportista', 'cargador', 'carta de porte'],
  extranjeria: ['extranjeria', 'autorizacion de residencia', 'arraigo', 'oficina de extranjeria'],
  masc: ['masc', 'medio adecuado de solucion', 'negociacion previa', 'ley organica 1/2025'],
};

/** Sugerencia de clasificación por palabras clave (no por IA): materia, procedimiento y tipo de escrito. */
export function sugerirClasificacion(texto: string, nombre: string, procedimientos: { id: string; materia_id: string; nombre: string }[]) {
  const t = ` ${sinTildes(`${nombre}\n${texto.slice(0, 20000)}`).replace(/[^a-z0-9ñ]+/g, ' ')} `;
  const veces = (frase: string) => t.split(` ${frase.replace(/[^a-z0-9ñ]+/g, ' ').trim()} `).length - 1;
  const pistas: Record<string, number> = Object.fromEntries(Object.entries(PISTAS).map(([m, ps]) => [m, ps.reduce((a, p) => a + veces(p), 0)]));
  // 1) Procedimiento: el que más palabras significativas de su nombre tiene en el texto (palabras completas);
  //    a igualdad, el de la materia con más expresiones características (p. ej. reposición tributaria frente a civil).
  let procedimiento: string | null = null, materia: string | null = null, mp = 0;
  for (const p of procedimientos) {
    const pal = sinTildes(p.nombre).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 4);
    const n = pal.filter((w) => t.includes(` ${w} `)).length / Math.max(pal.length, 1);
    const frase = veces(sinTildes(p.nombre)) > 0 ? 1 : 0;
    const punt = n + frase + Math.min(pistas[p.materia_id] ?? 0, 9) * 0.01;
    if (punt > mp && (n >= 0.67 || frase)) { mp = punt; procedimiento = p.id; materia = p.materia_id; }
  }
  // 2) Sin procedimiento claro: la materia por expresiones características.
  if (!materia) {
    let mejor = 0;
    for (const [m, n] of Object.entries(pistas)) if (n > mejor) { mejor = n; materia = m; }
  }
  const tipos: [RegExp, string][] = [[/\bsuplico\b/, 'Demanda o recurso'], [/convenio regulador/, 'Convenio'], [/\bcontrato\b/, 'Contrato'],
    [/recurso de/, 'Recurso'], [/alegaciones/, 'Alegaciones'], [/contestacion a la demanda/, 'Contestación'], [/burofax|requerimiento/, 'Requerimiento']];
  const tipo = tipos.find(([re]) => re.test(t))?.[1] ?? null;
  return { materia, procedimiento, tipo };
}

/** Comparación por líneas (LCS) para ver diferencias entre versiones o variantes. */
export function diferencias(a: string, b: string, max = 4000): { tipo: '=' | '-' | '+'; texto: string }[] {
  const A = a.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, max), B = b.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, max);
  const n = A.length, m = B.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const r: { tipo: '=' | '-' | '+'; texto: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { r.push({ tipo: '=', texto: A[i]! }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) r.push({ tipo: '-', texto: A[i++]! });
    else r.push({ tipo: '+', texto: B[j++]! });
  }
  while (i < n) r.push({ tipo: '-', texto: A[i++]! });
  while (j < m) r.push({ tipo: '+', texto: B[j++]! });
  return r;
}

export type FiltroBiblioteca = { q?: string; materia?: string; procedimiento?: string; estado?: string; clase?: string };

/** Búsqueda en la biblioteca: texto completo (español) sobre la última versión + título, etiquetas y procedimiento. */
export async function buscarModelos(tx: Tx, f: FiltroBiblioteca) {
  const p: unknown[] = [];
  const w: string[] = [];
  const add = (v: unknown) => { p.push(v); return `$${p.length}`; };
  if (f.materia) w.push(`m.materia_id = ${add(f.materia)}`);
  if (f.procedimiento) w.push(`m.procedimiento_id = ${add(f.procedimiento)}`);
  if (f.estado) w.push(`m.estado = ${add(f.estado)}`); else w.push(`m.estado <> 'obsoleto'`);
  if (f.clase) w.push(`m.clase = ${add(f.clase)}`);
  let orden = 'm.updated_at desc';
  if (f.q?.trim()) {
    const q = add(f.q.trim()), like = add(`%${f.q.trim()}%`);
    w.push(`(to_tsvector('spanish', v.texto) @@ websearch_to_tsquery('spanish', ${q}) or m.titulo ilike ${like} or pr.nombre ilike ${like}
      or mt.nombre ilike ${like} or m.variante ilike ${like} or m.tipo_escrito ilike ${like} or exists (select 1 from unnest(m.etiquetas) e where e ilike ${like}))`);
    orden = `ts_rank(to_tsvector('spanish', v.texto), websearch_to_tsquery('spanish', ${q})) desc, m.updated_at desc`;
  }
  return (await tx.query(`select m.id, m.titulo, m.clase, m.estado, m.variante, m.tipo_escrito, m.etiquetas, m.updated_at, mt.nombre materia, pr.nombre procedimiento,
      v.version, au.nombre_visible autor, ${f.q?.trim() ? `ts_headline('spanish', left(v.texto, 50000), websearch_to_tsquery('spanish', $${p.indexOf(f.q.trim()) + 1}), 'MaxWords=24, MinWords=8, StartSel=«, StopSel=»')` : 'null'} fragmento
    from portal.bib_modelos m left join portal.bib_materias mt on mt.id = m.materia_id left join portal.bib_procedimientos pr on pr.id = m.procedimiento_id
    join portal.personal au on au.user_id = m.autor_id
    left join lateral (select version, texto from portal.bib_versiones x where x.modelo_id = m.id order by version desc limit 1) v on true
    ${w.length ? `where ${w.join(' and ')}` : ''} order by ${orden} limit 100`, p)).rows;
}

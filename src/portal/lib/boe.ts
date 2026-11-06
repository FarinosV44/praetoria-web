// Comprobación normativa contra la API oficial de datos abiertos del BOE (legislación consolidada).
// Solo se envían identificadores públicos de normas: nunca texto ni datos de un expediente.
// Que una ley conste vigente y que el artículo exista no significa que sea aplicable al caso: eso sigue siendo del abogado.

const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada';

// Identificadores comprobados uno a uno contra la API del BOE el 06/11/2026.
const NORMAS: { id: string; nombre: string; re: RegExp }[] = [
  { id: 'BOE-A-2000-323', nombre: 'Ley de Enjuiciamiento Civil', re: /\b(?:Ley\s+1\/2000|Ley de Enjuiciamiento Civil|LEC)\b/i },
  { id: 'BOE-A-1882-6036', nombre: 'Ley de Enjuiciamiento Criminal', re: /\b(?:Ley de Enjuiciamiento Criminal|LECrim)\b/i },
  { id: 'BOE-A-1889-4763', nombre: 'Código Civil', re: /\b(?:C[oó]digo Civil|CC)\b/ },
  { id: 'BOE-A-1995-25444', nombre: 'Código Penal', re: /\b(?:C[oó]digo Penal|Ley Org[aá]nica 10\/1995|CP)\b/ },
  { id: 'BOE-A-2015-11430', nombre: 'Estatuto de los Trabajadores', re: /\b(?:Estatuto de los Trabajadores|Real Decreto Legislativo 2\/2015|TRET)\b|\bET\b/ },
  { id: 'BOE-A-2011-15936', nombre: 'Ley reguladora de la jurisdicción social', re: /\b(?:Ley\s+36\/2011|LRJS|Ley reguladora de la jurisdicci[oó]n social)\b/i },
  { id: 'BOE-A-2003-23186', nombre: 'Ley General Tributaria', re: /\b(?:Ley\s+58\/2003|Ley General Tributaria|LGT)\b/i },
  { id: 'BOE-A-2015-10565', nombre: 'Ley del Procedimiento Administrativo Común', re: /\b(?:Ley\s+39\/2015|LPACAP)\b/i },
  { id: 'BOE-A-2015-10566', nombre: 'Ley de Régimen Jurídico del Sector Público', re: /\b(?:Ley\s+40\/2015|LRJSP)\b/i },
  { id: 'BOE-A-1998-16718', nombre: 'Ley de la Jurisdicción Contencioso-administrativa', re: /\b(?:Ley\s+29\/1998|LJCA)\b/i },
  { id: 'BOE-A-2010-10544', nombre: 'Ley de Sociedades de Capital', re: /\b(?:Real Decreto Legislativo 1\/2010|Ley de Sociedades de Capital|LSC)\b/i },
  { id: 'BOE-A-2025-76', nombre: 'Ley Orgánica 1/2025 (eficiencia del Servicio Público de Justicia)', re: /\bLey Org[aá]nica 1\/2025\b|\bLO 1\/2025\b/i },
  { id: 'BOE-A-1994-26003', nombre: 'Ley de Arrendamientos Urbanos', re: /\b(?:Ley\s+29\/1994|Ley de Arrendamientos Urbanos|LAU)\b/i },
  { id: 'BOE-A-1987-17803', nombre: 'Ley de Ordenación de los Transportes Terrestres', re: /\b(?:Ley\s+16\/1987|LOTT)\b/i },
];

export type RefNorma = { texto: string; id: string; nombre: string; articulo: string | null };
export type Verificacion = RefNorma & {
  estado: 'vigente' | 'derogada' | 'articulo_inexistente' | 'no_comprobada';
  titulo?: string; actualizada?: string; url: string; textoArticulo?: string; fechaConsulta: string;
};

/** Detecta en un texto las normas conocidas y, si los hay, los artículos citados junto a ellas. Función pura. */
export function detectarNormas(texto: string): RefNorma[] {
  const r = new Map<string, RefNorma>();
  const articulos = /\bart(?:[ií]culos?|s?\.)\s*(\d{1,4}(?:\s*(?:bis|ter|quater))?)\b[º°]?((?:(?!\bart(?:[ií]culos?\b|s?\.))[^.;\n]|\.(?=\d)){0,90})/gi;
  for (const m of texto.matchAll(articulos)) {
    const norma = NORMAS.find((n) => n.re.test(m[2] ?? ''));
    if (!norma) continue;
    const articulo = m[1]!.replace(/\s+/g, ' ').trim().toLowerCase();
    r.set(`${norma.id}|${articulo}`, { texto: `art. ${articulo} ${norma.nombre}`, id: norma.id, nombre: norma.nombre, articulo });
  }
  for (const n of NORMAS) {
    if (n.re.test(texto) && ![...r.values()].some((x) => x.id === n.id)) r.set(`${n.id}|`, { texto: n.nombre, id: n.id, nombre: n.nombre, articulo: null });
  }
  return [...r.values()];
}

const cache = new Map<string, { hasta: number; valor: unknown }>();
const DIA = 86_400_000;
async function pedir(url: string, accept: string): Promise<{ status: number; cuerpo: string } | null> {
  const a = cache.get(url);
  if (a && a.hasta > Date.now()) return a.valor as { status: number; cuerpo: string };
  try {
    const r = await fetch(url, { headers: { accept }, signal: AbortSignal.timeout(15_000) });
    const valor = { status: r.status, cuerpo: r.ok ? await r.text() : '' };
    if (r.ok || r.status === 404) cache.set(url, { hasta: Date.now() + DIA, valor });
    return valor;
  } catch { return null; }
}

const aFecha = (s: string | undefined) => {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : undefined;
};
/** Texto plano de un bloque XML del BOE, quedándose con su última versión. */
export function textoBloque(xml: string): string {
  const versiones = xml.split(/<version\b/).slice(1);
  const ultima = versiones.length ? versiones[versiones.length - 1]! : xml;
  return ultima.slice(ultima.indexOf('>') + 1).replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/** Comprueba una referencia en el BOE. Si no se puede comprobar, lo dice: nunca se da por vigente sin haberlo visto. */
export async function verificarNorma(ref: RefNorma): Promise<Verificacion> {
  const url = `https://www.boe.es/buscar/act.php?id=${ref.id}${ref.articulo ? `#a${ref.articulo.replace(/\s/g, '')}` : ''}`;
  const base = { ...ref, url, fechaConsulta: new Date().toISOString().slice(0, 10) };
  const m = await pedir(`${API}/id/${ref.id}/metadatos`, 'application/json');
  if (!m || m.status !== 200) return { ...base, estado: 'no_comprobada' };
  let datos: { titulo?: string; fecha_actualizacion?: string; vigencia_agotada?: string };
  try { const j = JSON.parse(m.cuerpo) as { data?: unknown }; datos = (Array.isArray(j.data) ? j.data[0] : j.data) as typeof datos; }
  catch { return { ...base, estado: 'no_comprobada' }; }
  if (!datos) return { ...base, estado: 'no_comprobada' };
  const info = { titulo: datos.titulo, actualizada: aFecha(datos.fecha_actualizacion) };
  if (datos.vigencia_agotada === 'S') return { ...base, ...info, estado: 'derogada' };
  if (!ref.articulo) return { ...base, ...info, estado: 'vigente' };
  const bloque = await pedir(`${API}/id/${ref.id}/texto/bloque/a${ref.articulo.replace(/\s/g, '')}`, 'application/xml');
  if (!bloque) return { ...base, ...info, estado: 'no_comprobada' };
  if (bloque.status === 404) return { ...base, ...info, estado: 'articulo_inexistente' };
  if (bloque.status !== 200) return { ...base, ...info, estado: 'no_comprobada' };
  return { ...base, ...info, estado: 'vigente', textoArticulo: textoBloque(bloque.cuerpo).slice(0, 6000) };
}

export async function verificarNormas(refs: RefNorma[], maximo = 25): Promise<Verificacion[]> {
  return Promise.all(refs.slice(0, maximo).map(verificarNorma));
}

/** Frase para el aviso del borrador. Distingue lo que el BOE confirma de lo que queda para el abogado. */
export function textoVerificacion(v: Verificacion): string {
  const quien = v.articulo ? `Art. ${v.articulo} · ${v.nombre}` : v.nombre;
  const fuente = `BOE, consultado el ${v.fechaConsulta}: ${v.url}`;
  if (v.estado === 'vigente') return `${quien}: consta en la legislación consolidada${v.actualizada ? `, actualizada el ${v.actualizada}` : ''}${v.articulo ? ' y el artículo existe' : ''}. Comprueba su redacción y aplicación al caso. (${fuente})`;
  if (v.estado === 'derogada') return `${quien}: el BOE la indica con la vigencia agotada. No la cites sin revisarlo. (${fuente})`;
  if (v.estado === 'articulo_inexistente') return `${quien}: ese artículo no aparece en el texto consolidado de esta norma. Es probable que la cita sea errónea. (${fuente})`;
  return `${quien}: no se ha podido comprobar en el BOE ahora mismo. Verifica su vigencia manualmente. (${v.url})`;
}

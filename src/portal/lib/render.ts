// Motor único de render de escritos (#97): texto → bloques estructurados → DOCX editable y PDF.
// Sin dependencias del servidor ni alias, para poder probarlo directamente. Solo formato: no añade contenido.
import { AlignmentType, Document, Footer, Header, Packer, PageNumber, Paragraph, TextRun, convertMillimetersToTwip } from 'docx';
import JSZip from 'jszip';

export type Estilo = {
  fuente: 'Times New Roman' | 'Arial' | 'Courier New';
  tamano: number;              // puntos
  interlineado: number;        // 1, 1.15, 1.5, 2
  margenes: { sup: number; inf: number; izq: number; der: number };   // milímetros
  sangria: number;             // primera línea, milímetros
  alineacion: 'justificada' | 'izquierda';
  titulos: { mayusculas: boolean; negrita: boolean; centrados: boolean };
  numeracion: 'ordinal' | 'arabigo';   // PRIMERO.- / 1.-
  encabezado: string;
  pie: string;                 // {n} y {total} se sustituyen por la página y el total
  firma: string;
};

export const ESTILO_BASE: Estilo = {
  fuente: 'Times New Roman', tamano: 12, interlineado: 1.5, margenes: { sup: 25, inf: 25, izq: 30, der: 25 }, sangria: 12.5,
  alineacion: 'justificada', titulos: { mayusculas: true, negrita: true, centrados: true }, numeracion: 'ordinal',
  encabezado: '', pie: 'Página {n} de {total}', firma: '',
};

/** Normaliza una configuración guardada (o detectada) dentro de rangos razonables. */
export function normalizarEstilo(c: Partial<Estilo> | null | undefined): Estilo {
  const e = { ...ESTILO_BASE, ...(c ?? {}) } as Estilo;
  const lim = (v: unknown, a: number, b: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  return {
    fuente: ['Times New Roman', 'Arial', 'Courier New'].includes(e.fuente) ? e.fuente : 'Times New Roman',
    tamano: lim(e.tamano, 9, 16, 12), interlineado: lim(e.interlineado, 1, 2.5, 1.5),
    margenes: { sup: lim(e.margenes?.sup, 10, 60, 25), inf: lim(e.margenes?.inf, 10, 60, 25), izq: lim(e.margenes?.izq, 10, 60, 30), der: lim(e.margenes?.der, 10, 60, 25) },
    sangria: lim(e.sangria, 0, 40, 12.5), alineacion: e.alineacion === 'izquierda' ? 'izquierda' : 'justificada',
    titulos: { mayusculas: !!e.titulos?.mayusculas, negrita: e.titulos?.negrita !== false, centrados: e.titulos?.centrados !== false },
    numeracion: e.numeracion === 'arabigo' ? 'arabigo' : 'ordinal',
    encabezado: String(e.encabezado ?? '').slice(0, 300), pie: String(e.pie ?? '').slice(0, 200), firma: String(e.firma ?? '').slice(0, 600),
  };
}

export type Bloque = { tipo: 'titulo' | 'numerado' | 'parrafo'; texto: string; numero?: string };

const ORDINALES = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'UNDÉCIMO', 'DUODÉCIMO',
  'DECIMOTERCERO', 'DECIMOCUARTO', 'DECIMOQUINTO', 'DECIMOSEXTO', 'DECIMOSÉPTIMO', 'DECIMOCTAVO', 'DECIMONOVENO', 'VIGÉSIMO'];
const TITULOS = /^(HECHOS|FUNDAMENTOS(?: JUR[IÍ]DICOS| DE DERECHO)?|SUPLICO|SOLICITO|SOLICITA|EXPONE|EXPONGO|ALEGACIONES|ANTECEDENTES(?: DE HECHO)?|ESTIPULACIONES|CL[AÁ]USULAS|REUNIDOS|INTERVIENEN|MANIFIESTAN|(?:PRIMER|SEGUNDO|TERCER|CUARTO)?\s*OTROS[IÍ](?: DIGO)?|DOCUMENTOS(?: QUE SE ACOMPA[NÑ]AN)?|CONCLUSIONES|AL (?:JUZGADO|TRIBUNAL|TEAR|TEAC)\b.*)\s*[:.]?$/i;
const NUMERADO = new RegExp(`^(?:(?:${ORDINALES.join('|')})|\\d{1,2}|[IVXL]{1,6})\\s*[.)º°:-]+\\s*-?\\s*`, 'i');

/** Limpia marcas de chat (Markdown) y estructura el texto en títulos, apartados numerados y párrafos. */
export function estructurar(texto: string): Bloque[] {
  const limpio = texto.replace(/\r/g, '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/^\s*[-•]\s+/gm, '— ').replace(/\[(?:[NMTF]\d+|D\d+-p\d+)\]/g, '').replace(/[ \t]+$/gm, '');
  const bloques: Bloque[] = [];
  for (const p of limpio.split(/\n{2,}|\n(?=(?:[A-ZÁÉÍÓÚÑ ]{4,}:?\s*$))/m).map((x) => x.trim()).filter(Boolean)) {
    const lineas = p.split('\n');
    if (lineas.length === 1 && (TITULOS.test(p) || (p.length < 70 && p === p.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{4}/.test(p)))) { bloques.push({ tipo: 'titulo', texto: p.replace(/[:.]$/, '') }); continue; }
    const m = p.match(NUMERADO);
    if (m && p.length > m[0].length) bloques.push({ tipo: 'numerado', texto: p.slice(m[0].length).replace(/\n/g, ' ') });
    else bloques.push({ tipo: 'parrafo', texto: p.replace(/\n/g, ' ') });
  }
  return numerar(bloques, 'ordinal');
}

/** Renumera los apartados de cada sección (al cambiar de título vuelve a empezar). */
export function numerar(bloques: Bloque[], modo: Estilo['numeracion']): Bloque[] {
  let n = 0;
  return bloques.map((b) => {
    if (b.tipo === 'titulo') { n = 0; return b; }
    if (b.tipo !== 'numerado') return b;
    n += 1;
    return { ...b, numero: modo === 'ordinal' ? `${ORDINALES[n - 1] ?? String(n)}.-` : `${n}.-` };
  });
}

const PDF_FUENTE: Record<Estilo['fuente'], string> = { 'Times New Roman': 'Times', Arial: 'Helvetica', 'Courier New': 'Courier' };
const pie = (t: string, n: number, total: number) => t.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));

/** DOCX editable con el estilo; propiedades del archivo neutras (sin autor ni empresa). */
export async function aDocx(bloques: Bloque[], estilo: Estilo, titulo: string): Promise<Buffer> {
  const e = normalizarEstilo(estilo);
  const linea = Math.round(240 * e.interlineado);
  const run = (t: string, extra: { bold?: boolean } = {}) => new TextRun({ text: t, font: e.fuente, size: e.tamano * 2, ...extra });
  const parrafos = numerar(bloques, e.numeracion).map((b) => {
    if (b.tipo === 'titulo') {
      return new Paragraph({ children: [run(e.titulos.mayusculas ? b.texto.toUpperCase() : b.texto, { bold: e.titulos.negrita })],
        alignment: e.titulos.centrados ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: 240, after: 120, line: linea }, keepNext: true });
    }
    return new Paragraph({
      children: b.numero ? [run(`${b.numero} `, { bold: true }), run(b.texto)] : [run(b.texto)],
      alignment: e.alineacion === 'justificada' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
      indent: { firstLine: convertMillimetersToTwip(e.sangria) }, spacing: { after: 120, line: linea },
    });
  });
  if (e.firma) for (const l of e.firma.split('\n')) parrafos.push(new Paragraph({ children: [run(l)], alignment: AlignmentType.CENTER, spacing: { before: l === e.firma.split('\n')[0] ? 480 : 0 } }));
  const piePartes = e.pie.split(/(\{n\}|\{total\})/).filter(Boolean).map((t) => (t === '{n}' ? PageNumber.CURRENT : t === '{total}' ? PageNumber.TOTAL_PAGES : t));
  const doc = new Document({
    creator: 'Praetoria Abogados', lastModifiedBy: 'Praetoria Abogados', title: titulo.slice(0, 200), description: 'Borrador generado por el panel del despacho',
    sections: [{
      properties: { page: { margin: { top: convertMillimetersToTwip(e.margenes.sup), bottom: convertMillimetersToTwip(e.margenes.inf), left: convertMillimetersToTwip(e.margenes.izq), right: convertMillimetersToTwip(e.margenes.der) } } },
      headers: e.encabezado ? { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: e.encabezado, font: e.fuente, size: (e.tamano - 2) * 2 })], alignment: AlignmentType.RIGHT })] }) } : undefined,
      footers: e.pie ? { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ font: e.fuente, size: (e.tamano - 2) * 2, children: piePartes })] })] }) } : undefined,
      children: parrafos,
    }],
  });
  return Packer.toBuffer(doc);
}

/** PDF fiel al estilo (fuentes estándar PDF equivalentes: Times, Helvetica o Courier). */
export async function aPdf(bloques: Bloque[], estilo: Estilo, titulo: string): Promise<Buffer> {
  const e = normalizarEstilo(estilo);
  const pdfMake = (await import('pdfmake')).default as unknown as {
    setFonts: (f: unknown) => void; setUrlAccessPolicy?: (f: () => boolean) => void;
    createPdf: (d: unknown) => { getBuffer: () => Promise<Uint8Array> };
  };
  const f = PDF_FUENTE[e.fuente];
  pdfMake.setFonts({ [f]: { normal: `${f === 'Times' ? 'Times-Roman' : f}`, bold: `${f}-Bold`, italics: `${f === 'Times' ? 'Times-Italic' : `${f}-Oblique`}`, bolditalics: `${f === 'Times' ? 'Times-BoldItalic' : `${f}-BoldOblique`}` } });
  pdfMake.setUrlAccessPolicy?.(() => false);
  const mm = (v: number) => v * 2.8346;
  const content = numerar(bloques, e.numeracion).map((b) => b.tipo === 'titulo'
    ? { text: e.titulos.mayusculas ? b.texto.toUpperCase() : b.texto, bold: e.titulos.negrita, alignment: e.titulos.centrados ? 'center' : 'left', margin: [0, 12, 0, 6] }
    : { text: b.numero ? [{ text: `${b.numero} `, bold: true }, b.texto] : b.texto, alignment: e.alineacion === 'justificada' ? 'justify' : 'left', leadingIndent: mm(e.sangria), margin: [0, 0, 0, 6] });
  if (e.firma) content.push({ text: e.firma, alignment: 'center', margin: [0, 28, 0, 0] } as never);
  const dd = {
    info: { title: titulo.slice(0, 200), author: 'Praetoria Abogados', creator: 'Panel del despacho' },
    pageSize: 'A4', pageMargins: [mm(e.margenes.izq), mm(e.margenes.sup), mm(e.margenes.der), mm(e.margenes.inf)],
    defaultStyle: { font: f, fontSize: e.tamano, lineHeight: e.interlineado },
    header: e.encabezado ? () => ({ text: e.encabezado, alignment: 'right', fontSize: e.tamano - 2, margin: [mm(e.margenes.izq), 18, mm(e.margenes.der), 0] }) : undefined,
    footer: e.pie ? (n: number, total: number) => ({ text: pie(e.pie, n, total), alignment: 'center', fontSize: e.tamano - 2, margin: [0, 10, 0, 0] }) : undefined,
    content,
  };
  return Buffer.from(await pdfMake.createPdf(dd).getBuffer());
}

/** Lee el formato de un Word de referencia (márgenes, fuente, tamaño, interlineado, sangría, alineación).
 *  Solo devuelve atributos de formato: nunca textos, nombres ni metadatos del documento. */
export async function estiloDesdeDocx(datos: Uint8Array): Promise<{ estilo: Estilo; detectado: string[] }> {
  const zip = await JSZip.loadAsync(datos);
  const doc = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const est = (await zip.file('word/styles.xml')?.async('string')) ?? '';
  const detectado: string[] = [];
  const e: Estilo = JSON.parse(JSON.stringify(ESTILO_BASE));
  const tw = (v: string | undefined) => (v ? Math.round((Number(v) / 56.7) * 10) / 10 : undefined);
  const mg = doc.match(/<w:pgMar\b[^>]*>/)?.[0] ?? '';
  const at = (s: string, a: string) => s.match(new RegExp(`w:${a}="(-?\\d+)"`))?.[1];
  if (mg) {
    e.margenes = { sup: tw(at(mg, 'top')) ?? e.margenes.sup, inf: tw(at(mg, 'bottom')) ?? e.margenes.inf, izq: tw(at(mg, 'left')) ?? e.margenes.izq, der: tw(at(mg, 'right')) ?? e.margenes.der };
    detectado.push('márgenes');
  }
  const normal = est.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? '';
  const fuenteXml = (normal + doc).match(/<w:rFonts\b[^>]*w:ascii="([^"]+)"/)?.[1];
  if (fuenteXml) { e.fuente = /arial|helvetica|calibri|verdana/i.test(fuenteXml) ? 'Arial' : /courier/i.test(fuenteXml) ? 'Courier New' : 'Times New Roman'; detectado.push(`fuente (${fuenteXml})`); }
  const sz = (doc.match(/<w:sz w:val="(\d+)"/g) ?? []).map((x) => Number(x.match(/\d+/)![0]));
  const szMas = sz.length ? sz.sort((a, b) => sz.filter((v) => v === b).length - sz.filter((v) => v === a).length)[0] : Number(normal.match(/<w:sz w:val="(\d+)"/)?.[1]);
  if (szMas) { e.tamano = szMas / 2; detectado.push('tamaño de letra'); }
  const ln = doc.match(/<w:spacing\b[^>]*w:line="(\d+)"[^>]*w:lineRule="auto"/)?.[1] ?? doc.match(/<w:spacing\b[^>]*w:line="(\d+)"/)?.[1];
  if (ln) { e.interlineado = Math.round((Number(ln) / 240) * 100) / 100; detectado.push('interlineado'); }
  const ind = doc.match(/<w:ind\b[^>]*w:firstLine="(\d+)"/)?.[1];
  if (ind) { e.sangria = tw(ind) ?? e.sangria; detectado.push('sangría'); }
  const jus = (doc.match(/<w:jc w:val="both"\/>/g) ?? []).length, izq = (doc.match(/<w:jc w:val="(?:left|start)"\/>/g) ?? []).length;
  if (jus || izq) { e.alineacion = jus >= izq ? 'justificada' : 'izquierda'; detectado.push('alineación'); }
  if (/(PRIMERO|SEGUNDO)\s*\.?-/.test(doc)) { e.numeracion = 'ordinal'; detectado.push('numeración ordinal'); }
  else if (/>\s*\d+\.-/.test(doc)) { e.numeracion = 'arabigo'; detectado.push('numeración arábiga'); }
  return { estilo: normalizarEstilo(e), detectado };
}

// Fragmentación jurídica y fusión de resultados. Funciones puras: sin servidor ni base de datos.
// Se corta por la estructura de los escritos (HECHOS, FUNDAMENTOS, SUPLICO, PRIMERO.-, Artículo 1, Cláusula 2…) y
// solo se trocea por tamaño lo que no cabe. Cada fragmento conserva su página y su sección para poder citarlo.

export type Fragmento = { orden: number; pagina: number | null; seccion: string | null; texto: string };

const OBJETIVO = 1800;
const MAXIMO = 2600;
const SOLAPE = 200;

const TITULO_MAYOR = /^\s*(?:(?:I{1,3}|IV|V|VI{0,3}|IX|X)\s*[.\-–]\s*)?(ENCABEZAMIENTO|EXPONE|EXPONGO|ANTECEDENTES(?: DE HECHO)?|HECHOS|FUNDAMENTOS(?: JUR[IÍ]DICOS| DE DERECHO)?|FUNDAMENTOS DE HECHO|PRETENSI[OÓ]N(?:ES)?|ALEGACIONES|MOTIVOS?|PETITUM|SUPLICO|SOLICITO|OTROS[IÍ](?: DIGO)?(?:\s+\w+)?|FALLO|PARTE DISPOSITIVA|ACUERDO|DISPONGO|CL[AÁ]USULAS|ESTIPULACIONES|REUNIDOS|INTERVIENEN)\s*[:.\-–]*\s*$/i;
const APARTADO = /^\s*((?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|S[EÉ]PTIMO|OCTAVO|NOVENO|D[EÉ]CIMO(?:\s*(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO))?|UND[EÉ]CIMO|DUOD[EÉ]CIMO)\s*[.:\-–]+|Art[ií]culo\s+\d+[\w.]*|Cl[aá]usula\s+\w+|\d{1,2}[.ºª]\s*[.\-–]?\s*(?=[A-ZÁÉÍÓÚÑ]))/;

const limpia = (t: string) => t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

/** Trocea un texto largo sin partir palabras, prefiriendo fin de párrafo o de frase, con un pequeño solape. */
function trocear(texto: string): string[] {
  if (texto.length <= MAXIMO) return [texto];
  const r: string[] = [];
  let i = 0;
  while (i < texto.length) {
    let fin = Math.min(i + OBJETIVO, texto.length);
    if (fin < texto.length) {
      const trozo = texto.slice(i, Math.min(i + MAXIMO, texto.length));
      const candidatos = [trozo.lastIndexOf('\n\n'), trozo.lastIndexOf('.\n'), trozo.lastIndexOf('. '), trozo.lastIndexOf(' ')];
      const corte = candidatos.find((c) => c >= OBJETIVO * 0.5);
      if (corte !== undefined) fin = i + corte + 1;
    }
    const pieza = texto.slice(i, fin).trim();
    if (pieza) r.push(pieza);
    if (fin >= texto.length) break;
    let sig = fin - SOLAPE;
    // El solape empieza en una palabra entera y siempre avanza.
    const espacio = texto.indexOf(' ', sig);
    if (espacio !== -1 && espacio < fin) sig = espacio + 1;
    i = sig > i ? sig : fin;
  }
  return r;
}

/** Fragmentos de un documento por páginas. `paginadas` indica si la página tiene sentido (PDF) o son solo trozos (Word, pegado). */
export function fragmentar(paginas: string[], paginadas = true): Fragmento[] {
  type Bloque = { pagina: number | null; seccion: string | null; texto: string };
  const bloques: Bloque[] = [];
  let mayor: string | null = null, apartado: string | null = null;
  let actual: Bloque | null = null;
  const cerrar = () => { if (actual && actual.texto.trim()) bloques.push(actual); actual = null; };
  const seccion = () => (mayor && apartado ? `${mayor} · ${apartado}` : mayor ?? apartado);
  paginas.forEach((pag, n) => {
    for (const linea of pag.split('\n')) {
      const pagina = paginadas ? n + 1 : null;
      const titulo = linea.match(TITULO_MAYOR);
      const ap = linea.match(APARTADO);
      if (titulo) {
        cerrar();
        mayor = titulo[1]!.toUpperCase(); apartado = null;
        actual = { pagina, seccion: mayor, texto: `${linea.trim()}\n` };
        continue;
      }
      if (ap) {
        cerrar();
        apartado = ap[1]!.replace(/\s*[.:\-–]+\s*$/, '').trim().slice(0, 60);
        actual = { pagina, seccion: seccion(), texto: `${linea}\n` };
        continue;
      }
      // Una página nueva abre fragmento solo si el actual ya tiene cuerpo: así la cita de página es exacta.
      if (!actual) actual = { pagina, seccion: seccion(), texto: '' };
      else if (paginadas && actual.pagina !== pagina && actual.texto.length > OBJETIVO * 0.5) { cerrar(); actual = { pagina, seccion: seccion(), texto: '' }; }
      actual.texto += `${linea}\n`;
    }
  });
  cerrar();
  const r: Fragmento[] = [];
  for (const b of bloques) {
    for (const pieza of trocear(limpia(b.texto))) {
      if (pieza.length < 3) continue;
      r.push({ orden: r.length, pagina: b.pagina, seccion: b.seccion ? b.seccion.slice(0, 200) : null, texto: pieza.slice(0, 12000) });
    }
  }
  return r;
}

/** Fusión por posición recíproca (RRF): combina rankings sin tener que comparar puntuaciones de naturaleza distinta. */
export function fusionRRF<T extends { id: string }>(listas: T[][], k = 60): (T & { rrf: number })[] {
  const m = new Map<string, T & { rrf: number }>();
  for (const lista of listas) {
    lista.forEach((x, i) => {
      const a = m.get(x.id);
      if (a) a.rrf += 1 / (k + i + 1);
      else m.set(x.id, { ...x, rrf: 1 / (k + i + 1) });
    });
  }
  return [...m.values()].sort((a, b) => b.rrf - a.rrf);
}

/** Reordenación: a igual relevancia priman los modelos maestros y lo del mismo procedimiento o materia. Nunca añade nada. */
export function reordenarBiblioteca<T extends { rrf: number; clase: string; procedimiento_id?: string | null; materia_id?: string | null }>(l: T[], f: { procedimiento?: string | null; materia?: string | null } = {}): T[] {
  const peso = (x: T) => {
    let p = x.rrf;
    if (x.clase === 'maestro') p *= 1.5; else if (x.clase === 'clausula') p *= 1.15;
    if (f.procedimiento && x.procedimiento_id === f.procedimiento) p *= 1.5;
    else if (f.materia && x.materia_id === f.materia) p *= 1.2;
    return p;
  };
  return [...l].sort((a, b) => peso(b) - peso(a));
}

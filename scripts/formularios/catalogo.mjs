// Genera public/api/catalogo.php: las listas, límites y contactos que usan los formularios, para que
// la recepción en Hostinger (public/api/*.php) valide con los mismos datos que el navegador (src/lib/*.ts).
//   node scripts/formularios/catalogo.mjs           → escribe public/api/catalogo.php
//   node scripts/formularios/catalogo.mjs --check   → falla si no está al día (lo usa `npm run check`)
import { readFileSync, writeFileSync } from 'node:fs';
import {
  AREAS, PREFERENCIAS, PAPELES, IMPORTES, INCIDENCIAS, PROBLEMAS_LABORALES, REPRESENTA, SITUACIONES,
  AREAS_CON_FECHA, AREAS_FECHA_FUTURA, AREAS_CON_CUESTIONARIO, DOCUMENTOS, ORGANISMOS, LIMITES, TIEMPO_MINIMO_MS,
} from '../../src/lib/consulta.ts';
import { MOTIVOS, CONTACTO_SEGURO, LIMITES_LLAMADA } from '../../src/lib/llamada.ts';
import { indiceServicios } from '../../src/lib/servicios-indice.ts';
import { site, laboral } from '../../src/lib/site.ts';

const DESTINO = new URL('../../public/api/catalogo.php', import.meta.url);

const etiquetas = (lista) => Object.fromEntries(lista.map((x) => [x.id, x.label]));
const servicios = Object.fromEntries(
  indiceServicios.map((s) => [s.id, { nombre: s.nombre, area: s.area, pregunta: s.preguntaMinima?.label ?? '', opciones: s.preguntaMinima?.opciones ?? [] }]),
);

const datos = {
  areas: etiquetas(AREAS),
  preferencias: etiquetas(PREFERENCIAS),
  papeles: etiquetas(PAPELES),
  importes: etiquetas(IMPORTES),
  incidencias: etiquetas(INCIDENCIAS),
  problemas: etiquetas(PROBLEMAS_LABORALES),
  representa: etiquetas(REPRESENTA),
  situaciones: etiquetas(SITUACIONES),
  organismos: etiquetas(ORGANISMOS),
  documentos: etiquetas(DOCUMENTOS),
  motivos: etiquetas(MOTIVOS),
  seguro: etiquetas(CONTACTO_SEGURO),
  areasConFecha: [...AREAS_CON_FECHA],
  areasFechaFutura: [...AREAS_FECHA_FUTURA],
  areasConCuestionario: [...AREAS_CON_CUESTIONARIO],
  limites: { ...LIMITES },
  limitesLlamada: { ...LIMITES_LLAMADA },
  tiempoMinimoMs: TIEMPO_MINIMO_MS,
  servicios,
  despacho: { nombre: site.name, abogado: site.lawyer, telefono: site.phone, email: site.email, dominio: new URL(site.url).hostname },
  laboral: { nombre: laboral.name, telefono: laboral.phone },
};

// JSON dentro de un nowdoc: PHP no interpreta nada de su contenido
const php = `<?php
// GENERADO por scripts/formularios/catalogo.mjs a partir de src/lib/*.ts. No editar a mano.
if (!defined('PRAETORIA_FORMULARIOS')) { http_response_code(404); exit; }
return json_decode(<<<'JSON'
${JSON.stringify(datos, null, 1)}
JSON, true, 512, JSON_THROW_ON_ERROR);
`;

if (process.argv.includes('--check')) {
  let actual = '';
  try { actual = readFileSync(DESTINO, 'utf8'); } catch {}
  if (actual !== php) {
    console.error('public/api/catalogo.php no está al día: ejecuta node scripts/formularios/catalogo.mjs y súbelo');
    process.exit(1);
  }
  console.log('catalogo.php al día');
} else {
  writeFileSync(DESTINO, php);
  console.log('Escrito public/api/catalogo.php');
}

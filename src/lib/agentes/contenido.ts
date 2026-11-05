// Lee el Markdown generado en el build (scripts/agentes/generar.mjs) y lo prepara para el servidor MCP.
import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { site } from '@/lib/site';
import type { Entrada, FuenteMcp } from './mcp';

const DIR = join(process.cwd(), '.next/server/app/__markdown');

/** Markdown de una ruta pública; null si no existe. Los segmentos solo admiten letras, cifras, «-» y «_»: nunca «.» ni barras. */
export function markdownDe(segmentos: string[]): string | null {
  if (!segmentos.every((s) => /^[\p{L}\p{N}_-]+$/u.test(s))) return null;
  try {
    return readFileSync(join(DIR, ...segmentos, 'index.md'), 'utf8');
  } catch {
    return null;
  }
}

let indice: Entrada[] | null = null;
const cache = new Map<string, string | null>();

export const fuenteMcp: FuenteMcp = {
  indice: () => (indice ??= JSON.parse(readFileSync(join(DIR, 'indice.json'), 'utf8')) as Entrada[]),
  leer: (ruta) => {
    if (!cache.has(ruta)) cache.set(ruta, markdownDe(ruta.split('/').filter(Boolean)));
    return cache.get(ruta)!;
  },
  sitio: site.url,
  // Solo lo que ya se publica en la web. El móvil del letrado no se muestra nunca (src/lib/site.ts).
  contacto: {
    nombre: site.name,
    titular: site.legalName,
    letrado: `${site.lawyer}, ${site.college}, n.º ${site.collegeNumber}`,
    telefono: site.phoneIntl,
    correo: site.email,
    direccion: { calle: site.address.street, codigoPostal: site.address.postalCode, localidad: site.address.locality, provincia: site.address.region, pais: site.address.country },
    paginas: {
      contacto: `${site.url}/contacto/`,
      queMeLlameUnAbogado: `${site.url}/que-me-llame-un-abogado/`,
      elDespacho: `${site.url}/el-despacho/`,
    },
    aviso: 'Las consultas sobre un caso las debe enviar la propia persona desde la web, por teléfono o por correo.',
  },
};

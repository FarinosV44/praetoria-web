// Genera todos los iconos a partir de los originales en SVG:
//   node scripts/marca/generar-favicons.mjs
// - Monograma PA (public/favicon.svg, monograma-16.svg): hasta 48 px, donde el nombre completo no se lee.
// - Nombre completo PRAETORIA / ABOGADOS (completo*.svg): a partir de 96 px.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const F = 'scripts/marca/fuentes';
const png = (svg, size) =>
  // El monograma de 16 px se rasteriza 1:1 para conservar su ajuste a la retícula.
  sharp(svg, { density: svg.endsWith('monograma-16.svg') ? 72 : 288 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

const SALIDAS = [
  ['public/favicon.png', 'public/favicon.svg', 48],
  ['public/icon-192.png', `${F}/completo.svg`, 192],
  ['public/icon-512.png', `${F}/completo.svg`, 512],
  // iOS redondea por su cuenta y no admite transparencia.
  ['public/apple-touch-icon.png', `${F}/completo-a-sangre.svg`, 180],
  // Android recorta el icono: el nombre queda dentro de la zona segura.
  ['public/iconos/icono-maskable-512.png', `${F}/completo-maskable.svg`, 512],
  // Android usa solo la transparencia de la insignia de las notificaciones.
  ['public/iconos/insignia-96.png', `${F}/insignia.svg`, 96],
];
for (const [destino, origen, size] of SALIDAS) {
  // Los iconos a sangre no llevan canal de transparencia.
  const datos = await png(origen, size);
  writeFileSync(destino, origen.includes('completo-') ? await sharp(datos).flatten({ background: '#fff' }).png({ compressionLevel: 9 }).toBuffer() : datos);
}

// favicon.ico con PNG dentro: 16 (dibujado para esa retícula), 32 y 48.
const marcos = [
  [16, await png(`${F}/monograma-16.svg`, 16)],
  [32, await png('public/favicon.svg', 32)],
  [48, await png('public/favicon.svg', 48)],
];
const cabecera = Buffer.alloc(6 + 16 * marcos.length);
cabecera.writeUInt16LE(1, 2);
cabecera.writeUInt16LE(marcos.length, 4);
let posicion = cabecera.length;
marcos.forEach(([size, datos], i) => {
  const o = 6 + 16 * i;
  cabecera[o] = size;
  cabecera[o + 1] = size;
  cabecera.writeUInt16LE(1, o + 4);
  cabecera.writeUInt16LE(32, o + 6);
  cabecera.writeUInt32LE(datos.length, o + 8);
  cabecera.writeUInt32LE(posicion, o + 12);
  posicion += datos.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([cabecera, ...marcos.map(([, d]) => d)]));
console.log(`Iconos generados: ${SALIDAS.length + 1}`);

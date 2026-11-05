import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Comprueba el contraste WCAG 2.1 de las combinaciones que usa la interfaz, leyendo los tokens reales (#11).
const css = readFileSync('src/seguros/seguros.css', 'utf8');
const token = (n: string) => {
  const m = css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`Token sin color directo: ${n}`);
  return m[1]!;
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe('contraste de la paleta', () => {
  it('usa exactamente la paleta pedida', () => {
    expect(token('color-fondo').toUpperCase()).toBe('#F9F9F9');
    expect(token('color-oscuro').toUpperCase()).toBe('#28282B');
    expect(token('color-acento').toLowerCase()).toBe('#ff4200');
  });

  const TEXTO: [string, string, string][] = [
    ['texto principal sobre fondo', 'color-oscuro', 'color-fondo'],
    ['texto principal sobre tarjeta', 'color-oscuro', 'color-superficie'],
    ['texto secundario sobre fondo', 'color-texto-2', 'color-fondo'],
    ['texto secundario sobre tarjeta', 'color-texto-2', 'color-superficie'],
    ['botón principal: texto sobre naranja', 'color-sobre-acento', 'color-acento'],
    ['botón oscuro / segmento activo', 'color-sobre-oscuro', 'color-oscuro'],
    ['estado aviso', 'color-aviso-texto', 'color-aviso-fondo'],
    ['estado peligro', 'color-peligro-texto', 'color-peligro-fondo'],
    ['estado correcto', 'color-ok-texto', 'color-ok-fondo'],
    ['texto secundario en etiqueta neutra', 'color-texto-2', 'color-info-fondo'],
  ];
  for (const [nombre, a, b] of TEXTO) {
    it(`${nombre} ≥ 4,5:1 (AA texto normal)`, () => expect(contraste(token(a), token(b))).toBeGreaterThanOrEqual(4.5));
  }

  it('foco y bordes de campo ≥ 3:1 (AA componentes)', () => {
    expect(contraste(token('color-acento'), token('color-fondo'))).toBeGreaterThanOrEqual(3);
    expect(contraste(token('color-acento'), token('color-superficie'))).toBeGreaterThanOrEqual(3);
    expect(contraste(token('color-borde-fuerte'), token('color-fondo'))).toBeGreaterThanOrEqual(3);
  });

  it('el blanco sobre naranja NO llega a 4,5:1: por eso no se usa para texto', () => {
    expect(contraste('#FFFFFF', token('color-acento'))).toBeLessThan(4.5);
    expect(contraste(token('color-oscuro'), token('color-acento'))).toBeLessThan(4.5);
  });
});

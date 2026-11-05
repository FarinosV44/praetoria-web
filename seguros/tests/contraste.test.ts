import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Contraste WCAG 2.1 de las combinaciones que usa Seguros, leyendo los tokens reales: los de Seguros
// (src/seguros/seguros.css) apuntan a los del panel del despacho (src/app/(portal)/portal.css).
const css = readFileSync('src/seguros/seguros.css', 'utf8') + readFileSync('src/app/(portal)/portal.css', 'utf8');
const token = (n: string, prof = 0): string => {
  const m = css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6}|var\\(--([a-z0-9-]+)\\))`));
  if (!m || prof > 4) throw new Error(`Token sin color: ${n}`);
  return m[2] ? token(m[2], prof + 1) : m[1]!;
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contraste = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe('contraste de la paleta', () => {
  it('usa la paleta del panel del despacho', () => {
    expect(token('color-oscuro').toLowerCase()).toBe('#22262a');
    expect(token('color-acento').toLowerCase()).toBe('#b3242a');
    expect(token('color-fondo').toLowerCase()).toBe('#eeece8');
  });

  const TEXTO: [string, string, string][] = [
    ['texto principal sobre fondo', 'color-oscuro', 'color-fondo'],
    ['texto principal sobre tarjeta', 'color-oscuro', 'color-superficie'],
    ['texto secundario sobre fondo', 'color-texto-2', 'color-fondo'],
    ['texto secundario sobre tarjeta', 'color-texto-2', 'color-superficie'],
    ['botón principal: blanco sobre rojo', 'color-sobre-acento', 'color-acento'],
    ['botón oscuro / segmento activo', 'color-sobre-oscuro', 'color-oscuro'],
    ['estado aviso', 'color-aviso-texto', 'color-aviso-fondo'],
    ['estado peligro', 'color-peligro-texto', 'color-peligro-fondo'],
    ['estado correcto', 'color-ok-texto', 'color-ok-fondo'],
    ['texto secundario en etiqueta neutra', 'color-texto-2', 'color-info-fondo'],
  ];
  for (const [nombre, a, b] of TEXTO) {
    it(`${nombre} ≥ 4,5:1 (AA texto normal)`, () => expect(contraste(token(a), token(b))).toBeGreaterThanOrEqual(4.5));
  }

  it('acento y bordes de campo ≥ 3:1 (AA componentes)', () => {
    expect(contraste(token('color-acento'), token('color-fondo'))).toBeGreaterThanOrEqual(3);
    expect(contraste(token('color-acento'), token('color-superficie'))).toBeGreaterThanOrEqual(3);
    expect(contraste(token('color-borde-fuerte'), token('color-superficie'))).toBeGreaterThanOrEqual(3);
    expect(contraste(token('color-borde-fuerte'), token('color-fondo'))).toBeGreaterThanOrEqual(3);
  });
});

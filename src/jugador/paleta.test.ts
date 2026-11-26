import { describe, expect, it } from 'vitest';
import { ROPA_ESCALADORA, casillaDe, recolocarEnPaleta, type CambioColor } from './paleta.ts';

/** Coordenada de un píxel de la paleta de 512 px. */
const uv = (x: number, y: number) => [x / 512, y / 512] as const;

describe('paleta de Kenney', () => {
  it('cada píxel cae en su casilla de 32 × 128 px', () => {
    expect(casillaDe(...uv(112, 396))).toEqual({ columna: 3, fila: 3 });
    expect(casillaDe(...uv(48, 177))).toEqual({ columna: 1, fila: 1 });
    expect(casillaDe(1, 1)).toEqual({ columna: 15, fila: 3 }); // el borde no se sale
  });

  it('mueve el vértice a la otra casilla conservando su sitio dentro (el degradado)', () => {
    const cambio: CambioColor = { huesos: ['torso'], de: { columna: 3, fila: 3 }, a: { columna: 6, fila: 1 } };
    const [u, v] = recolocarEnPaleta(...uv(112, 396), 'torso', [cambio]);
    expect(u * 512).toBeCloseTo(112 + 3 * 32, 9);
    expect(v * 512).toBeCloseTo(396 - 2 * 128, 9);
  });

  it('solo cambia los huesos de la regla: la misma casilla en la cabeza no se toca', () => {
    const [u, v] = uv(112, 396);
    expect(recolocarEnPaleta(u, v, 'head', ROPA_ESCALADORA)).toEqual([u, v]);
  });

  it('la ropa de la escaladora va a casillas rosas de la fila 1 y los pantalones no cambian', () => {
    for (const c of ROPA_ESCALADORA) {
      expect(c.a.fila).toBe(1);
      expect(c.huesos).not.toContain('leg-left');
    }
    const [u, v] = uv(48, 177); // vaqueros
    expect(recolocarEnPaleta(u, v, 'leg-left', ROPA_ESCALADORA)).toEqual([u, v]);
  });
});

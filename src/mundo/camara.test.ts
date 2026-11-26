import { describe, expect, it } from 'vitest';
import { acortarPorColumna } from './camara.ts';

describe('acortarPorColumna', () => {
  it('si la columna no está en medio, la cámara se queda donde está', () => {
    // Escalador en (5, 0), cámara más lejos aún de la columna.
    expect(acortarPorColumna(5, 0, 12, 0, 3.4)).toBe(1);
  });

  it('si la columna está en medio, la cámara se acerca hasta su borde', () => {
    // Escalador en (5, 0) y cámara al otro lado, en (−5, 0): la columna (radio 3,4) estorba.
    const t = acortarPorColumna(5, 0, -5, 0, 3.4);
    // El borde está en x = 3,4: a 1,6 m de los 10 m del segmento.
    expect(t).toBeCloseTo(0.16, 5);
  });

  it('si la línea pasa rozando sin tocar, no acorta', () => {
    expect(acortarPorColumna(5, 4, -5, 4, 3.4)).toBe(1);
  });
});

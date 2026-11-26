import { describe, expect, it } from 'vitest';
import { acortarPorPared, giroHaciaPared } from './camara.ts';

describe('giroHaciaPared', () => {
  it('pone la cámara entre el escalador y el centro del pozo', () => {
    // La cámara está en (sin giro, cos giro) respecto al escalador.
    for (const [x, z] of [[10, 0], [0, 10], [-7, 7], [3, -9]] as const) {
      const g = giroHaciaPared(x, z);
      const r = Math.hypot(x, z);
      expect(Math.sin(g)).toBeCloseTo(-x / r, 9);
      expect(Math.cos(g)).toBeCloseTo(-z / r, 9);
    }
  });
});

describe('acortarPorPared', () => {
  it('si la cámara queda dentro del pozo, se queda donde está', () => {
    // Escalador en (10, 0) y cámara hacia el centro, en (3, 0).
    expect(acortarPorPared(10, 0, 3, 0, 11.7)).toBe(1);
  });

  it('si la cámara se saldría por la pared, se acerca hasta ella', () => {
    // Escalador en (10, 0) y cámara detrás, en (17, 0): la pared está en x = 11,7.
    const t = acortarPorPared(10, 0, 17, 0, 11.7);
    expect(t).toBeCloseTo(1.7 / 7, 9);
  });

  it('en diagonal también para justo en la pared', () => {
    const t = acortarPorPared(8, 0, 8, 10, 11.7);
    const z = 10 * t;
    expect(Math.hypot(8, z)).toBeCloseTo(11.7, 9);
  });
});

import { describe, expect, it } from 'vitest';
import { MAX_PASOS, PASO, repartirTiempo } from './bucle.ts';

/** Simula `segundos` de juego con fotogramas de `dt` y cuenta los pasos de lógica. */
function pasosEn(segundos: number, dt: number): number {
  let acumulado = 0;
  let total = 0;
  for (let t = 0; t < segundos - 1e-9; t += dt) {
    const r = repartirTiempo(acumulado, dt);
    total += r.pasos;
    acumulado = r.resto;
  }
  return total;
}

describe('repartirTiempo', () => {
  it('un fotograma de exactamente 1/60 s da un paso', () => {
    expect(repartirTiempo(0, PASO)).toEqual({ pasos: 1, resto: 0 });
  });

  it('guarda lo que sobra para el siguiente fotograma', () => {
    const r = repartirTiempo(0, PASO * 1.5);
    expect(r.pasos).toBe(1);
    expect(r.resto).toBeCloseTo(PASO * 0.5);
  });

  it('la lógica avanza lo mismo a 30, 60 y 144 fps (el cubo gira igual de rápido)', () => {
    expect(pasosEn(2, 1 / 30)).toBe(120);
    expect(pasosEn(2, 1 / 60)).toBe(120);
    expect(Math.abs(pasosEn(2, 1 / 144) - 120)).toBeLessThanOrEqual(1);
  });

  it('un tirón enorme no dispara cientos de pasos', () => {
    expect(repartirTiempo(0, 5).pasos).toBe(MAX_PASOS);
    expect(repartirTiempo(0, 5).resto).toBe(0);
  });

  it('un dt negativo (reloj raro) no hace nada', () => {
    expect(repartirTiempo(0, -1)).toEqual({ pasos: 0, resto: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { TRANSICION, mezclaEscenario } from './escena.ts';

describe('mezcla de la cueva con la grieta', () => {
  it('0 en la cueva, 1 en la grieta y la mitad en el rellano de los 220 m', () => {
    expect(mezclaEscenario(0)).toBe(0);
    expect(mezclaEscenario(220 - TRANSICION)).toBe(0);
    expect(mezclaEscenario(220)).toBeCloseTo(0.5);
    expect(mezclaEscenario(220 + TRANSICION)).toBe(1);
    expect(mezclaEscenario(400)).toBe(1);
  });

  it('cambia poco a poco: sin saltos al subir de 10 en 10 cm', () => {
    let antes = 0;
    for (let y = 200; y <= 240; y += 0.1) {
      const m = mezclaEscenario(y);
      expect(m).toBeGreaterThanOrEqual(antes);
      expect(m - antes).toBeLessThan(0.02);
      antes = m;
    }
  });
});

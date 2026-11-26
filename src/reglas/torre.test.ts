import { describe, expect, it } from 'vitest';
import { crearAzar } from './azar.ts';
import {
  GIRO_MAX,
  GIRO_MIN,
  METROS_POR_TRAMO,
  SEPARACION_MAX,
  SEPARACION_MIN,
  generarTramo,
  posicionSaliente,
} from './torre.ts';

const SEMILLAS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);
const TRAMOS = [0, 1, 2, 5];
const MARGEN = 1e-9;

describe('azar con semilla', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = crearAzar(42);
    const b = crearAzar(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('siempre devuelve números en [0, 1)', () => {
    const a = crearAzar(7);
    for (let i = 0; i < 10000; i++) {
      const n = a();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('generarTramo', () => {
  it('es reproducible: misma semilla y tramo → misma torre (base de la carrera)', () => {
    expect(generarTramo(1234, 0)).toEqual(generarTramo(1234, 0));
    expect(generarTramo(1234, 3)).toEqual(generarTramo(1234, 3));
  });

  it('semillas distintas dan torres distintas', () => {
    expect(generarTramo(1, 0).salientes).not.toEqual(generarTramo(2, 0).salientes);
  });

  it('cada tramo va de su base a su rellano (220 m)', () => {
    const t = generarTramo(99, 2);
    expect(t.base).toBe(2 * METROS_POR_TRAMO);
    expect(t.rellano).toBe(3 * METROS_POR_TRAMO);
  });

  it('todos los huecos verticales miden 2-3 m, también suelo → primero y último → rellano', () => {
    for (const s of SEMILLAS) {
      for (const n of TRAMOS) {
        const t = generarTramo(s, n);
        const alturas = [t.base, ...t.salientes.map((x) => x.y), t.rellano];
        for (let i = 1; i < alturas.length; i++) {
          const hueco = alturas[i]! - alturas[i - 1]!;
          expect(hueco).toBeGreaterThanOrEqual(SEPARACION_MIN - MARGEN);
          expect(hueco).toBeLessThanOrEqual(SEPARACION_MAX + MARGEN);
        }
      }
    }
  });

  it('el giro entre salientes seguidos está entre 30° y 50°', () => {
    for (const s of SEMILLAS) {
      const { salientes } = generarTramo(s, 0);
      for (let i = 1; i < salientes.length; i++) {
        let giro = salientes[i]!.angulo - salientes[i - 1]!.angulo;
        if (giro < 0) giro += Math.PI * 2;
        expect(giro).toBeGreaterThanOrEqual(GIRO_MIN - MARGEN);
        expect(giro).toBeLessThanOrEqual(GIRO_MAX + MARGEN);
      }
    }
  });

  it('la distancia en horizontal entre centros seguidos es de 2-3,6 m (se puede saltar)', () => {
    for (const s of SEMILLAS) {
      const { salientes } = generarTramo(s, 0);
      for (let i = 1; i < salientes.length; i++) {
        const a = posicionSaliente(salientes[i - 1]!);
        const b = posicionSaliente(salientes[i]!);
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        expect(d).toBeGreaterThan(2);
        expect(d).toBeLessThan(3.6);
      }
    }
  });

  it('un tramo tiene entre 73 y 110 salientes (220 m / 2-3 m)', () => {
    for (const s of SEMILLAS) {
      const n = generarTramo(s, 0).salientes.length;
      expect(n).toBeGreaterThanOrEqual(73);
      expect(n).toBeLessThanOrEqual(110);
    }
  });
});

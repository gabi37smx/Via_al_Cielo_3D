import { describe, expect, it } from 'vitest';
import { crearAzar } from './azar.ts';
import {
  DISTANCIA_MAX,
  DISTANCIA_MIN,
  GIRO_MAX,
  GIRO_MIN,
  METROS_POR_TRAMO,
  RADIO_PARED,
  RADIO_RELLANO,
  SEPARACION_MAX,
  SEPARACION_MIN,
  alturaSuelo,
  generarTramo,
  posicionSaliente,
  puntoDeSalida,
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

  it('el giro entre salientes seguidos va siempre hacia el mismo lado y dentro de sus límites', () => {
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

  it('la distancia en horizontal entre centros seguidos es de 2,2-3,4 m (se puede saltar)', () => {
    for (const s of SEMILLAS) {
      const { salientes } = generarTramo(s, 0);
      for (let i = 1; i < salientes.length; i++) {
        const a = posicionSaliente(salientes[i - 1]!);
        const b = posicionSaliente(salientes[i]!);
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        expect(d).toBeGreaterThanOrEqual(DISTANCIA_MIN - MARGEN);
        expect(d).toBeLessThanOrEqual(DISTANCIA_MAX + MARGEN);
      }
    }
  });

  it('alturaSuelo: encima de un saliente da su altura; fuera, el suelo', () => {
    const t = generarTramo(5, 0);
    const s = t.salientes[10]!;
    const { x, z } = posicionSaliente(s);
    expect(alturaSuelo(t, x, z, s.y + 1)).toBe(s.y);
    // Por debajo de su cara de arriba no cuenta (se atraviesa desde abajo).
    expect(alturaSuelo(t, x, z, s.y - 0.01)).toBeLessThan(s.y);
    // En el centro del pozo no hay salientes: solo queda el suelo de la cueva.
    expect(alturaSuelo(t, 0, 0, 100)).toBe(0);
  });

  it('los salientes salen de la pared hacia dentro', () => {
    const t = generarTramo(5, 0);
    for (const s of t.salientes) {
      const { x, z } = posicionSaliente(s);
      const r = Math.hypot(x, z);
      expect(r).toBeLessThan(RADIO_PARED);
      expect(r).toBeGreaterThan(RADIO_PARED - 2.5);
      // Pegado a la pared se pisa; 3 m hacia dentro, ya no.
      expect(alturaSuelo(t, (x / r) * (RADIO_PARED - 0.4), (z / r) * (RADIO_PARED - 0.4), s.y + 0.01)).toBe(s.y);
      expect(alturaSuelo(t, (x / r) * (RADIO_PARED - 3), (z / r) * (RADIO_PARED - 3), s.y + 0.01)).toBeLessThan(s.y);
    }
  });

  it('alturaSuelo: el rellano es una cornisa que da la vuelta entera a la pared', () => {
    const t = generarTramo(5, 0);
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const x = Math.cos(a) * (RADIO_RELLANO + 0.3);
      const z = Math.sin(a) * (RADIO_RELLANO + 0.3);
      expect(alturaSuelo(t, x, z, t.rellano + 1)).toBe(t.rellano);
    }
    // En el hueco del centro no hay rellano.
    expect(alturaSuelo(t, RADIO_RELLANO - 1, 0, t.rellano + 1)).toBeLessThan(t.rellano);
  });

  it('en los tramos de arriba el suelo de salida es la cornisa, no un suelo entero', () => {
    const t = generarTramo(5, 1);
    expect(alturaSuelo(t, RADIO_RELLANO + 0.5, 0, t.base + 0.01)).toBe(t.base);
    expect(alturaSuelo(t, 0, 0, t.base + 0.01)).toBe(-Infinity);
  });

  it('se sale desde el suelo, dentro del pozo y sin pisar ningún saliente', () => {
    for (const s of SEMILLAS) {
      const t = generarTramo(s, 0);
      for (let puesto = 0; puesto < 4; puesto++) {
        const { x, z } = puntoDeSalida(t, puesto);
        expect(Math.hypot(x, z)).toBeLessThan(RADIO_PARED - 1);
        expect(alturaSuelo(t, x, z, 100)).toBe(0);
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

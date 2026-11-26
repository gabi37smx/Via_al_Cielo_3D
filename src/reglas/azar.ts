/*
 * Azar REPRODUCIBLE: con la misma semilla sale siempre la misma secuencia de
 * números, en cualquier navegador. Es lo que permite que en la carrera todos
 * los jugadores generen la misma torre sin enviarse los salientes: el anfitrión
 * solo reparte la semilla. `Math.random()` no sirve porque no admite semilla.
 */

/** Devuelve un número en [0, 1), como `Math.random()`. */
export type Azar = () => number;

/** Generador mulberry32: rápido, 32 bits y suficiente para un juego. */
export function crearAzar(semilla: number): Azar {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número decimal en [min, max). */
export function entre(azar: Azar, min: number, max: number): number {
  return min + azar() * (max - min);
}

/**
 * Deriva una semilla nueva de otra y un número (p. ej. el tramo). Así el tramo 3
 * se puede generar sin haber generado antes los tramos 0, 1 y 2.
 */
export function derivarSemilla(semilla: number, n: number): number {
  let h = (semilla ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

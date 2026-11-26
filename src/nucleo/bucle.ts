/*
 * Bucle de juego con PASO FIJO.
 *
 * Por qué: si la lógica avanzara «lo que haya tardado el fotograma» (multiplicar
 * todo por dt), un ordenador a 30 fps y otro a 144 fps no darían exactamente el
 * mismo salto, la misma caída ni el mismo choque. En una carrera en red eso
 * significa que cada jugador vería una partida distinta, y las físicas (Rapier)
 * se vuelven inestables con pasos grandes.
 *
 * Solución: la lógica SIEMPRE avanza en pasos de 1/60 s. Cada fotograma se mira
 * cuánto tiempo real ha pasado, se ejecutan los pasos que quepan y lo que sobra
 * se guarda para el siguiente fotograma. Pintar va aparte: se pinta una vez por
 * fotograma, mezclando el estado anterior y el actual con `alfa` (0-1) para que
 * el movimiento se vea suave aunque la pantalla vaya a 144 Hz.
 */

/** Duración de un paso de lógica, en segundos. */
export const PASO = 1 / 60;

/** Como mucho se recuperan 5 pasos por fotograma (si no, un tirón lo empeora). */
export const MAX_PASOS = 5;

/** Un fotograma de más de 0,25 s (pestaña en segundo plano) cuenta como 0,25 s. */
const MAX_DT = 0.25;

/**
 * Reparte el tiempo real en pasos fijos. Es lógica pura (sin navegador) para
 * poder probarla.
 * @param acumulado tiempo que sobró del fotograma anterior (s)
 * @param dt tiempo real que ha durado este fotograma (s)
 */
export function repartirTiempo(acumulado: number, dt: number): { pasos: number; resto: number } {
  const total = acumulado + Math.min(Math.max(dt, 0), MAX_DT);
  // El 1e-9 evita perder un paso por errores de coma flotante (p. ej. 3 × 1/60).
  const pasos = Math.floor(total / PASO + 1e-9);
  if (pasos > MAX_PASOS) {
    // El ordenador no da abasto: se tira el tiempo que no se puede recuperar.
    return { pasos: MAX_PASOS, resto: 0 };
  }
  return { pasos, resto: Math.max(total - pasos * PASO, 0) };
}

export interface OpcionesBucle {
  /** Avanza la lógica exactamente un paso de `PASO` segundos. */
  actualizar(paso: number): void;
  /** Pinta un fotograma. `alfa` (0-1) es cuánto se ha avanzado hacia el siguiente paso. */
  pintar(alfa: number, dtReal: number): void;
}

export interface Bucle {
  arrancar(): void;
  parar(): void;
}

export function crearBucle({ actualizar, pintar }: OpcionesBucle): Bucle {
  let acumulado = 0;
  let anterior = 0;
  let id = 0;

  const fotograma = (ahora: number) => {
    const dt = (ahora - anterior) / 1000;
    anterior = ahora;

    const { pasos, resto } = repartirTiempo(acumulado, dt);
    for (let i = 0; i < pasos; i++) actualizar(PASO);
    acumulado = resto;

    pintar(acumulado / PASO, dt);
    id = requestAnimationFrame(fotograma);
  };

  return {
    arrancar() {
      if (id) return;
      anterior = performance.now();
      id = requestAnimationFrame(fotograma);
    },
    parar() {
      cancelAnimationFrame(id);
      id = 0;
    },
  };
}

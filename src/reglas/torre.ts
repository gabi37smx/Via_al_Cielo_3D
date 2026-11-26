/*
 * La torre: dónde va cada saliente. LÓGICA PURA (sin Three.js): con la misma
 * semilla y el mismo tramo devuelve siempre los mismos salientes.
 *
 * Forma (idea I2, decisión 029): se escala la PARED de un pozo circular, como
 * en el Vía al Cielo 2D. Los salientes salen de la pared hacia dentro y suben
 * en espiral (siempre girando hacia el mismo lado). El centro del pozo está
 * vacío: la cámara va por dentro, mirando a la pared. Cada tramo de 220 m
 * empieza en un suelo (el rellano del tramo anterior, o el suelo de la cueva)
 * y acaba en un RELLANO: una cornisa que da la vuelta entera a la pared, a la
 * que se llega desde cualquier lado. Los rellanos unen los tramos entre sí.
 */
import { crearAzar, derivarSemilla, entre } from './azar.ts';

/** Metros de cada tramo (la API del ranking lo valida: `METROS_POR_PANTALLA`). */
export const METROS_POR_TRAMO = 220;

/**
 * Radio de la pared que se escala = hasta dónde se puede llegar (m). Con 12 m
 * caben ~30 salientes por vuelta (3 vueltas por tramo) y desde un lado se ve
 * la pared de enfrente; con 22 m la espiral casi no se notaba.
 */
export const RADIO_PARED = 12;
/** Cuánto sobresale un saliente de la pared (m). */
export const FONDO_SALIENTE = 2.2;
/** Distancia del eje del pozo al centro de cada saliente (m). */
export const RADIO_SALIENTES = RADIO_PARED - FONDO_SALIENTE / 2;
export const GROSOR_SALIENTE = 0.45;
export const ANCHO_MIN = 1.6;
export const ANCHO_MAX = 2.2;

/** Separación vertical entre un saliente y el siguiente (m). Salto ~3,5 m. */
export const SEPARACION_MIN = 2;
export const SEPARACION_MAX = 3;

/**
 * Distancia en horizontal entre los centros de dos salientes seguidos (m).
 * Es lo que decide si se llega saltando; el giro sale de aquí y del radio.
 * (Con la columna se medía en grados: 30°-50° a 4,1 m del eje = 2,1-3,5 m.)
 */
export const DISTANCIA_MIN = 2.2;
export const DISTANCIA_MAX = 3.4;

/** Giro alrededor del pozo entre un saliente y el siguiente (cuerda → ángulo). */
export const GIRO_MIN = 2 * Math.asin(DISTANCIA_MIN / (2 * RADIO_SALIENTES));
export const GIRO_MAX = 2 * Math.asin(DISTANCIA_MAX / (2 * RADIO_SALIENTES));

export interface Saliente {
  /** Ángulo alrededor del pozo (radianes). */
  angulo: number;
  /** Altura de la cara de arriba, donde se pisa (m). */
  y: number;
  /** Ancho a lo largo de la pared (m). */
  ancho: number;
}

export interface Tramo {
  indice: number;
  /** Altura del suelo donde empieza el tramo (m). */
  base: number;
  /** Altura del rellano donde acaba (m) = base del tramo siguiente. */
  rellano: number;
  salientes: Saliente[];
}

/** Cuánto sobresale de la pared el rellano que cierra cada tramo (m). */
export const FONDO_RELLANO = 3;
/** Radio del borde interior del rellano: desde aquí hasta la pared se pisa. */
export const RADIO_RELLANO = RADIO_PARED - FONDO_RELLANO;

/*
 * La caja real de cada saliente: un poco metida en la pared para que no se
 * vea una rendija. La usan el dibujo (mundo/torre.ts) y el suelo (abajo), así
 * lo que se ve y lo que se pisa son exactamente lo mismo.
 */
export const RADIO_CENTRO_CAJA = RADIO_SALIENTES + 0.1;
export const FONDO_CAJA = FONDO_SALIENTE + 0.2;

/** Punto a `radio` m del eje en la dirección `angulo`. */
export function puntoEnAngulo(angulo: number, radio: number): { x: number; z: number } {
  return { x: Math.cos(angulo) * radio, z: Math.sin(angulo) * radio };
}

/** Posición del centro de un saliente en el plano (x, z). */
export function posicionSaliente(s: Saliente): { x: number; z: number } {
  return puntoEnAngulo(s.angulo, RADIO_SALIENTES);
}

/** ¿El punto (x, z) cae encima del saliente? `margen` amplía la caja (m). */
export function sobreSaliente(s: Saliente, x: number, z: number, margen = 0): boolean {
  const cos = Math.cos(s.angulo);
  const sin = Math.sin(s.angulo);
  const dx = x - cos * RADIO_CENTRO_CAJA;
  const dz = z - sin * RADIO_CENTRO_CAJA;
  const haciaFuera = dx * cos + dz * sin; // a lo largo del radio
  const deLado = dx * sin - dz * cos; // a lo largo de la pared
  return Math.abs(haciaFuera) <= FONDO_CAJA / 2 + margen && Math.abs(deLado) <= s.ancho / 2 + margen;
}

/**
 * Altura del suelo más alto que hay debajo de (x, z) sin pasar de `techo`.
 *
 * Lo que está por ENCIMA de `techo` no cuenta: por eso los salientes se
 * atraviesan desde abajo al saltar y solo frenan al caer sobre ellos
 * (plataformas de un sentido, como en el Vía al Cielo 2D).
 */
export function alturaSuelo(tramo: Tramo, x: number, z: number, techo: number, margen = 0): number {
  const r = Math.hypot(x, z);
  const enRellano = r >= RADIO_RELLANO - margen;
  let mejor = -Infinity;

  // La base: en el tramo 0 es el suelo de la cueva (entero); en los demás,
  // el rellano del tramo anterior (una cornisa pegada a la pared).
  if (tramo.base <= techo && (tramo.indice === 0 || enRellano)) mejor = tramo.base;
  if (tramo.rellano <= techo && enRellano) mejor = Math.max(mejor, tramo.rellano);

  for (const s of tramo.salientes) {
    if (s.y <= techo && s.y > mejor && sobreSaliente(s, x, z, margen)) mejor = s.y;
  }
  return mejor;
}

/**
 * Dónde se empieza: en el suelo, entre el centro y la pared, un poco antes
 * del primer saliente. `puesto` separa a los jugadores de una carrera (0-3)
 * para que no salgan unos encima de otros.
 */
export function puntoDeSalida(tramo: Tramo, puesto = 0): { x: number; z: number; angulo: number } {
  const radio = RADIO_SALIENTES - 2;
  // Unos 4 m de pared antes del primer saliente, y 2,7 m más por cada puesto.
  const angulo = tramo.salientes[0]!.angulo - (4 + puesto * 2.7) / radio;
  return { ...puntoEnAngulo(angulo, radio), angulo };
}

export function generarTramo(semilla: number, indice: number): Tramo {
  const azar = crearAzar(derivarSemilla(semilla, indice));
  const base = indice * METROS_POR_TRAMO;
  const rellano = base + METROS_POR_TRAMO;
  const salientes: Saliente[] = [];

  let y = base;
  let angulo = azar() * Math.PI * 2;

  // Se sube hasta que el rellano quede a 2-3 m. Cerca del final se acota la
  // separación para que el último hueco (saliente → rellano) también cumpla
  // la regla: nunca quedan, por ejemplo, 3,5 m imposibles de repartir.
  for (;;) {
    const resto = rellano - y;
    if (resto <= SEPARACION_MAX) break;

    let min = SEPARACION_MIN;
    let max = SEPARACION_MAX;
    if (resto <= SEPARACION_MAX * 2) {
      // Quedan 4-6 m: este salto deja el rellano justo a 2-3 m.
      min = Math.max(SEPARACION_MIN, resto - SEPARACION_MAX);
      max = Math.min(SEPARACION_MAX, resto - SEPARACION_MIN);
    } else {
      // Quedan más de 6 m: que después queden al menos 4, para poder hacer
      // los dos últimos saltos de 2-3 m.
      max = Math.min(SEPARACION_MAX, resto - SEPARACION_MIN * 2);
    }

    y += entre(azar, min, max);
    angulo = (angulo + entre(azar, GIRO_MIN, GIRO_MAX)) % (Math.PI * 2);
    salientes.push({ angulo, y, ancho: entre(azar, ANCHO_MIN, ANCHO_MAX) });
  }

  return { indice, base, rellano, salientes };
}

/*
 * La torre: dónde va cada saliente. LÓGICA PURA (sin Three.js): con la misma
 * semilla y el mismo tramo devuelve siempre los mismos salientes.
 *
 * Forma: una columna de roca en el centro y los salientes pegados a ella,
 * subiendo en espiral (siempre girando hacia el mismo lado). Cada tramo de
 * 220 m empieza en un suelo (el rellano del tramo anterior, o el suelo de la
 * cueva) y acaba en un RELLANO: un anillo completo alrededor de la columna,
 * al que se llega desde cualquier lado. Los rellanos unen los tramos entre sí.
 */
import { crearAzar, derivarSemilla, entre } from './azar.ts';

/** Metros de cada tramo (la API del ranking lo valida: `METROS_POR_PANTALLA`). */
export const METROS_POR_TRAMO = 220;

export const RADIO_COLUMNA = 3;
/** Cuánto sobresale un saliente de la columna (m). */
export const FONDO_SALIENTE = 2.2;
/** Distancia del eje de la columna al centro de cada saliente (m). */
export const RADIO_SALIENTES = RADIO_COLUMNA + FONDO_SALIENTE / 2;
export const GROSOR_SALIENTE = 0.45;
export const ANCHO_MIN = 1.6;
export const ANCHO_MAX = 2.2;

/** Separación vertical entre un saliente y el siguiente (m). Salto ~3,5 m. */
export const SEPARACION_MIN = 2;
export const SEPARACION_MAX = 3;

/** Giro alrededor de la columna entre un saliente y el siguiente. */
export const GIRO_MIN = (30 * Math.PI) / 180;
export const GIRO_MAX = (50 * Math.PI) / 180;

export interface Saliente {
  /** Ángulo alrededor de la columna (radianes). */
  angulo: number;
  /** Altura de la cara de arriba, donde se pisa (m). */
  y: number;
  /** Ancho a lo largo de la columna (m). */
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

/** Posición del centro de un saliente en el plano (x, z). */
export function posicionSaliente(s: Saliente): { x: number; z: number } {
  return { x: Math.cos(s.angulo) * RADIO_SALIENTES, z: Math.sin(s.angulo) * RADIO_SALIENTES };
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

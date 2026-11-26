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

/** Radio del anillo (rellano) que cierra cada tramo. */
export const RADIO_RELLANO = RADIO_COLUMNA + FONDO_SALIENTE;
/** Radio de la cueva: hasta dónde se puede llegar (m). */
export const RADIO_MUNDO = 22;

/*
 * La caja real de cada saliente: un poco metida en la columna para que no se
 * vea una rendija. La usan el dibujo (mundo/torre.ts) y el suelo (abajo), así
 * lo que se ve y lo que se pisa son exactamente lo mismo.
 */
export const RADIO_CENTRO_CAJA = RADIO_SALIENTES - 0.1;
export const FONDO_CAJA = FONDO_SALIENTE + 0.2;

/** Posición del centro de un saliente en el plano (x, z). */
export function posicionSaliente(s: Saliente): { x: number; z: number } {
  return { x: Math.cos(s.angulo) * RADIO_SALIENTES, z: Math.sin(s.angulo) * RADIO_SALIENTES };
}

/** ¿El punto (x, z) cae encima del saliente? `margen` amplía la caja (m). */
export function sobreSaliente(s: Saliente, x: number, z: number, margen = 0): boolean {
  const cos = Math.cos(s.angulo);
  const sin = Math.sin(s.angulo);
  const dx = x - cos * RADIO_CENTRO_CAJA;
  const dz = z - sin * RADIO_CENTRO_CAJA;
  const haciaFuera = dx * cos + dz * sin; // a lo largo del radio
  const deLado = dx * sin - dz * cos; // a lo largo de la columna
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
  let mejor = -Infinity;

  // La base: en el tramo 0 es el suelo de la cueva (entero); en los demás,
  // el rellano del tramo anterior (un anillo).
  if (tramo.base <= techo && (tramo.indice === 0 || r <= RADIO_RELLANO + margen)) mejor = tramo.base;
  if (tramo.rellano <= techo && r <= RADIO_RELLANO + margen) mejor = Math.max(mejor, tramo.rellano);

  for (const s of tramo.salientes) {
    if (s.y <= techo && s.y > mejor && sobreSaliente(s, x, z, margen)) mejor = s.y;
  }
  return mejor;
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

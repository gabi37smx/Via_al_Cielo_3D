/*
 * El aire libre de la montaña (tramo 3, decisión 042): las ÁGUILAS y el
 * VIENTO. LÓGICA PURA: sin Three.js, sin DOM y sin red.
 *
 * - Las águilas vuelan de lado a lado delante de la cara de la montaña, por
 *   donde se sube (como en el 2D: van y vuelven, subiendo y bajando un poco).
 *   Si tocan al escalador le quitan 15 de vida (el 2D: DAÑO_AGUILA = 15).
 * - El viento sopla a RÁFAGAS: cada PERIODO segundos, una ráfaga de unos
 *   segundos que empuja de lado (a lo largo de la cara), a un lado o al otro.
 *   Solo empuja EN EL AIRE (de pie en un saliente no se nota): saltar en
 *   plena ráfaga obliga a corregir.
 *
 * Todo sale de la semilla y del tiempo de la partida: en una sala todos ven
 * las mismas águilas y las mismas ráfagas, y la simulación también.
 */
import { crearAzar, derivarSemilla, entre } from './azar.ts';
import { ANCHO_ZIGZAG, RADIO_COLINA, dCara, type Ladera } from './ladera.ts';

export const AIRE = {
  /**
   * Águilas en la ladera: 22, como en el 2D. Con ellas el escalador del
   * ordenador (que no esquiva) recibe 1,5 golpes por subida (~22 de vida),
   * parecido a los murciélagos de la cueva (2 golpes, 20 de vida).
   */
  aguilas: 22,
  /** Vida que quita un águila (como en el 2D). */
  danioAguila: 15,
  /** Distancia (m) del águila al centro del cuerpo para que golpee: es más grande que un murciélago. */
  radioGolpeAguila: 1,
  /** Van de −RECORRIDO a +RECORRIDO de lado: todo el zigzag y un poco más. */
  recorrido: ANCHO_ZIGZAG + 8,
  /** Cada cuántos segundos hay una ráfaga, cuánto dura y con qué fuerza empuja (m/s). */
  rafaga: { periodo: 8, duracion: 2.6, fuerza: [2.5, 3.5] as const },
} as const;

export interface Aguila {
  id: number;
  /** Altura media de vuelo (m). */
  y: number;
  /** A cuánto vuela de la cara de la montaña (m): por delante, donde están los salientes. */
  separacion: number;
  /** Velocidad de lado (m/s). */
  rapidez: number;
  /** Dónde está de su ida y vuelta al empezar (0-1). */
  fase: number;
  /** Cuánto sube y baja mientras vuela (m). */
  vaiven: number;
  /** Ángulo del pasillo (el marco de la ladera): así se coloca sin la ladera. */
  angulo: number;
}

/** Dónde está el águila y hacia qué lado vuela (+1 hacia +u, −1 hacia −u). */
export interface PosicionAguila {
  x: number;
  y: number;
  z: number;
  /** De lado (m) y sentido: para dibujarla mirando hacia donde va. */
  u: number;
  sentido: number;
}

/** Águilas repartidas por la altura de la ladera, cada una en su franja. */
export function generarAguilas(semilla: number, l: Ladera, cantidad: number = AIRE.aguilas): Aguila[] {
  const azar = crearAzar(derivarSemilla(semilla, 3000 + l.indice));
  const desde = l.base + 14; // la explanada y los primeros saltos, tranquilos
  const hasta = l.rellano - 6;
  return Array.from({ length: cantidad }, (_, i) => ({
    id: l.indice * 100 + i,
    y: desde + ((hasta - desde) * (i + azar())) / cantidad,
    separacion: entre(azar, 0.8, 3),
    rapidez: entre(azar, 3, 5),
    fase: azar(),
    vaiven: entre(azar, 0.3, 0.8),
    angulo: l.angulo,
  }));
}

export function posicionAguila(a: Aguila, tiempo: number): PosicionAguila {
  const R = AIRE.recorrido;
  // Ida y vuelta: un recorrido de 4R (de −R a +R y de vuelta).
  const vuelta = 4 * R;
  const p = (((a.fase * vuelta + a.rapidez * tiempo) % vuelta) + vuelta) % vuelta;
  const ida = p < 2 * R;
  const u = ida ? -R + p : R - (p - 2 * R);
  const y = a.y + Math.sin(tiempo * 1.3 + a.fase * Math.PI * 2) * a.vaiven;
  const d = dCara(y) - a.separacion;
  const nx = Math.cos(a.angulo);
  const nz = Math.sin(a.angulo);
  return { x: nx * d - nz * u, y, z: nz * d + nx * u, u, sentido: ida ? 1 : -1 };
}

/** ¿Pasa alguna águila a menos de `radio` m de (x, y, z)? Para que se oiga venir. */
export function aguilaCerca(aguilas: Aguila[], tiempo: number, x: number, y: number, z: number, radio: number): boolean {
  for (const a of aguilas) {
    if (Math.abs(a.y - y) > radio + 1) continue;
    const p = posicionAguila(a, tiempo);
    if (Math.hypot(p.x - x, p.y - y, p.z - z) < radio) return true;
  }
  return false;
}

/* ---------- El viento ---------- */

/** La ráfaga de este momento: cuánto sopla (0-1 de su fuerza) y hacia qué lado. */
export interface Rafaga {
  /** 0 = calma; sube y baja suave durante la ráfaga. */
  intensidad: number;
  /** +1 hacia +u, −1 hacia −u. */
  sentido: number;
  /** Fuerza máxima de esta ráfaga (m/s). */
  fuerza: number;
}

const CALMA: Rafaga = { intensidad: 0, sentido: 1, fuerza: 0 };

/**
 * La ráfaga en el instante `tiempo` (s de partida). Cada periodo tiene una:
 * empieza en un momento al azar del periodo, dura `duracion` y su fuerza sube
 * y baja como media onda (sin tirones).
 */
export function rafagaEn(l: Ladera, tiempo: number): Rafaga {
  const { periodo, duracion, fuerza } = AIRE.rafaga;
  if (tiempo < 0) return CALMA;
  const k = Math.floor(tiempo / periodo);
  const azar = crearAzar(derivarSemilla(l.semilla, 4000 + k));
  const inicio = k * periodo + entre(azar, 0, periodo - duracion);
  const sentido = azar() < 0.5 ? -1 : 1;
  const f = entre(azar, fuerza[0], fuerza[1]);
  const t = (tiempo - inicio) / duracion;
  if (t < 0 || t > 1) return { ...CALMA, sentido, fuerza: f };
  return { intensidad: Math.sin(Math.PI * t), sentido, fuerza: f };
}

/** ¿Está fuera, al aire libre (donde sopla el viento)? Por encima de la explanada y fuera de la colina. */
export function alAireLibre(l: Ladera, x: number, y: number, z: number): boolean {
  return y >= l.base + 0.5 && Math.hypot(x, z) >= RADIO_COLINA;
}

/**
 * Hacia dónde y a qué velocidad lleva el viento a quien está en (x, y, z) en
 * el aire (m/s, en x y en z). Dentro del pozo, en el pasillo o en la
 * explanada, nada.
 */
export function viento(l: Ladera, x: number, y: number, z: number, tiempo: number): { x: number; z: number } {
  if (!alAireLibre(l, x, y, z)) return { x: 0, z: 0 };
  const r = rafagaEn(l, tiempo);
  if (r.intensidad === 0) return { x: 0, z: 0 };
  // A lo largo de la cara (el eje u): T = (−sen, cos) del ángulo del pasillo.
  const v = r.intensidad * r.fuerza * r.sentido;
  return { x: -Math.sin(l.angulo) * v, z: Math.cos(l.angulo) * v };
}

/** ¿Acaba de empezar una ráfaga en este paso? (para que suene). */
export function empiezaRafaga(l: Ladera, tiempo: number, paso: number): boolean {
  return rafagaEn(l, tiempo - paso).intensidad === 0 && rafagaEn(l, tiempo).intensidad > 0;
}

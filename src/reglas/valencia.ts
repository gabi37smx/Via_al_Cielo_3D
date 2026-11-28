/*
 * El tramo 4: VALENCIA, la Ciudad de las Artes y las Ciencias (idea I9).
 * LÓGICA PURA: sin Three.js, sin DOM y sin red.
 *
 * De la cima de la montaña (660 m) se llega en avioneta (reglas/vuelo.ts).
 * Aterriza en una pista del Jardín del Turia, se baja y se camina por un
 * paseo entre dos estanques (en uno, el Hemisfèric) hasta el pie del PALAU DE
 * LES ARTS, agrandado hasta 220 m: lo que se sube en este tramo (660-880 m).
 *
 * El contador de altura sigue la escala del juego (220 m por tramo) y no la
 * del mapa: el suelo de Valencia está a la misma altura que la cima (660 m),
 * así el contador se queda quieto en el vuelo y sigue subiendo en el Palau.
 *
 * Valencia está lejos de la montaña (CENTRO_VALENCIA): no se ven la una
 * desde la otra. Todo se mide en un marco propio con el origen en el pie del
 * Palau: X hacia el Palau (la pista y el paseo van en esa dirección), Z de lado.
 */
import { CIMA, type Limite } from './ladera.ts';
import { CONFIG } from '../config.ts';

/** Dónde está el origen de Valencia en el mundo (m). Lejísimos de la montaña. */
export const CENTRO_VALENCIA = { x: 6000, z: 0 } as const;
/** El suelo de Valencia (m): a la altura de la cima, el contador no salta. */
export const SUELO_VALENCIA = CIMA;
/** Hasta dónde llega Valencia alrededor de su centro (m): más allá es la montaña. */
const RADIO_CIUDAD = 1500;

/** La pista del Jardín del Turia (X, en m): se aterriza hacia +X, hacia el Palau. */
export const PISTA_VALENCIA = { desde: -360, hasta: -84, ancho: 14, parada: -96 } as const;

/** Un rectángulo en el marco de Valencia (m). */
export interface Rectangulo {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/**
 * El Palau de les Arts, agrandado hasta 220 m (`alto`: lo alto de las
 * cáscaras). Lo que ocupa en el suelo: el CASCO de cristal, una elipse cuyo
 * morro es el frente (X ≈ 2, por donde se empezará a subir, mirando a la
 * pista), y las dos CÁSCARAS blancas, una elipse mayor pero solo de
 * `cascaras.desde` hacia atrás (por delante están abiertas).
 */
export const PALAU = {
  x: 214,
  z: 0,
  alto: 220,
  casco: { rx: 212, rz: 56 },
  cascaras: { rx: 209, rz: 83, desde: 31 },
} as const;

/** Dónde se pone el pie delante del Palau, en su morro (marco de Valencia). */
export const PIE_PALAU = { x: PALAU.x - PALAU.casco.rx - 1.5, z: 0 } as const;

/** Los dos estanques a los lados del paseo (en el de la izquierda, el Hemisfèric). */
export const ESTANQUES: readonly Rectangulo[] = [
  { x0: -78, x1: -16, z0: -66, z1: -9 },
  { x0: -78, x1: -16, z0: 9, z1: 66 },
];

/** El Hemisfèric, dentro del estanque de la izquierda (centro y medidas, m). */
export const HEMISFERIC = { x: -47, z: -37, largo: 50, ancho: 24, alto: 15 } as const;

/** El Museu de les Ciències: un edificio largo a la derecha de la pista. */
export const MUSEU: Rectangulo = { x0: -340, x1: -40, z0: 76, z1: 116 };

/** La avioneta aparcada al final de la pista (su fuselaje, para no atravesarlo). */
export const AVIONETA_VALENCIA: Rectangulo = { x0: PISTA_VALENCIA.parada - 4.6, x1: PISTA_VALENCIA.parada + 3.9, z0: -0.8, z1: 0.8 };

/** Hasta dónde se puede andar (m): el jardín no es infinito. */
export const BORDES_VALENCIA: Rectangulo = { x0: -380, x1: 440, z0: -120, z1: 130 };

/** La senyera, en un mástil en la plaza delante del Palau. */
export const SENYERA = { x: -8, z: -13 } as const;

/* ---------- El marco de Valencia ---------- */

export function enValencia(x: number, z: number): boolean {
  return Math.abs(x - CENTRO_VALENCIA.x) < RADIO_CIUDAD && Math.abs(z - CENTRO_VALENCIA.z) < RADIO_CIUDAD;
}

export function aLocalValencia(x: number, z: number): { x: number; z: number } {
  return { x: x - CENTRO_VALENCIA.x, z: z - CENTRO_VALENCIA.z };
}

export function aMundoValencia(x: number, z: number): { x: number; z: number } {
  return { x: x + CENTRO_VALENCIA.x, z: z + CENTRO_VALENCIA.z };
}

/**
 * Dónde se aparece al bajar de la avioneta: junto a la puerta (lado +Z),
 * mirando al Palau (orientación: 0 = +z, así que +X es π/2).
 */
export function llegadaValencia(): { x: number; y: number; z: number; orientacion: number } {
  const p = aMundoValencia(PISTA_VALENCIA.parada + 0.6, 2.6);
  return { x: p.x, y: SUELO_VALENCIA, z: p.z, orientacion: Math.PI / 2 };
}

/* ---------- Dónde se pisa ---------- */

/** El suelo de Valencia: todo plano (jardín, pista, paseo y plaza). */
export function alturaSueloValencia(x: number, z: number, techo: number): number {
  return techo >= SUELO_VALENCIA && enValencia(x, z) ? SUELO_VALENCIA : -Infinity;
}

/* ---------- Por dónde no se puede pasar ---------- */

const RADIO_CUERPO = CONFIG.escalador.radio;

/**
 * Saca el punto de un rectángulo (agrandado con el radio del cuerpo) por el
 * lado más cercano. Devuelve hacia dónde queda el obstáculo, como los demás
 * límites (para quitar esa parte de la velocidad), o null si no estaba dentro.
 */
export function fueraDeRectangulo(p: { x: number; z: number }, r: Rectangulo, margen = RADIO_CUERPO): { nx: number; nz: number } | null {
  const x0 = r.x0 - margen, x1 = r.x1 + margen, z0 = r.z0 - margen, z1 = r.z1 + margen;
  if (p.x <= x0 || p.x >= x1 || p.z <= z0 || p.z >= z1) return null;
  const distancias = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z];
  const menor = distancias.indexOf(Math.min(...distancias));
  if (menor === 0) {
    p.x = x0;
    return { nx: 1, nz: 0 };
  }
  if (menor === 1) {
    p.x = x1;
    return { nx: -1, nz: 0 };
  }
  if (menor === 2) {
    p.z = z0;
    return { nx: 0, nz: 1 };
  }
  p.z = z1;
  return { nx: 0, nz: -1 };
}

/** Lo mismo con una elipse: se saca por la línea que va del centro al punto. */
export function fueraDeElipse(p: { x: number; z: number }, e: { x: number; z: number; rx: number; rz: number }, margen = RADIO_CUERPO): { nx: number; nz: number } | null {
  const rx = e.rx + margen;
  const rz = e.rz + margen;
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const q = (dx / rx) ** 2 + (dz / rz) ** 2;
  if (q >= 1) return null;
  if (q < 1e-12) {
    p.x = e.x - rx;
    return { nx: 1, nz: 0 };
  }
  const k = 1 / Math.sqrt(q);
  p.x = e.x + dx * k;
  p.z = e.z + dz * k;
  // Hacia dentro de la elipse (su normal, cambiada de sentido).
  const gx = (p.x - e.x) / (rx * rx);
  const gz = (p.z - e.z) / (rz * rz);
  const n = Math.hypot(gx, gz);
  return { nx: -gx / n, nz: -gz / n };
}

/** El Palau: su casco y, desde donde empiezan, sus cáscaras. */
export function fueraDePalau(p: { x: number; z: number }): { nx: number; nz: number } | null {
  const c = fueraDeElipse(p, { x: PALAU.x, z: PALAU.z, ...PALAU.casco });
  if (c) return c;
  if (p.x < PALAU.cascaras.desde) return null;
  return fueraDeElipse(p, { x: PALAU.x, z: PALAU.z, rx: PALAU.cascaras.rx, rz: PALAU.cascaras.rz });
}

/** Lo que no se atraviesa en Valencia: los estanques, los edificios y la avioneta. */
export const OBSTACULOS_VALENCIA: readonly Rectangulo[] = [...ESTANQUES, MUSEU, AVIONETA_VALENCIA];

/**
 * El límite de Valencia, en el mundo: no meterse en los estanques (tienen un
 * bordillo), en el Museu, en la avioneta ni en el Palau, ni salirse del jardín.
 */
export const limiteValencia: Limite = (p) => {
  const local = aLocalValencia(p.x, p.z);
  let choque: { nx: number; nz: number } | null = null;
  for (const r of OBSTACULOS_VALENCIA) choque = fueraDeRectangulo(local, r) ?? choque;
  choque = fueraDePalau(local) ?? choque;
  // Los bordes del jardín: el obstáculo queda por fuera.
  const b = BORDES_VALENCIA;
  if (local.x < b.x0) [local.x, choque] = [b.x0, { nx: -1, nz: 0 }];
  if (local.x > b.x1) [local.x, choque] = [b.x1, { nx: 1, nz: 0 }];
  if (local.z < b.z0) [local.z, choque] = [b.z0, { nx: 0, nz: -1 }];
  if (local.z > b.z1) [local.z, choque] = [b.z1, { nx: 0, nz: 1 }];
  if (!choque) return null;
  const vuelta = aMundoValencia(local.x, local.z);
  p.x = vuelta.x;
  p.z = vuelta.z;
  return choque;
};

/** ¿El punto (en el mundo) choca con algo de Valencia? (para las pruebas y la cámara) */
export function libreEnValencia(x: number, z: number): boolean {
  const p = { x, z };
  return limiteValencia(p, SUELO_VALENCIA) === null;
}

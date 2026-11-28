/*
 * La subida del PALAU DE LES ARTS, el tramo 4 (660-880 m) en Valencia (idea
 * I9, segunda parte). LÓGICA PURA: sin Three.js, sin DOM y sin red.
 *
 * El Palau (agrandado hasta 220 m) tiene un CASCO de cristal y dos CÁSCARAS
 * blancas, trozos de un elipsoide que llega a 220 m en el medio. Se sube por
 * el COSTADO IZQUIERDO (−Z, el del Hemisfèric): desde la plaza se rodea el
 * morro, se sube al ZÓCALO de piedra (1,2 m) y empiezan los SALIENTES
 * naranjas en zigzag. El zigzag va en diagonal hacia el medio del edificio
 * (la cáscara solo llega a lo más alto en el medio) y, arriba, se llega al
 * MIRADOR, una terraza sobre lo alto de las cáscaras.
 *
 * Como en la ladera (decisión 041), cada saliente sale de la cáscara lo que
 * ésta se ha metido desde el anterior: cerca de arriba la cáscara se tumba y
 * los salientes se hacen terrazas más hondas. Aquí no son de hielo: planos.
 *
 * Todo va en el MARCO DE VALENCIA (x hacia el Palau, z de lado; ver
 * valencia.ts) y las alturas, en metros del juego (660 = el suelo).
 */
import { CIMA, type Limite } from './ladera.ts';
import { crearAzar, derivarSemilla, entre, type Azar } from './azar.ts';
import { TIPOS, type TipoSaliente } from './torre.ts';
import { CONFIG } from '../config.ts';

/** El tramo del Palau es el cuarto (índice 3): de 660 a 880 m. */
export const INDICE_PALAU = 3;
/** El suelo de Valencia, a la altura de la cima de la montaña (el contador no salta). */
export const SUELO_PALAU = CIMA;

/**
 * El Palau: medidas (m, en el marco de Valencia). `alto`: lo alto de las
 * cáscaras. Los elipsoides tienen el centro a `centroY` sobre el suelo, así
 * el pie es casi tan ancho como lo más ancho. `casco` y `cascaras` dan lo
 * que miden EN EL SUELO (rx, rz) y su alto (ry, desde el centro). Las
 * cáscaras solo están de `cascaras.desde` hacia atrás (por delante, abiertas).
 * El ZÓCALO rodea el pie: `alto` m de piedra, `margen` m más ancho.
 */
export const PALAU = {
  x: 214,
  z: 0,
  alto: 220,
  centroY: 30,
  casco: { rx: 212, rz: 56, ry: 115 },
  cascaras: { rx: 209, rz: 83, desde: 31 },
  zocalo: { alto: 1.2, margen: 4 },
} as const;

/** Un elipsoide que en el suelo mide (rx, rz): sus radios de verdad. */
function radios(rx: number, rz: number, ry: number) {
  const k = Math.sqrt(1 - (PALAU.centroY / ry) ** 2);
  return { rx: rx / k, rz: rz / k, ry };
}
export const ELIPSOIDE_CASCO = radios(PALAU.casco.rx, PALAU.casco.rz, PALAU.casco.ry);
export const ELIPSOIDE_CASCARAS = radios(PALAU.cascaras.rx, PALAU.cascaras.rz, PALAU.alto - PALAU.centroY);
/**
 * Dónde empiezan y acaban las cáscaras alrededor del eje vertical (rad,
 * como la esfera de Three.js: x = −cos φ, z = sen φ; φ pequeño = el frente).
 */
export const PHI_DELANTE = Math.acos((PALAU.x - PALAU.cascaras.desde) / PALAU.cascaras.rx);
export const PHI_DETRAS = 0.9 * Math.PI;

/** Dónde se pone el pie delante del Palau, en su morro. */
export const PIE_PALAU = { x: PALAU.x - PALAU.casco.rx - 1.5, z: 0 } as const;

/** Cuánto mide el corte del elipsoide a `h` m sobre el suelo, respecto a lo más ancho (0-1). */
function anchura(h: number, ry: number): number {
  const t = (h - PALAU.centroY) / ry;
  return Math.sqrt(Math.max(1 - t * t, 0));
}

/** A qué distancia del eje (|z|) está la cáscara en (x, h): 0 si ahí no llega. */
export function zCara(x: number, h: number): number {
  const E = ELIPSOIDE_CASCARAS;
  const t = (x - PALAU.x) / E.rx;
  const v = (h - PALAU.centroY) / E.ry;
  return E.rz * Math.sqrt(Math.max(1 - t * t - v * v, 0));
}

/* ---------- La subida ---------- */

/** El zigzag: de dónde sale (x), su medio ancho (m) y hasta dónde va el mirador (m de largo). */
const X_INICIO = 66;
export const ANCHO_ZIGZAG_PALAU = 12;
/** El mirador de arriba: a lo largo (x) y de lado (|z|, hasta donde sobresale por el lado de la subida). */
export const MIRADOR = { largo: 64, sobresale: 0.4 } as const;
/** Un saliente sale de la cáscara, como mucho, esto (m): arriba, terrazas. */
export const FONDO_MAX_PALAU = 8;

/** Donde empieza la subida: lo alto del zócalo. Donde acaba: el mirador (880 m). */
export const BASE_PALAU = SUELO_PALAU + PALAU.zocalo.alto;
export const CIMA_PALAU = SUELO_PALAU + PALAU.alto;
/** Hasta dónde llega el mirador por el lado de la subida (|z|): sobre el último saliente. */
export const Z_MIRADOR = zCara(PALAU.x, PALAU.alto - 2.5) + MIRADOR.sobresale;

export interface SalientePalau {
  tipo: TipoSaliente;
  /** Centro a lo largo del Palau (x, m). */
  u: number;
  /** Altura de la cara de arriba (m del juego). */
  y: number;
  ancho: number;
  /** Cuánto sale de la cáscara hacia −z (m). */
  fondo: number;
  grosor: number;
}

export interface Palau {
  indice: number;
  base: number;
  /** El mirador (m): el «rellano» de este tramo. */
  rellano: number;
  salientes: SalientePalau[];
}

/** Por dónde va el medio del zigzag a la altura `y`: del frente hacia el medio del edificio. */
export function centroZigzag(y: number): number {
  const h = y - SUELO_PALAU;
  return X_INICIO + (PALAU.x - X_INICIO) * Math.min(Math.max(h / (PALAU.alto - 14), 0), 1);
}

/** El borde de la cáscara en el saliente (z < 0) y su cara de fuera. */
export function zInterior(s: SalientePalau): number {
  return -zCara(s.u, s.y - SUELO_PALAU);
}

const PROBABILIDAD = { bajo: 0.18, alto: 0.15 } as const;

function elegirTipo(azar: Azar, anterior: TipoSaliente | undefined): TipoSaliente {
  const n = azar();
  const tipo: TipoSaliente = n < PROBABILIDAD.bajo ? 'bajo' : n < PROBABILIDAD.bajo + PROBABILIDAD.alto ? 'alto' : 'normal';
  return tipo === 'alto' && anterior === 'alto' ? 'normal' : tipo;
}

export function generarPalau(semilla: number): Palau {
  const azar = crearAzar(derivarSemilla(semilla, INDICE_PALAU));
  const salientes: SalientePalau[] = [];
  const { subida: [NMIN, NMAX] } = TIPOS.normal;
  let y = BASE_PALAU;
  let sentido = azar() < 0.5 ? -1 : 1;
  let anterior: SalientePalau | undefined;

  for (;;) {
    const resto = CIMA_PALAU - y;
    if (resto <= NMAX) break;
    let tipo: TipoSaliente;
    // ¿Toca dar la vuelta? Si el siguiente se pasaría del zigzag EN EL SENTIDO
    // EN QUE VA (el medio se va moviendo: yendo hacia él, nunca se gira).
    const medio = centroZigzag(y + 2.5);
    if (anterior && anterior.tipo !== 'descansillo' && (anterior.u + sentido * (anterior.ancho / 2 + 3) - medio) * sentido > ANCHO_ZIGZAG_PALAU) {
      tipo = 'descansillo';
    } else if (resto <= 8) {
      tipo = 'normal';
    } else {
      tipo = anterior ? elegirTipo(azar, anterior.tipo) : 'normal';
    }
    const girar = anterior?.tipo === 'descansillo';

    let [min, max] = TIPOS[tipo].subida;
    if (resto <= 8) {
      // Los últimos: que el hueco hasta el mirador también mida 2-3 m.
      if (resto <= NMAX * 2) {
        min = Math.max(NMIN, resto - NMAX);
        max = Math.min(NMAX, resto - NMIN);
      } else {
        max = Math.min(NMAX, resto - NMIN * 2);
      }
    } else {
      max = Math.min(max, resto - NMIN * 2);
      min = Math.min(min, max);
    }
    const m = TIPOS[tipo];
    y += entre(azar, min, max);
    const ancho = tipo === 'descansillo' ? entre(azar, 3, 3.8) : entre(azar, m.ancho[0], m.ancho[1]);
    const grosor = entre(azar, m.grosor[0], m.grosor[1]);

    let u: number;
    if (!anterior) {
      u = centroZigzag(y) + entre(azar, -1.5, 1.5);
    } else if (girar) {
      sentido = -sentido;
      u = anterior.u + sentido * (anterior.ancho / 2 + entre(azar, 0.2, 0.9) + ancho / 2) - sentido * anterior.ancho * 0.5;
    } else {
      const hueco = entre(azar, m.hueco[0], m.hueco[1]);
      u = anterior.u + sentido * (anterior.ancho / 2 + hueco + ancho / 2);
    }
    // Sale lo que la cáscara se ha metido desde el anterior: su borde de fuera
    // queda casi a plomo del de abajo y un salto de lado cae encima.
    const metido = anterior ? Math.max(zCara(anterior.u, anterior.y - SUELO_PALAU) - zCara(u, y - SUELO_PALAU), 0) : 0;
    const fondo = Math.min(Math.max(Math.min(entre(azar, m.fondo[0], m.fondo[1]), 2.6) + metido, m.fondo[0]), FONDO_MAX_PALAU);
    // Al revés, yendo hacia el medio la cáscara se abomba hacia fuera: si el
    // nuevo queda más fuera, el anterior se hace más hondo para que lo que se
    // pisa de los dos siga solapándose (si no, el salto de lado se queda corto).
    if (anterior) {
      const abombado = zCara(u, y - SUELO_PALAU) - zCara(anterior.u, anterior.y - SUELO_PALAU);
      if (abombado > 0) anterior.fondo = Math.min(Math.max(anterior.fondo, abombado + 1.2), FONDO_MAX_PALAU);
    }
    const s: SalientePalau = { tipo, u, y, ancho, fondo, grosor };
    salientes.push(s);
    anterior = s;
  }
  return { indice: INDICE_PALAU, base: BASE_PALAU, rellano: CIMA_PALAU, salientes };
}

/* ---------- Dónde se pisa (marco de Valencia) ---------- */

/** ¿(x, z) cae encima del saliente? */
export function sobreSalientePalau(s: SalientePalau, x: number, z: number, margen = 0): boolean {
  const dentro = zInterior(s);
  return Math.abs(x - s.u) <= s.ancho / 2 + margen && z <= dentro + margen && z >= dentro - s.fondo - margen;
}

/** ¿(x, z) está sobre el mirador de arriba? */
export function sobreMirador(x: number, z: number, margen = 0): boolean {
  return Math.abs(x - PALAU.x) <= MIRADOR.largo / 2 + margen && Math.abs(z) <= Z_MIRADOR + margen;
}

/** ¿(x, z) está sobre el zócalo (y fuera del edificio)? */
export function sobreZocalo(x: number, z: number): boolean {
  const rx = PALAU.casco.rx + PALAU.zocalo.margen;
  const rz = PALAU.cascaras.rz + PALAU.zocalo.margen;
  return ((x - PALAU.x) / rx) ** 2 + ((z - PALAU.z) / rz) ** 2 <= 1;
}

/** Lo más alto que se pisa del Palau debajo de (x, z) sin pasar de `techo`: zócalo, salientes y mirador. */
export function alturaSueloPalau(p: Palau, x: number, z: number, techo: number): number {
  let mejor = -Infinity;
  const zocalo = SUELO_PALAU + PALAU.zocalo.alto;
  if (zocalo <= techo && sobreZocalo(x, z)) mejor = zocalo;
  if (p.rellano <= techo && sobreMirador(x, z)) mejor = Math.max(mejor, p.rellano);
  for (const s of p.salientes) {
    if (s.y <= techo && s.y > mejor && sobreSalientePalau(s, x, z)) mejor = s.y;
  }
  return mejor;
}

/* ---------- Por dónde no se pasa (marco de Valencia) ---------- */

const RADIO_CUERPO = CONFIG.escalador.radio;

/** Saca el punto de una elipse (agrandada con el cuerpo) hacia fuera, desde el centro. Devuelve hacia dónde queda. */
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
  const gx = (p.x - e.x) / (rx * rx);
  const gz = (p.z - e.z) / (rz * rz);
  const n = Math.hypot(gx, gz);
  return { nx: -gx / n, nz: -gz / n };
}

/**
 * El Palau a la altura `y` (m del juego): el corte del casco y, de donde
 * empiezan hacia atrás, el de las cáscaras (más estrecho cuanto más arriba).
 * En el mirador, su barandilla (por todos los lados menos el de la subida).
 */
export const fueraDelPalau: Limite = (p, y) => {
  const h = y - SUELO_PALAU;
  if (h >= PALAU.alto - 0.3) {
    // En el mirador: barandilla a lo largo del lado de +z y en las dos puntas.
    if (Math.abs(p.z) > Z_MIRADOR + 1 || Math.abs(p.x - PALAU.x) > MIRADOR.largo / 2 + 1) return null;
    const max = MIRADOR.largo / 2 - RADIO_CUERPO;
    let choque: { nx: number; nz: number } | null = null;
    if (p.x - PALAU.x > max) [p.x, choque] = [PALAU.x + max, { nx: 1, nz: 0 }];
    if (PALAU.x - p.x > max) [p.x, choque] = [PALAU.x - max, { nx: -1, nz: 0 }];
    if (p.z > Z_MIRADOR - RADIO_CUERPO) [p.z, choque] = [Z_MIRADOR - RADIO_CUERPO, { nx: 0, nz: 1 }];
    return choque;
  }
  const kc = anchura(h, ELIPSOIDE_CASCO.ry);
  if (kc > 0) {
    const c = fueraDeElipse(p, { x: PALAU.x, z: PALAU.z, rx: ELIPSOIDE_CASCO.rx * kc, rz: ELIPSOIDE_CASCO.rz * kc });
    if (c) return c;
  }
  const ks = anchura(h, ELIPSOIDE_CASCARAS.ry);
  if (ks <= 0) return null;
  // Por delante del corte de las cáscaras (abiertas) no hay nada más que el casco.
  const corte = PALAU.x - Math.cos(PHI_DELANTE) * ELIPSOIDE_CASCARAS.rx * ks;
  if (p.x < corte) return null;
  return fueraDeElipse(p, { x: PALAU.x, z: PALAU.z, rx: ELIPSOIDE_CASCARAS.rx * ks, rz: ELIPSOIDE_CASCARAS.rz * ks });
};

/**
 * ¿Está junto al costado de la subida (o encima, subiendo)? Ahí la cámara se
 * pone detrás del escalador mirando a la cáscara (hacia +z), como en la ladera.
 */
export function enCostadoPalau(x: number, z: number): boolean {
  if (z >= 0 || x < PALAU.cascaras.desde - 10) return false;
  const rx = PALAU.casco.rx + PALAU.zocalo.margen + 25;
  const rz = PALAU.cascaras.rz + PALAU.zocalo.margen + 25;
  return ((x - PALAU.x) / rx) ** 2 + (z / rz) ** 2 <= 1;
}

/* ---------- Fragmentos ---------- */

/** Un fragmento por tercio, flotando sobre un saliente (ids 30, 31, 32), en el marco de Valencia. */
export function generarFragmentosPalau(semilla: number, p: Palau, fragmentosPorTramo: number): { id: number; x: number; y: number; z: number }[] {
  const azar = crearAzar(derivarSemilla(semilla, 1000 + p.indice));
  const alto = p.rellano - p.base;
  const fragmentos: { id: number; x: number; y: number; z: number }[] = [];
  for (let i = 0; i < fragmentosPorTramo; i++) {
    const desde = p.base + (alto * i) / fragmentosPorTramo;
    const hasta = p.base + (alto * (i + 1)) / fragmentosPorTramo;
    const candidatos = p.salientes.filter((s) => s.y > desde + 5 && s.y < hasta && s.tipo !== 'descansillo');
    if (candidatos.length === 0) continue;
    const s = candidatos[Math.floor(azar() * candidatos.length)]!;
    fragmentos.push({ id: p.indice * 10 + i, x: s.u, y: s.y + 1.2, z: zInterior(s) - Math.min(0.8, s.fondo / 2) });
  }
  return fragmentos;
}

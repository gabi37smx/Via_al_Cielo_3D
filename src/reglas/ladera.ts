/*
 * El tramo 3 (440-660 m): LA LADERA de la montaña nevada (decisión 040).
 * LÓGICA PURA: sin Three.js, sin DOM y sin red.
 *
 * Al llegar al rellano de los 440 m (lo alto de la grieta), un PASILLO recto
 * atraviesa la roca hacia fuera y sale a una EXPLANADA nevada. Delante se
 * levanta la montaña: una pared inclinada (la «cara») que se aleja al subir.
 * Se sube por salientes que salen de la cara en ZIGZAG: unos cuantos hacia un
 * lado, un descansillo, y de vuelta hacia el otro. Arriba, a 660 m, la CIMA:
 * una explanada que ocupa todo el ancho (se llega desde cualquier saliente).
 *
 * Todo se mide en un marco propio que sale del ángulo del pasillo:
 *   d = distancia hacia fuera (desde el eje del pozo, en la dirección del pasillo)
 *   u = de lado (a lo largo de la cara de la montaña)
 *
 * La cara está en d = dCara(y): se aleja PENDIENTE m por cada metro de subida.
 * Los salientes salen de la cara hacia el pasillo (d más pequeña).
 *
 * Los salientes son CUÑAS DE HIELO (decisión 041): salen de la cara lo que se
 * ha alejado la montaña desde el anterior (así un salto de lado cae encima) y
 * su cara de arriba baja un poco hacia la montaña (INCLINACION_HIELO): quien
 * cae encima se desliza hacia dentro, hasta la pared, y no se va cayendo.
 */
import { CONFIG } from '../config.ts';
import { crearAzar, derivarSemilla, entre, type Azar } from './azar.ts';
import { METROS_POR_TRAMO, RADIO_PARED, TIPOS, type TipoSaliente } from './torre.ts';

/** El tramo de la ladera es el tercero (índice 2): de 440 a 660 m. */
export const INDICE_LADERA = 2;
export const BASE_LADERA = INDICE_LADERA * METROS_POR_TRAMO;
export const CIMA = BASE_LADERA + METROS_POR_TRAMO;

/** El pasillo: de la pared del pozo a la ladera de la colina, a ras del rellano (m). */
export const TUNEL = { ancho: 3.2, alto: 4 } as const;
/**
 * Radio de la colina de roca que rodea el pozo (m): el pasillo la atraviesa
 * de RADIO_PARED a RADIO_COLINA. Por fuera, la explanada nevada.
 */
export const RADIO_COLINA = 22;
/** Altura de lo alto de la colina (m): donde acaba la pared de la grieta (y su cielo). */
export const ALTO_COLINA = BASE_LADERA + 20;
/** Dónde empieza la cara de la montaña, a ras de la explanada (d, en m). */
export const D_CARA = 34;
/** Cuánto se aleja la cara por cada metro que se sube (≈ 66° de inclinación). */
export const PENDIENTE = 0.45;
/** El zigzag va de −ANCHO_ZIGZAG a +ANCHO_ZIGZAG (m de lado). */
export const ANCHO_ZIGZAG = 16;
/**
 * La cima: cuánto sobresale su CORNISA de roca por delante de la cara (m).
 * Poco, para que se vea el borde desde arriba y no se atraviese desde abajo.
 */
export const FONDO_CIMA = 0.4;
/**
 * Detrás de la cima se levanta el PICO (un cono): su pie empieza a ATRAS m
 * del borde y tiene este radio a la altura de la cima (m). No se entra en él.
 */
export const PICO = { atras: 14, radio: 54 } as const;
/** La cima ocupa todo lo alto de la cara (m de lado, de −A/2 a +A/2). */
export const ANCHO_CARA = 600;
/**
 * Cuánto baja la cara de arriba de un saliente por cada metro hacia la
 * montaña (≈ 7°): lo justo para que el hielo deslice hacia dentro.
 */
export const INCLINACION_HIELO = 0.12;
/** Un saliente de la ladera sale de la cara, como mucho, esto (m). */
export const FONDO_MAX = 4.2;
/** Dónde cuelgan los crampones en el pasillo (d) y de qué lado (u). */
export const CRAMPONES = { d: RADIO_COLINA - 3.2, lado: 1 } as const;
/**
 * ±24 m: el descansillo de un giro puede quedar hasta 23,4 m de lado (el
 * saliente anterior a ≤ 17,6 m, más su hueco y los 3,8 m del descansillo).
 */
export const ANCHO_CIMA = ANCHO_ZIGZAG * 2 + 16;
/** Lejos de todo hay un límite (m): la explanada no es infinita. */
export const RADIO_MUNDO = 220;

/** Donde está la cara de la montaña a la altura `y` (d). */
export function dCara(y: number): number {
  return D_CARA + Math.max(y - BASE_LADERA, 0) * PENDIENTE;
}

export interface SalienteLadera {
  tipo: TipoSaliente;
  /** Centro de lado (m). */
  u: number;
  /** Altura de la cara de arriba JUNTO A LA PARED, lo más bajo de la cuña (m). */
  y: number;
  /** Ancho de lado (m). */
  ancho: number;
  /** Cuánto sobresale de la cara (m). */
  fondo: number;
  /** Grosor de la roca (m): solo se ve. */
  grosor: number;
}

export interface Ladera {
  indice: number;
  base: number;
  /** La cima (m): el «rellano» de este tramo. */
  rellano: number;
  /** Ángulo del pasillo alrededor del pozo (rad): de él salen d y u. */
  angulo: number;
  /** La semilla de la partida: de ella salen también las águilas y las ráfagas (reglas/aire.ts). */
  semilla: number;
  salientes: SalienteLadera[];
}

/* ---------- El marco de la ladera ---------- */

/** Hacia fuera (N) y de lado (T), en el plano (x, z). */
export function ejes(l: Ladera): { nx: number; nz: number; tx: number; tz: number } {
  const nx = Math.cos(l.angulo);
  const nz = Math.sin(l.angulo);
  return { nx, nz, tx: -nz, tz: nx };
}

export function aLocal(l: Ladera, x: number, z: number): { d: number; u: number } {
  const e = ejes(l);
  return { d: x * e.nx + z * e.nz, u: x * e.tx + z * e.tz };
}

export function aMundo(l: Ladera, d: number, u: number): { x: number; z: number } {
  const e = ejes(l);
  return { x: e.nx * d + e.tx * u, z: e.nz * d + e.tz * u };
}

/** Centro de lo que se pisa de un saliente, en (d, u). */
export function centroSaliente(s: SalienteLadera): { d: number; u: number } {
  return { d: dCara(s.y) - s.fondo / 2, u: s.u };
}

/** Altura de la cara de arriba del saliente en `d`: sube hacia el borde de fuera. */
export function alturaEnSaliente(s: SalienteLadera, d: number): number {
  const haciaFuera = Math.min(Math.max(dCara(s.y) - d, 0), s.fondo);
  return s.y + haciaFuera * INCLINACION_HIELO;
}

/** El centro del pico, en el plano (x, z). */
export function centroPico(l: Ladera): { x: number; z: number } {
  return aMundo(l, dCara(l.rellano) + PICO.atras + PICO.radio, 0);
}

/** Altura del borde de fuera del saliente (lo más alto de la cuña). */
export function alturaBorde(s: SalienteLadera): number {
  return s.y + s.fondo * INCLINACION_HIELO;
}

/** ¿(d, u) cae encima del saliente? */
export function sobreSalienteLadera(s: SalienteLadera, d: number, u: number, margen = 0): boolean {
  const cara = dCara(s.y);
  return d >= cara - s.fondo - margen && d <= cara + margen && Math.abs(u - s.u) <= s.ancho / 2 + margen;
}

/* ---------- Generar la ladera ---------- */

/** Probabilidad de cada tipo (el resto, normal). Sin cornisas: el zigzag ya cruza de lado a lado. */
const PROBABILIDAD = { bajo: 0.18, alto: 0.15 } as const;

function elegirTipo(azar: Azar, anterior: TipoSaliente | undefined): TipoSaliente {
  const n = azar();
  const tipo: TipoSaliente = n < PROBABILIDAD.bajo ? 'bajo' : n < PROBABILIDAD.bajo + PROBABILIDAD.alto ? 'alto' : 'normal';
  return tipo === 'alto' && anterior === 'alto' ? 'normal' : tipo;
}

export function generarLadera(semilla: number): Ladera {
  const azar = crearAzar(derivarSemilla(semilla, INDICE_LADERA));
  const angulo = azar() * Math.PI * 2;
  const salientes: SalienteLadera[] = [];
  const { subida: [NMIN, NMAX] } = TIPOS.normal;

  let y = BASE_LADERA;
  // Se empieza delante del pasillo y hacia un lado al azar.
  let sentido = azar() < 0.5 ? -1 : 1;
  let anterior: SalienteLadera | undefined;

  for (;;) {
    const resto = CIMA - y;
    if (resto <= NMAX) break;

    // ¿Toca dar la vuelta? Si el siguiente se saldría del zigzag, descansillo y cambio de sentido.
    let tipo: TipoSaliente;
    let girar = false;
    if (anterior && anterior.tipo !== 'descansillo' && Math.abs(anterior.u + sentido * (anterior.ancho / 2 + 3)) > ANCHO_ZIGZAG) {
      tipo = 'descansillo';
    } else if (resto <= 8) {
      tipo = 'normal';
    } else {
      tipo = anterior ? elegirTipo(azar, anterior.tipo) : 'normal';
    }
    if (anterior?.tipo === 'descansillo') girar = true;

    let [min, max] = TIPOS[tipo].subida;
    if (resto <= 8) {
      // Los últimos: que el hueco hasta la cima también mida 2-3 m.
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
    const subida = entre(azar, min, max);
    y += subida;
    const ancho = tipo === 'descansillo' ? entre(azar, 3, 3.8) : entre(azar, m.ancho[0], m.ancho[1]);
    // Sale lo que se ha alejado la cara desde el anterior: su borde de fuera
    // queda casi encima del de abajo y un salto de lado cae encima.
    const fondo = Math.min(Math.min(entre(azar, m.fondo[0], m.fondo[1]), 2.6) + subida * PENDIENTE, FONDO_MAX);
    const grosor = entre(azar, m.grosor[0], m.grosor[1]);

    let u: number;
    if (!anterior) {
      u = entre(azar, -1.5, 1.5);
    } else if (girar) {
      // Después del descansillo se vuelve: el siguiente arranca desde su borde de dentro.
      sentido = -sentido;
      u = anterior.u + sentido * (anterior.ancho / 2 + entre(azar, 0.2, 0.9) + ancho / 2) - sentido * anterior.ancho * 0.5;
    } else {
      const hueco = entre(azar, m.hueco[0], m.hueco[1]);
      u = anterior.u + sentido * (anterior.ancho / 2 + hueco + ancho / 2);
    }
    const s: SalienteLadera = { tipo, u, y, ancho, fondo, grosor };
    salientes.push(s);
    anterior = s;
  }

  return { indice: INDICE_LADERA, base: BASE_LADERA, rellano: CIMA, angulo, semilla, salientes };
}

/* ---------- Dónde se pisa ---------- */

/** ¿(d, u) está dentro del pasillo (en planta)? */
export function enPasillo(d: number, u: number): boolean {
  return d >= RADIO_PARED - 1.5 && d <= RADIO_COLINA + 0.5 && Math.abs(u) <= TUNEL.ancho / 2;
}

/**
 * El suelo más alto que hay debajo de (x, z) sin pasar de `techo`, en la
 * ladera: el pasillo, la explanada, lo alto de la colina, los salientes y la
 * cima. Los salientes son de un sentido, como en el pozo.
 */
export function alturaSueloLadera(l: Ladera, x: number, z: number, techo: number, margen = 0): number {
  if (techo < l.base) return -Infinity;
  const { d, u } = aLocal(l, x, z);
  const r = Math.hypot(x, z);
  let mejor = -Infinity;
  // Pasillo y explanada (fuera de la colina), a ras del rellano.
  if (enPasillo(d, u) || (r >= RADIO_COLINA - margen && r <= RADIO_MUNDO)) mejor = l.base;
  // Lo alto de la colina (alrededor del agujero del pozo).
  if (ALTO_COLINA <= techo && r >= RADIO_PARED && r <= RADIO_COLINA + margen) mejor = Math.max(mejor, ALTO_COLINA);
  // La cima: desde el borde de la cara hacia dentro, por todo lo alto de la cara (el pico la cierra por detrás).
  if (l.rellano <= techo && d >= dCara(l.rellano) - FONDO_CIMA - margen && Math.abs(u) <= ANCHO_CARA / 2 && r <= RADIO_MUNDO) mejor = Math.max(mejor, l.rellano);
  for (const s of l.salientes) {
    if (!sobreSalienteLadera(s, d, u, margen)) continue;
    const h = alturaEnSaliente(s, d);
    if (h <= techo && h > mejor) mejor = h;
  }
  return mejor;
}

/* ---------- Por dónde no se puede pasar ---------- */

/**
 * Un límite del mundo: recibe dónde quiere estar el escalador (lo corrige si
 * se mete en la roca) y a qué altura. Devuelve hacia dónde empuja la roca
 * (para quitar esa parte de la velocidad y que se deslice) o null si nada.
 */
export type Limite = (p: { x: number; z: number }, y: number) => { nx: number; nz: number } | null;

const RADIO_CUERPO = CONFIG.escalador.radio;

/** Dentro de un círculo de radio `r` (la pared del pozo). */
function dentroDeCirculo(p: { x: number; z: number }, r: number) {
  const actual = Math.hypot(p.x, p.z);
  if (actual <= r) return null;
  const nx = p.x / actual;
  const nz = p.z / actual;
  p.x = nx * r;
  p.z = nz * r;
  return { nx, nz };
}

/** El límite de siempre: la pared del pozo. */
export const limitePozo: Limite = (p) => dentroDeCirculo(p, RADIO_PARED - RADIO_CUERPO);

/**
 * El límite con la ladera: dentro del pozo, su pared; a la altura del
 * pasillo se puede salir por él (y sus paredes no dejan salirse de lado);
 * fuera, no se entra en la colina ni en la cara de la montaña.
 */
export function limiteMundo(l: Ladera): Limite {
  const e = ejes(l);
  const rPozo = RADIO_PARED - RADIO_CUERPO;
  return (p, y) => {
    const r = Math.hypot(p.x, p.z);
    const { d, u } = aLocal(l, p.x, p.z);

    // 1 · Por debajo de la ladera solo existe el pozo.
    if (y < l.base - 0.3) return dentroDeCirculo(p, rPozo);

    // 2 · Dentro de la roca de la colina (entre el pozo y la explanada).
    const enColina = r > rPozo && r < RADIO_COLINA + RADIO_CUERPO && y < ALTO_COLINA;
    if (enColina) {
      if (d > 0 && Math.abs(u) <= TUNEL.ancho / 2 + RADIO_CUERPO) {
        // En el pasillo: sus paredes de lado. A cualquier altura: saltando
        // dentro no debe devolverle de golpe al pozo (el techo no frena).
        const max = TUNEL.ancho / 2 - RADIO_CUERPO;
        if (Math.abs(u) <= max) return null;
        const lado = Math.sign(u);
        const corregido = aMundo(l, d, lado * max);
        p.x = corregido.x;
        p.z = corregido.z;
        return { nx: e.tx * lado, nz: e.tz * lado };
      }
      // Fuera del pasillo: a la roca más cercana, el pozo o la explanada.
      if (r < (rPozo + RADIO_COLINA) / 2) return dentroDeCirculo(p, rPozo);
      const fuera = RADIO_COLINA + RADIO_CUERPO;
      const nx = p.x / r;
      const nz = p.z / r;
      p.x = nx * fuera;
      p.z = nz * fuera;
      return { nx: -nx, nz: -nz };
    }

    // 3 · En la cima ya no hay cara delante: se anda hacia dentro hasta el pico.
    if (y >= l.rellano - 0.3 && r >= RADIO_COLINA) {
      const pico = centroPico(l);
      const dx = p.x - pico.x;
      const dz = p.z - pico.z;
      const lejos = Math.hypot(dx, dz);
      const minimo = PICO.radio + RADIO_CUERPO;
      if (lejos < minimo && lejos > 1e-9) {
        p.x = pico.x + (dx / lejos) * minimo;
        p.z = pico.z + (dz / lejos) * minimo;
        return { nx: -dx / lejos, nz: -dz / lejos };
      }
      return r > RADIO_MUNDO ? dentroDeCirculo(p, RADIO_MUNDO) : null;
    }

    // 4 · Fuera: no meterse en la cara de la montaña.
    const max = dCara(y) - RADIO_CUERPO;
    if (r >= RADIO_COLINA && d > max) {
      const corregido = aMundo(l, max, u);
      p.x = corregido.x;
      p.z = corregido.z;
      return { nx: e.nx, nz: e.nz };
    }
    // 5 · Y no irse lejísimos.
    if (r > RADIO_MUNDO) return dentroDeCirculo(p, RADIO_MUNDO);
    return null;
  };
}

/**
 * La cámara, fuera, tampoco puede meterse en la roca: ni en la cara de la
 * montaña ni en la colina (salvo por el pasillo). Recibe el segmento que va de
 * donde mira (`m`, junto al escalador) a donde querría estar (`c`) y devuelve
 * qué fracción se puede usar (0-1). Igual que `acortarPorPared` en el pozo.
 */
export function acortarFuera(l: Ladera, m: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }, margen = 0.4): number {
  let t = 1;
  // 1 · La cara: d(t) ≤ dCara(y(t)) − margen. Las dos cosas cambian en línea recta con t.
  const a = aLocal(l, m.x, m.z);
  const b = aLocal(l, c.x, c.z);
  const exceso = (d: number, y: number) => d - (dCara(y) - margen);
  const f0 = exceso(a.d, m.y);
  const f1 = exceso(b.d, c.y);
  if (f1 > 0 && f0 <= 0) t = Math.min(t, -f0 / (f1 - f0));
  // 2 · La colina: fuera del círculo de RADIO_COLINA (por debajo de su cima y fuera del pasillo).
  const enPasillo = Math.abs(b.u) < TUNEL.ancho / 2 && b.d > 0;
  if (c.y < ALTO_COLINA && !enPasillo && Math.hypot(c.x, c.z) < RADIO_COLINA + margen && Math.hypot(m.x, m.z) >= RADIO_COLINA + margen) {
    // |m + t·(c − m)| = R: la raíz más pequeña.
    const dx = c.x - m.x;
    const dz = c.z - m.z;
    const A = dx * dx + dz * dz;
    const B = 2 * (m.x * dx + m.z * dz);
    const C = m.x * m.x + m.z * m.z - (RADIO_COLINA + margen) ** 2;
    const disc = B * B - 4 * A * C;
    if (A > 1e-9 && disc >= 0) t = Math.min(t, Math.max((-B - Math.sqrt(disc)) / (2 * A), 0));
  }
  return Math.max(t, 0);
}

/** Dónde se aparece al empezar en la ladera (`?altura=440`): en la explanada, delante del pasillo. */
export function salidaLadera(l: Ladera): { x: number; z: number } {
  return aMundo(l, RADIO_COLINA + 3, 0);
}

/* ---------- Los crampones ---------- */

/**
 * ¿Lleva puestos los crampones (pinchos en las botas para el hielo)? Se los
 * pone al pasar por delante del soporte del pasillo, justo antes de salir a la
 * nieve (o si ya está fuera), y se los quita si vuelve a la roca del pozo.
 * Entre el pozo y el soporte se queda como estaba (`antes`): así no se los
 * pone y se los quita una y otra vez si se para justo delante.
 */
export function conCrampones(l: Ladera, x: number, y: number, z: number, antes: boolean): boolean {
  if (y < l.base - 1) return false;
  const r = Math.hypot(x, z);
  if (r >= RADIO_COLINA || y >= ALTO_COLINA - 0.5) return true;
  const { d, u } = aLocal(l, x, z);
  if (enPasillo(d, u) && d >= CRAMPONES.d) return true;
  if (r < RADIO_PARED) return false;
  return antes;
}

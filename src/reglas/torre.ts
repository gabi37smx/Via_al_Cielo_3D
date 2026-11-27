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
 *
 * Variedad (idea I7, decisión 031): cada saliente es de un TIPO (normal,
 * bajo, alto, cornisa larga o descansillo) y el tipo decide cuánto sube, qué
 * hueco deja con el anterior y qué medidas tiene. Así la subida cambia de
 * ritmo y no es una escalera de peldaños iguales.
 */
import { crearAzar, derivarSemilla, entre, type Azar } from './azar.ts';

/** Metros de cada tramo (la API del ranking lo valida: `METROS_POR_PANTALLA`). */
export const METROS_POR_TRAMO = 220;

/**
 * Los tramos que hay, en orden (decisión 024: sin repetir escenario). El 2D
 * tenía 2 pantallas de cada cueva; aquí cada una es UN tramo de 220 m, porque
 * en 3D cada tramo ya son ~90 salientes y más de un minuto de subida. Los dos
 * primeros son el pozo (este archivo); el tercero, la ladera (ladera.ts).
 */
export const ESCENARIOS = ['La cueva', 'La grieta', 'Aire libre'] as const;

/** En qué tramo se está a la altura `y` (0 = la cueva). Encima del último, el último. */
export function tramoEnAltura(y: number): number {
  return Math.min(Math.max(Math.floor(y / METROS_POR_TRAMO), 0), ESCENARIOS.length - 1);
}

/**
 * Radio de la pared que se escala = hasta dónde se puede llegar (m). Con 12 m
 * caben ~30 salientes por vuelta (3 vueltas por tramo) y desde un lado se ve
 * la pared de enfrente; con 22 m la espiral casi no se notaba.
 */
export const RADIO_PARED = 12;
/**
 * Radio por el que pasa el escalador al ir de un saliente a otro (m). Con él
 * se pasan los huecos (en metros) a ángulos alrededor del pozo.
 */
export const RADIO_CAMINO = RADIO_PARED - 1.1;

export type TipoSaliente = 'normal' | 'bajo' | 'alto' | 'cornisa' | 'descansillo';

interface Medidas {
  /** Cuánto sube desde el saliente anterior (m). */
  subida: [number, number];
  /** Hueco en horizontal entre el borde del anterior y el de este (m; negativo = se solapan). */
  hueco: [number, number];
  ancho: [number, number];
  /** Cuánto sobresale de la pared (m). */
  fondo: [number, number];
  /** Grosor de la roca (m): solo se ve, no cambia lo que se pisa. */
  grosor: [number, number];
}

/**
 * Las medidas de cada tipo. Los límites salen de los saltos (config.ts):
 * el salto normal sube 3,5 m, el doble 5,5 m, y agarrándose al borde se
 * llega a 1,7 m más. Un `alto` (hasta 4,2 m) pide doble salto o trepar, por
 * eso su hueco es pequeño. Un `bajo` deja descansar y puede estar más lejos.
 */
export const TIPOS: Record<TipoSaliente, Medidas> = {
  normal: { subida: [2, 3], hueco: [0.3, 1.4], ancho: [1.4, 2.4], fondo: [1.5, 2.4], grosor: [0.35, 0.6] },
  bajo: { subida: [1, 1.6], hueco: [0.5, 2], ancho: [1.6, 2.6], fondo: [1.6, 2.6], grosor: [0.3, 0.5] },
  alto: { subida: [3.3, 4.2], hueco: [-0.2, 0.7], ancho: [1.6, 2.4], fondo: [1.6, 2.4], grosor: [0.5, 0.9] },
  cornisa: { subida: [2, 2.6], hueco: [0.3, 1.2], ancho: [4.5, 6.5], fondo: [1.3, 1.8], grosor: [0.3, 0.45] },
  descansillo: { subida: [1.5, 2.5], hueco: [0.3, 1.2], ancho: [3.2, 4], fondo: [2.6, 3], grosor: [0.6, 0.9] },
};

/** Cada cuántos metros, como mucho, hay un descansillo. */
export const METROS_ENTRE_DESCANSILLOS = 40;
/** Cerca del rellano solo hay salientes normales: el final siempre se puede repartir. */
export const METROS_FINAL_NORMAL = 8;

/** Probabilidad de cada tipo (el resto, `normal`). */
const PROBABILIDAD = { bajo: 0.15, alto: 0.15, cornisa: 0.08 } as const;

/** Separación vertical más pequeña y más grande de todos los tipos (m). */
export const SUBIDA_MIN = Math.min(...Object.values(TIPOS).map((t) => t.subida[0]));
export const SUBIDA_MAX = Math.max(...Object.values(TIPOS).map((t) => t.subida[1]));

export interface Saliente {
  tipo: TipoSaliente;
  /** Ángulo alrededor del pozo (radianes), en el centro del saliente. */
  angulo: number;
  /** Altura de la cara de arriba, donde se pisa (m). */
  y: number;
  /** Ancho a lo largo de la pared (m). */
  ancho: number;
  /** Cuánto sobresale de la pared (m). */
  fondo: number;
  /** Grosor de la roca (m). */
  grosor: number;
}

export interface Tramo {
  indice: number;
  /** Altura del suelo donde empieza el tramo (m). */
  base: number;
  /** Altura del rellano donde acaba (m) = base del tramo siguiente. */
  rellano: number;
  salientes: Saliente[];
}

/** Grosor del rellano (m). */
export const GROSOR_RELLANO = 0.45;
/** Cuánto sobresale de la pared el rellano que cierra cada tramo (m). */
export const FONDO_RELLANO = 3;
/** Radio del borde interior del rellano: desde aquí hasta la pared se pisa. */
export const RADIO_RELLANO = RADIO_PARED - FONDO_RELLANO;

/*
 * La caja real de cada saliente: un poco metida en la pared para que no se
 * vea una rendija. La usan el dibujo (mundo/torre.ts) y el suelo (abajo), así
 * lo que se ve y lo que se pisa son exactamente lo mismo.
 */
const METIDO_EN_PARED = 0.2;
/** Distancia del eje del pozo al centro de la caja del saliente (m). */
export function radioCentroCaja(s: Saliente): number {
  return RADIO_PARED - s.fondo / 2 + METIDO_EN_PARED / 2;
}
/** Fondo de la caja, contando lo que se mete en la pared (m). */
export function fondoCaja(s: Saliente): number {
  return s.fondo + METIDO_EN_PARED;
}

/** Punto a `radio` m del eje en la dirección `angulo`. */
export function puntoEnAngulo(angulo: number, radio: number): { x: number; z: number } {
  return { x: Math.cos(angulo) * radio, z: Math.sin(angulo) * radio };
}

/** Posición del centro de lo que se pisa de un saliente, en el plano (x, z). */
export function posicionSaliente(s: Saliente): { x: number; z: number } {
  return puntoEnAngulo(s.angulo, RADIO_PARED - s.fondo / 2);
}

/** ¿El punto (x, z) cae encima del saliente? `margen` amplía la caja (m). */
export function sobreSaliente(s: Saliente, x: number, z: number, margen = 0): boolean {
  const cos = Math.cos(s.angulo);
  const sin = Math.sin(s.angulo);
  const rc = radioCentroCaja(s);
  const dx = x - cos * rc;
  const dz = z - sin * rc;
  const haciaFuera = dx * cos + dz * sin; // a lo largo del radio
  const deLado = dx * sin - dz * cos; // a lo largo de la pared
  return Math.abs(haciaFuera) <= fondoCaja(s) / 2 + margen && Math.abs(deLado) <= s.ancho / 2 + margen;
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

/** Como `alturaSuelo`, pero con varios tramos uno encima de otro (el más alto que haya debajo). */
export function alturaSueloTorre(tramos: readonly Tramo[], x: number, z: number, techo: number, margen = 0): number {
  let mejor = -Infinity;
  for (const t of tramos) {
    // Un tramo que empieza por encima del techo no puede tener nada debajo.
    if (t.base > techo) continue;
    mejor = Math.max(mejor, alturaSuelo(t, x, z, techo, margen));
  }
  return mejor;
}

/**
 * Hueco en horizontal (m, a lo largo de la pared) entre el borde de `a` y el
 * de `b`, el siguiente. Negativo si se solapan.
 */
export function huecoEntre(a: Saliente, b: Saliente): number {
  let giro = b.angulo - a.angulo;
  if (giro < 0) giro += Math.PI * 2;
  return giro * RADIO_CAMINO - (a.ancho + b.ancho) / 2;
}

/**
 * Dónde se empieza: en el suelo, entre el centro y la pared, un poco antes
 * del primer saliente. `puesto` separa a los jugadores de una carrera (0-3)
 * para que no salgan unos encima de otros. En los tramos de arriba no hay
 * suelo entero, solo la cornisa del rellano: se sale desde el medio de ella.
 */
export function puntoDeSalida(tramo: Tramo, puesto = 0): { x: number; z: number; angulo: number } {
  const primero = tramo.salientes[0]!;
  const radio = tramo.indice === 0 ? RADIO_PARED - 3.5 : RADIO_PARED - FONDO_RELLANO / 2;
  // Unos 2,5 m de pared antes del borde del primer saliente, y 2,7 m más por cada puesto.
  const angulo = primero.angulo - (primero.ancho / 2 + 2.5 + puesto * 2.7) / RADIO_CAMINO;
  return { ...puntoEnAngulo(angulo, radio), angulo };
}

function elegirTipo(azar: Azar, anterior: TipoSaliente | undefined, sinDescansillo: number): TipoSaliente {
  if (sinDescansillo >= METROS_ENTRE_DESCANSILLOS) return 'descansillo';
  const n = azar();
  let tipo: TipoSaliente = 'normal';
  if (n < PROBABILIDAD.bajo) tipo = 'bajo';
  else if (n < PROBABILIDAD.bajo + PROBABILIDAD.alto) tipo = 'alto';
  else if (n < PROBABILIDAD.bajo + PROBABILIDAD.alto + PROBABILIDAD.cornisa) tipo = 'cornisa';
  // Nunca dos altos seguidos: cansa y en la carrera sería un muro.
  return tipo === 'alto' && anterior === 'alto' ? 'normal' : tipo;
}

export function generarTramo(semilla: number, indice: number): Tramo {
  const azar = crearAzar(derivarSemilla(semilla, indice));
  const base = indice * METROS_POR_TRAMO;
  const rellano = base + METROS_POR_TRAMO;
  const salientes: Saliente[] = [];

  let y = base;
  let angulo = azar() * Math.PI * 2;
  let anterior: Saliente | undefined;
  let ultimoDescansillo = base;

  // Se sube hasta que el rellano quede a 2-3 m. Cerca del final solo hay
  // salientes normales y se acota la subida para que el último hueco
  // (saliente → rellano) también mida 2-3 m: nunca quedan, por ejemplo,
  // 3,5 m imposibles de repartir.
  const { subida: [NMIN, NMAX] } = TIPOS.normal;
  for (;;) {
    const resto = rellano - y;
    if (resto <= NMAX) break;

    let tipo: TipoSaliente;
    let min: number;
    let max: number;
    if (resto <= METROS_FINAL_NORMAL) {
      tipo = 'normal';
      min = NMIN;
      max = NMAX;
      if (resto <= NMAX * 2) {
        // Quedan 4-6 m: este salto deja el rellano justo a 2-3 m.
        min = Math.max(NMIN, resto - NMAX);
        max = Math.min(NMAX, resto - NMIN);
      } else {
        // Quedan 6-8 m: que después queden al menos 4 para los dos últimos.
        max = Math.min(NMAX, resto - NMIN * 2);
      }
    } else {
      tipo = elegirTipo(azar, anterior?.tipo, y - ultimoDescansillo);
      [min, max] = TIPOS[tipo].subida;
      // Que al llegar a la zona final queden al menos 4 m (dos normales).
      max = Math.min(max, resto - NMIN * 2);
      min = Math.min(min, max);
    }

    const m = TIPOS[tipo];
    y += entre(azar, min, max);
    const s: Saliente = {
      tipo,
      angulo: 0,
      y,
      ancho: entre(azar, m.ancho[0], m.ancho[1]),
      fondo: entre(azar, m.fondo[0], m.fondo[1]),
      grosor: entre(azar, m.grosor[0], m.grosor[1]),
    };
    // El giro sale del hueco entre bordes: del medio del anterior al medio de este.
    const hueco = entre(azar, m.hueco[0], m.hueco[1]);
    const anchoAnterior = anterior?.ancho ?? 0;
    angulo = (angulo + (anchoAnterior / 2 + hueco + s.ancho / 2) / RADIO_CAMINO) % (Math.PI * 2);
    s.angulo = angulo;
    if (tipo === 'descansillo') ultimoDescansillo = y;
    salientes.push(s);
    anterior = s;
  }

  return { indice, base, rellano, salientes };
}

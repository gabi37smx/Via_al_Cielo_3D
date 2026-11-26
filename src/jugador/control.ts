/*
 * El movimiento del escalador. LÓGICA PURA (sin Three.js ni DOM): recibe las
 * órdenes del paso y una función que dice dónde está el suelo, y avanza un
 * paso fijo. Así se prueba sola y en la carrera servirá igual para todos.
 *
 * - Movimiento relativo a la cámara: «adelante» es siempre hacia donde mira.
 * - Aceleración y frenado: no arranca ni para en seco.
 * - Salto, doble salto, tiempo coyote y salto guardado (buffer).
 * - No puede meterse en la pared del pozo: se desliza por ella.
 * - Se agarra al borde de un saliente si se queda corto y trepa (idea I3).
 */
import { CONFIG } from '../config.ts';
import { RADIO_PARED } from '../reglas/torre.ts';

const C = CONFIG.escalador;
export const VELOCIDAD_SALTO = Math.sqrt(2 * C.gravedad * C.alturaSalto);
export const VELOCIDAD_DOBLE_SALTO = Math.sqrt(2 * C.gravedad * C.alturaDobleSalto);

/** Lo que decide la animación (la animación sigue al estado, no a las teclas). */
export type Postura = 'quieto' | 'corriendo' | 'subiendo' | 'cayendo' | 'dobleSalto' | 'colgado' | 'trepando';

/** Dónde está el suelo bajo (x, z) sin pasar de `techo` (ver reglas/torre.ts). */
export type Suelo = (x: number, z: number, techo: number) => number;

export interface Ordenes {
  /** −1 (izquierda) a 1 (derecha). */
  moverX: number;
  /** −1 (atrás) a 1 (adelante). */
  moverY: number;
  /** Solo es true en el paso en que se pulsa. */
  saltar: boolean;
  /** Hacia dónde mira la cámara (rad): ver mundo/camara.ts. */
  giroCamara: number;
}

/** Dónde está agarrado: el borde de un saliente. */
export interface Agarre {
  /** Altura de la cara de arriba del saliente (m). */
  y: number;
  /** Dirección horizontal hacia el saliente (unitaria). */
  dx: number;
  dz: number;
  /** Dónde cuelga (los pies) y dónde acaba de pie al trepar. */
  colgadoX: number;
  colgadoY: number;
  colgadoZ: number;
  arribaX: number;
  arribaZ: number;
}

export interface Escalador {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Hacia dónde mira el escalador (rad, 0 = +z). */
  orientacion: number;
  enSuelo: boolean;
  /** Saltos que le quedan en el aire (el doble salto). */
  saltosAereos: number;
  coyote: number;
  bufferSalto: number;
  /** Tiempo que le queda a la voltereta del doble salto. */
  voltereta: number;
  /** Punto más alto desde que dejó el suelo (para el daño por caída, sesión 4). */
  alturaMaxima: number;
  /** Agarrado a un borde (colgado o trepando), o null. */
  agarre: Agarre | null;
  /** Tiempo que le queda para acabar de trepar; 0 = colgado o sin agarrar. */
  trepar: number;
  /** Tiempo que le queda sin poder agarrarse (justo después de soltarse). */
  sinAgarre: number;
  postura: Postura;
}

/** Lo que ha pasado en el paso (para sonidos, daño y animaciones). */
export interface Sucesos {
  salto: boolean;
  dobleSalto: boolean;
  /** Metros que ha caído si acaba de aterrizar; 0 si no. */
  aterrizaje: number;
  /** Se acaba de agarrar a un borde. */
  agarre: boolean;
}

export function crearEscalador(x: number, y: number, z: number): Escalador {
  return {
    x, y, z, vx: 0, vy: 0, vz: 0,
    orientacion: 0,
    enSuelo: true,
    saltosAereos: 1,
    coyote: 0,
    bufferSalto: 0,
    voltereta: 0,
    alturaMaxima: y,
    agarre: null,
    trepar: 0,
    sinAgarre: 0,
    postura: 'quieto',
  };
}

/** Acerca `actual` a `objetivo` como mucho `max`. */
function acercar(actual: number, objetivo: number, max: number): number {
  const d = objetivo - actual;
  return Math.abs(d) <= max ? objetivo : actual + Math.sign(d) * max;
}

export function pasoEscalador(e: Escalador, o: Ordenes, suelo: Suelo, paso: number): Sucesos {
  const sucesos: Sucesos = { salto: false, dobleSalto: false, aterrizaje: 0, agarre: false };

  // 1 · Dirección deseada, relativa a la cámara. La cámara está en
  //     (sin giro, cos giro) respecto al escalador: adelante es lo contrario.
  const sin = Math.sin(o.giroCamara);
  const cos = Math.cos(o.giroCamara);
  let dx = -sin * o.moverY + cos * o.moverX;
  let dz = -cos * o.moverY - sin * o.moverX;
  const largo = Math.hypot(dx, dz);
  if (largo > 1) {
    // En diagonal no se corre más rápido.
    dx /= largo;
    dz /= largo;
  }

  // Agarrado a un borde, el movimiento normal no cuenta.
  if (e.agarre) {
    pasoAgarrado(e, e.agarre, o.saltar, dx, dz, paso);
    return sucesos;
  }
  e.sinAgarre = Math.max(e.sinAgarre - paso, 0);

  // 2 · Velocidad horizontal: acelera hacia la deseada, frena al soltar.
  const quiere = largo > 0.01;
  const control = e.enSuelo ? 1 : C.controlAire;
  const cambio = (quiere ? C.aceleracion : C.frenado) * control * paso;
  const objetivoX = dx * C.velocidad;
  const objetivoZ = dz * C.velocidad;
  // Se acerca como vector (no eje a eje) para que la diagonal frene igual.
  const ddx = objetivoX - e.vx;
  const ddz = objetivoZ - e.vz;
  const dif = Math.hypot(ddx, ddz);
  if (dif <= cambio) {
    e.vx = objetivoX;
    e.vz = objetivoZ;
  } else {
    e.vx += (ddx / dif) * cambio;
    e.vz += (ddz / dif) * cambio;
  }

  // 3 · Girarse hacia donde va.
  const rapidez = Math.hypot(e.vx, e.vz);
  if (rapidez > 0.5) {
    const deseada = Math.atan2(e.vx, e.vz);
    let giro = deseada - e.orientacion;
    giro = Math.atan2(Math.sin(giro), Math.cos(giro)); // el camino corto
    e.orientacion += acercar(0, giro, C.giro * paso);
  }

  // 4 · Saltos.
  e.coyote = Math.max(e.coyote - paso, 0);
  e.bufferSalto = Math.max(e.bufferSalto - paso, 0);
  e.voltereta = Math.max(e.voltereta - paso, 0);
  if (o.saltar) e.bufferSalto = C.bufferSalto;

  if (e.bufferSalto > 0) {
    if (e.enSuelo || e.coyote > 0) {
      e.vy = VELOCIDAD_SALTO;
      e.enSuelo = false;
      e.coyote = 0;
      e.bufferSalto = 0;
      e.saltosAereos = 1;
      e.alturaMaxima = e.y;
      sucesos.salto = true;
    } else if (e.saltosAereos > 0) {
      e.vy = VELOCIDAD_DOBLE_SALTO;
      e.saltosAereos = 0;
      e.bufferSalto = 0;
      e.voltereta = C.voltereta;
      sucesos.dobleSalto = true;
    }
  }

  // 5 · Gravedad.
  e.vy = Math.max(e.vy - C.gravedad * paso, -C.velocidadMaxCaida);

  // 6 · Moverse en horizontal sin meterse en la pared del pozo.
  e.x += e.vx * paso;
  e.z += e.vz * paso;
  const r = Math.hypot(e.x, e.z);
  const rMax = RADIO_PARED - C.radio;
  if (r > rMax) {
    const nx = e.x / r;
    const nz = e.z / r;
    e.x = nx * rMax;
    e.z = nz * rMax;
    // Quitar la parte de la velocidad que empuja contra la pared (se desliza).
    const contra = e.vx * nx + e.vz * nz;
    if (contra > 0) {
      e.vx -= contra * nx;
      e.vz -= contra * nz;
    }
  }

  // 7 · Moverse en vertical. Al bajar, el suelo que cuenta es el que estaba
  //     por debajo de los pies ANTES de moverse: así no se cuela ni cayendo rápido.
  const yAntes = e.y;
  const yNueva = e.y + e.vy * paso;
  if (e.vy <= 0) {
    const s = suelo(e.x, e.z, e.y + 0.05);
    if (yNueva <= s) {
      if (!e.enSuelo) sucesos.aterrizaje = Math.max(e.alturaMaxima - s, 0);
      e.y = s;
      e.vy = 0;
      e.enSuelo = true;
      e.saltosAereos = 1;
      e.alturaMaxima = s;
    } else {
      if (e.enSuelo) e.coyote = C.coyote; // acaba de salir por un borde
      e.y = yNueva;
      e.enSuelo = false;
    }
  } else {
    e.y = yNueva;
    e.enSuelo = false;
  }
  if (!e.enSuelo) e.alturaMaxima = Math.max(e.alturaMaxima, e.y);

  // 8 · ¿Se queda corto? Agarrarse al borde que tenga delante.
  if (!e.enSuelo && intentarAgarre(e, yAntes, suelo)) {
    sucesos.agarre = true;
    return sucesos;
  }

  // 9 · Postura (la usa la animación).
  e.postura = e.enSuelo
    ? rapidez > 0.5 ? 'corriendo' : 'quieto'
    : e.voltereta > 0 ? 'dobleSalto' : e.vy > 0 ? 'subiendo' : 'cayendo';

  return sucesos;
}

/** Curva suave de 0 a 1 (arranca y llega despacio). */
function suave(t: number): number {
  const u = Math.min(Math.max(t, 0), 1);
  return u * u * (3 - 2 * u);
}

/**
 * Busca un borde delante de las manos. Se mira en la dirección en que se
 * mueve (o hacia donde mira, si está casi quieto), a trocitos de 10 cm desde
 * un poco por detrás del cuerpo hasta donde llegan las manos. El borde es el
 * primer trocito con un saliente a la altura de las manos. Si ya hay saliente
 * por detrás del cuerpo es que está DEBAJO de él, no en su borde: nada.
 */
function intentarAgarre(e: Escalador, yAntes: number, suelo: Suelo): boolean {
  if (e.sinAgarre > 0 || e.vy > C.agarreSubiendo || e.vy < -C.agarreCayendo) return false;

  const rapidez = Math.hypot(e.vx, e.vz);
  const dx = rapidez > 0.5 ? e.vx / rapidez : Math.sin(e.orientacion);
  const dz = rapidez > 0.5 ? e.vz / rapidez : Math.cos(e.orientacion);
  // Las alturas por las que han pasado los pies en este paso (de yAntes a
  // e.y): así no se salta un borde aunque baje rápido.
  const bajo = Math.min(yAntes, e.y);
  const techo = Math.max(yAntes, e.y) + C.agarreMax;
  const valeAltura = (h: number) => h >= bajo + C.agarreMin && h <= techo;

  for (let i = 0; i <= 3 + C.alcance * 10 + 1e-9; i++) {
    const t = -0.3 + i * 0.1;
    const h = suelo(e.x + dx * t, e.z + dz * t, techo);
    if (!valeAltura(h)) continue;
    if (i === 0) return false; // ya había saliente detrás: está debajo de él

    const bordeX = e.x + dx * t;
    const bordeZ = e.z + dz * t;
    // Donde acaba de pie: lo más adentro del saliente que siga siendo saliente.
    let arribaX = bordeX;
    let arribaZ = bordeZ;
    for (const dentro of [0.6, 0.4, 0.25]) {
      const x = bordeX + dx * dentro;
      const z = bordeZ + dz * dentro;
      if (suelo(x, z, h + 0.01) === h) {
        arribaX = x;
        arribaZ = z;
        break;
      }
    }
    // Colgado, con el cuerpo justo delante del borde y dentro del pozo.
    let colgadoX = bordeX - dx * C.radio;
    let colgadoZ = bordeZ - dz * C.radio;
    const r = Math.hypot(colgadoX, colgadoZ);
    const rMax = RADIO_PARED - C.radio;
    if (r > rMax) {
      colgadoX *= rMax / r;
      colgadoZ *= rMax / r;
    }
    const colgadoY = h - C.alturaManos;
    e.agarre = { y: h, dx, dz, colgadoX, colgadoY, colgadoZ, arribaX, arribaZ };
    e.x = colgadoX;
    e.y = colgadoY;
    e.z = colgadoZ;
    e.vx = e.vy = e.vz = 0;
    e.orientacion = Math.atan2(dx, dz); // de cara al saliente
    e.voltereta = 0;
    e.bufferSalto = 0;
    e.trepar = 0;
    e.alturaMaxima = e.y; // agarrarse corta la caída
    e.postura = 'colgado';
    return true;
  }
  return false;
}

/**
 * Colgado: salto o empujar hacia el saliente = trepar; empujar hacia atrás =
 * soltarse. Trepando: primero sube (60 % del tiempo) y luego pasa encima.
 */
function pasoAgarrado(e: Escalador, a: Agarre, saltar: boolean, dx: number, dz: number, paso: number) {
  e.vx = e.vy = e.vz = 0;

  if (e.trepar === 0) {
    const hacia = dx * a.dx + dz * a.dz; // > 0: empuja hacia el saliente
    if (saltar || hacia > 0.5) {
      e.trepar = C.trepar;
    } else if (hacia < -0.5) {
      e.agarre = null;
      e.sinAgarre = C.esperaReagarre;
      e.enSuelo = false;
      e.saltosAereos = 0;
      e.coyote = 0;
      e.alturaMaxima = e.y;
      e.postura = 'cayendo';
      return;
    } else {
      e.postura = 'colgado';
      return;
    }
  }

  e.trepar = Math.max(e.trepar - paso, 0);
  const t = 1 - e.trepar / C.trepar;
  const subir = suave(t / 0.6);
  const pasar = suave((t - 0.6) / 0.4);
  e.x = a.colgadoX + (a.arribaX - a.colgadoX) * pasar;
  e.z = a.colgadoZ + (a.arribaZ - a.colgadoZ) * pasar;
  e.y = a.colgadoY + (a.y - a.colgadoY) * subir;
  e.postura = 'trepando';

  if (e.trepar === 0) {
    // Arriba y de pie.
    e.x = a.arribaX;
    e.z = a.arribaZ;
    e.y = a.y;
    e.agarre = null;
    e.enSuelo = true;
    e.saltosAereos = 1;
    e.bufferSalto = 0;
    e.alturaMaxima = e.y;
    e.postura = 'quieto';
  }
}

/** Lo que lleva hecho de la voltereta o de trepar (0-1): lo usa la animación. */
export function progresoPostura(e: Escalador): number {
  if (e.postura === 'dobleSalto') return 1 - e.voltereta / C.voltereta;
  if (e.postura === 'trepando') return 1 - e.trepar / C.trepar;
  return 0;
}

/*
 * El movimiento del escalador. LÓGICA PURA (sin Three.js ni DOM): recibe las
 * órdenes del paso y una función que dice dónde está el suelo, y avanza un
 * paso fijo. Así se prueba sola y en la carrera servirá igual para todos.
 *
 * - Movimiento relativo a la cámara: «adelante» es siempre hacia donde mira.
 * - Aceleración y frenado: no arranca ni para en seco.
 * - Salto, doble salto, tiempo coyote y salto guardado (buffer).
 * - No puede meterse en la pared del pozo: se desliza por ella.
 */
import { CONFIG } from '../config.ts';
import { RADIO_PARED } from '../reglas/torre.ts';

const C = CONFIG.escalador;
export const VELOCIDAD_SALTO = Math.sqrt(2 * C.gravedad * C.alturaSalto);
export const VELOCIDAD_DOBLE_SALTO = Math.sqrt(2 * C.gravedad * C.alturaDobleSalto);

/** Lo que decide la animación (la animación sigue al estado, no a las teclas). */
export type Postura = 'quieto' | 'corriendo' | 'subiendo' | 'cayendo' | 'dobleSalto';

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
  postura: Postura;
}

/** Lo que ha pasado en el paso (para sonidos, daño y animaciones). */
export interface Sucesos {
  salto: boolean;
  dobleSalto: boolean;
  /** Metros que ha caído si acaba de aterrizar; 0 si no. */
  aterrizaje: number;
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
    postura: 'quieto',
  };
}

/** Acerca `actual` a `objetivo` como mucho `max`. */
function acercar(actual: number, objetivo: number, max: number): number {
  const d = objetivo - actual;
  return Math.abs(d) <= max ? objetivo : actual + Math.sign(d) * max;
}

export function pasoEscalador(e: Escalador, o: Ordenes, suelo: Suelo, paso: number): Sucesos {
  const sucesos: Sucesos = { salto: false, dobleSalto: false, aterrizaje: 0 };

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

  // 8 · Postura (la usa la animación).
  e.postura = e.enSuelo
    ? rapidez > 0.5 ? 'corriendo' : 'quieto'
    : e.voltereta > 0 ? 'dobleSalto' : e.vy > 0 ? 'subiendo' : 'cayendo';

  return sucesos;
}

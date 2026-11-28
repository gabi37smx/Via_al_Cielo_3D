/*
 * El movimiento del escalador. LÓGICA PURA (sin Three.js ni DOM): recibe las
 * órdenes del paso y una función que dice dónde está el suelo, y avanza un
 * paso fijo. Así se prueba sola y en la carrera servirá igual para todos.
 *
 * - Movimiento relativo a la cámara: «adelante» es siempre hacia donde mira.
 * - Aceleración y frenado: no arranca ni para en seco.
 * - Salto, doble salto, tiempo coyote y salto guardado (buffer).
 * - No puede meterse en la roca (la pared del pozo, o en la ladera el
 *   pasillo, la colina y la montaña: `Limite`): se desliza por ella.
 * - Se agarra al borde de un saliente si se queda corto y trepa (idea I3).
 * - En una cuesta de hielo (los salientes de la montaña, decisión 041) se
 *   desliza cuesta abajo, hacia la pared; con crampones, menos.
 * - En el aire, el viento (las ráfagas de la montaña, decisión 042) lo lleva
 *   de lado; de pie no se nota.
 */
import { CONFIG } from '../config.ts';
import { limitePozo, type Limite } from '../reglas/ladera.ts';

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
  /** Lleva los crampones puestos (los pone reglas/ladera.ts al salir a la nieve). */
  crampones: boolean;
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
    crampones: false,
    postura: 'quieto',
  };
}

/** Acerca `actual` a `objetivo` como mucho `max`. */
function acercar(actual: number, objetivo: number, max: number): number {
  const d = objetivo - actual;
  return Math.abs(d) <= max ? objetivo : actual + Math.sign(d) * max;
}

/** Sin viento (dentro de la cueva). */
const SIN_VIENTO = { x: 0, z: 0 };

/** `viento`: velocidad del aire donde está (m/s); solo cuenta en el aire. */
export function pasoEscalador(
  e: Escalador,
  o: Ordenes,
  suelo: Suelo,
  paso: number,
  limite: Limite = limitePozo,
  viento: { x: number; z: number } = SIN_VIENTO,
): Sucesos {
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

  // 2 · Velocidad horizontal: acelera hacia la deseada, frena al soltar. En
  //     una cuesta de hielo, la deseada lleva además el deslizamiento; en el
  //     aire, el viento (como una corriente: sin pulsar, se va con ella).
  const quiere = largo > 0.01;
  const control = e.enSuelo ? 1 : C.controlAire;
  const cambio = (quiere ? C.aceleracion : C.frenado) * control * paso;
  const deriva = e.enSuelo ? deslizamiento(e, suelo) : viento;
  const deslizando = e.enSuelo && !quiere && Math.hypot(deriva.x, deriva.z) > 0.01;
  const objetivoX = dx * C.velocidad + deriva.x;
  const objetivoZ = dz * C.velocidad + deriva.z;
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
  //     Deslizándose sin pulsar nada no se gira: resbala tal como está.
  const rapidez = deslizando ? 0 : Math.hypot(e.vx, e.vz);
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

  // 6 · Moverse en horizontal sin meterse en la roca.
  e.x += e.vx * paso;
  e.z += e.vz * paso;
  const choque = limite(e, e.y);
  if (choque) {
    // Quitar la parte de la velocidad que empuja contra la roca (se desliza).
    const contra = e.vx * choque.nx + e.vz * choque.nz;
    if (contra > 0) {
      e.vx -= contra * choque.nx;
      e.vz -= contra * choque.nz;
    }
  }

  // 7 · Moverse en vertical. Al bajar, el suelo que cuenta es el que estaba
  //     por debajo de los pies ANTES de moverse: así no se cuela ni cayendo rápido.
  //     Bajando una cuesta se queda pegado al suelo (si no, iría a saltitos).
  const yAntes = e.y;
  const yNueva = e.y + e.vy * paso;
  if (e.vy <= 0) {
    const s = suelo(e.x, e.z, e.y + 0.05);
    const pegado = e.enSuelo && e.y - s <= C.pegarseAlSuelo;
    if (yNueva <= s || pegado) {
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
  if (!e.enSuelo && intentarAgarre(e, yAntes, suelo, limite)) {
    sucesos.agarre = true;
    return sucesos;
  }

  // 9 · Postura (la usa la animación).
  e.postura = e.enSuelo
    ? rapidez > 0.5 ? 'corriendo' : 'quieto'
    : e.voltereta > 0 ? 'dobleSalto' : e.vy > 0 ? 'subiendo' : 'cayendo';

  return sucesos;
}

/**
 * Cuesta del suelo bajo los pies (m de subida por m, en x y en z): se mira el
 * suelo a 10 cm a cada lado. Un escalón (más de 45°) no es cuesta: si un lado
 * cae fuera del saliente, se usa solo el otro.
 */
export function cuesta(suelo: Suelo, x: number, z: number, y: number): { x: number; z: number } {
  const E = 0.1;
  const techo = y + 0.05 + E;
  const h = suelo(x, z, techo);
  if (!Number.isFinite(h)) return { x: 0, z: 0 };
  const vale = (v: number) => Number.isFinite(v) && Math.abs(v - h) < E;
  const eje = (mas: number, menos: number) => {
    if (vale(mas) && vale(menos)) return (mas - menos) / (2 * E);
    if (vale(mas)) return (mas - h) / E;
    if (vale(menos)) return (h - menos) / E;
    return 0;
  };
  return {
    x: eje(suelo(x + E, z, techo), suelo(x - E, z, techo)),
    z: eje(suelo(x, z + E, techo), suelo(x, z - E, techo)),
  };
}

/** Velocidad a la que le lleva el hielo cuesta abajo (m/s, en x y en z). Las únicas cuestas son de hielo. */
function deslizamiento(e: Escalador, suelo: Suelo): { x: number; z: number } {
  const c = cuesta(suelo, e.x, e.z, e.y);
  const f = C.deslizarHielo * (e.crampones ? C.deslizarConCrampones : 1);
  return { x: -c.x * f, z: -c.z * f };
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
function intentarAgarre(e: Escalador, yAntes: number, suelo: Suelo, limite: Limite): boolean {
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
    // Colgado, con el cuerpo justo delante del borde y fuera de la roca.
    const colgadoY = h - C.alturaManos;
    const colgado = { x: bordeX - dx * C.radio, z: bordeZ - dz * C.radio };
    limite(colgado, colgadoY);
    const colgadoX = colgado.x;
    const colgadoZ = colgado.z;
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

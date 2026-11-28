/*
 * De la cima a Valencia EN AVIONETA (idea I9). LÓGICA PURA: sin Three.js.
 *
 * En la cima (660 m) hay un aeródromo pequeño: una pista de nieve a lo largo
 * de la cima y una avioneta aparcada a unos pasos de la bandera. Al tocarla
 * se sube y empieza una escena corta (~15 s, se puede saltar):
 *
 *   1 · arranca el motor, rueda por la pista y despega;
 *   2 · gira hacia el valle, sube y se mete en las nubes (fundido a blanco);
 *   3 · sale de las nubes ya en Valencia, baja hacia la pista del Jardín del
 *       Turia, toma tierra y frena;
 *   4 · se abre la puerta y se baja (reglas/valencia.ts: llegadaValencia).
 *
 * Todo es una función del tiempo de la escena (`poseVuelo`): dónde está la
 * avioneta, cómo va inclinada, dónde va la cámara, cuánto blanco tapa la
 * pantalla y cuánto suena el motor. Así se puede probar sin dibujar nada, y
 * saltar la escena es solo ir al final.
 *
 * Mientras se vuela, el escalador no se mueve y la partida no avanza: el
 * contador de altura se queda quieto en la cima (la API del ranking rechaza
 * subidas de más de 14 m/s, y un avión las haría).
 */
import { CIMA, FONDO_CIMA, aLocal, aMundo, dCara, ejes, type Ladera } from './ladera.ts';
import { PISTA_VALENCIA, SUELO_VALENCIA, aMundoValencia } from './valencia.ts';

/* ---------- La avioneta y el aeródromo de la cima ---------- */

/**
 * Medidas de la avioneta (m), desde su centro (bajo el ala): el morro queda
 * `morro` por delante y la cola `cola` por detrás; `ancho` del fuselaje.
 */
export const AVIONETA = { morro: 3.9, cola: 4.6, ancho: 1.4, envergadura: 11 } as const;

/**
 * Dónde está aparcada en la cima, en el marco de la ladera: `fondo` m por
 * detrás del borde de la cara (en medio de la cima, lejos del pico) y `u` m
 * de lado (la bandera está en u = 0). Mira a lo largo de la cima (+u): la
 * pista sigue por ahí.
 */
export const AERODROMO = { fondo: 7.9, u: 12, largoPista: 150 } as const;

/** Desde lo que mide hasta tocar la avioneta para subirse (m). */
export const ALCANCE_PUERTA = 0.9;

/** Distancia del borde de la cima (d) a la línea de la pista. */
export function dPista(l: Ladera): number {
  return dCara(l.rellano) - FONDO_CIMA + AERODROMO.fondo;
}

/** La avioneta aparcada en la cima: dónde y hacia dónde mira (0 = +z). */
export function avionetaEnCima(l: Ladera): { x: number; z: number; rumbo: number } {
  const p = aMundo(l, dPista(l), AERODROMO.u);
  const e = ejes(l);
  return { ...p, rumbo: Math.atan2(e.tx, e.tz) };
}

/**
 * ¿El escalador toca la avioneta de la cima? (se sube). Vale andando o
 * saltando, pero no desde abajo de la cima ni desde muy arriba.
 */
export function tocaAvioneta(l: Ladera, x: number, y: number, z: number): boolean {
  if (y < CIMA - 0.5 || y > CIMA + 2.5) return false;
  const { d, u } = aLocal(l, x, z);
  const du = u - AERODROMO.u;
  return du >= -AVIONETA.cola - ALCANCE_PUERTA && du <= AVIONETA.morro + ALCANCE_PUERTA && Math.abs(d - dPista(l)) <= AVIONETA.ancho / 2 + ALCANCE_PUERTA;
}

/* ---------- El guion de la escena ---------- */

/** Arranca el motor, quieta (s). */
const T_ARRANQUE = 1.2;
/** Aceleración en la pista (m/s²) y velocidad a la que despega (m/s). */
const ACELERACION = 8;
const V_DESPEGUE = 30;
const T_DESPEGUE = T_ARRANQUE + V_DESPEGUE / ACELERACION;
/** Después de despegar: cuánto gira hacia el valle (rad), en cuánto tiempo (s), y a qué ritmo sube (m/s). */
const GIRO_DESPEGUE = 1.15;
const T_GIRO = 2;
const SUBIDA = 9;
/** El fundido a blanco (las nubes): empieza, cambia de sitio en el medio y se va. */
const T_BLANCO = 6.4;
export const T_CAMBIO = 7.2;
const T_VISTO = 8;
/** La llegada: velocidad de aproximación (m/s), frenada en tierra (m/s²) y altura al salir de las nubes (m). */
const V_APROXIMACION = 28;
const FRENADA = 7;
const ALTURA_APROXIMACION = 16;
/** Desde que sale de las nubes hasta que toca la pista (s). */
const T_PLANEO = 3.4;
/** Cuando las ruedas tocan la pista de Valencia (s): suena el chirrido. */
export const T_TOMA = T_CAMBIO + T_PLANEO;
const T_PARADA = T_TOMA + V_APROXIMACION / FRENADA;
/** Dónde toca la pista: lo justo para pararse en `PISTA_VALENCIA.parada`. */
export const X_TOMA = PISTA_VALENCIA.parada - V_APROXIMACION ** 2 / (2 * FRENADA);
/** Lo que dura la escena entera (s): al acabar, se abre la puerta y se baja. */
export const DURACION_VUELO = T_PARADA + 1;

/** La cámara va detrás de la avioneta con algo de retraso (s): al acelerar, se aleja. */
const RETRASO_CAMARA = 0.4;
/** Detrás, arriba y a la IZQUIERDA (`lado` < 0): a la derecha, en la cima, está la bandera. */
const CAMARA = { atras: 15, arriba: 4.5, lado: -3, delante: 25, sueloMin: 1.6 } as const;

export interface Punto {
  x: number;
  y: number;
  z: number;
}

export interface PoseVuelo extends Punto {
  /** En la montaña o ya en Valencia. */
  lugar: 'cima' | 'valencia';
  /** Hacia dónde mira el morro (rad, 0 = +z), cuánto lo levanta y cuánto se inclina a la derecha. */
  rumbo: number;
  cabeceo: number;
  alabeo: number;
  camara: Punto;
  mira: Punto;
  /** Cuánto blanco tapa la pantalla (0-1): las nubes del cambio de sitio. */
  blanco: number;
  /** Cuánto suena (y gira la hélice) el motor (0-1). */
  motor: number;
  /** La puerta: 0 cerrada, 1 abierta. */
  puerta: number;
}

const suave = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

/** Avioneta en (u, d, y) del marco de la ladera, con el rumbo φ (0 = +u, positivo = hacia el valle, −d). */
interface EstadoCima {
  u: number;
  d: number;
  y: number;
  phi: number;
  /** Lo que gira por segundo (rad/s) y lo que sube (m/s): para inclinarla. */
  giro: number;
  vy: number;
  v: number;
}

/** La primera parte, en el marco de la cima. Después del despegue se integra a pasos pequeños. */
function enLaCima(l: Ladera, t: number): EstadoCima {
  const d0 = dPista(l);
  const u0 = AERODROMO.u;
  if (t <= T_ARRANQUE) return { u: u0, d: d0, y: l.rellano, phi: 0, giro: 0, vy: 0, v: 0 };
  if (t <= T_DESPEGUE) {
    const tau = t - T_ARRANQUE;
    return { u: u0 + 0.5 * ACELERACION * tau * tau, d: d0, y: l.rellano, phi: 0, giro: 0, vy: 0, v: ACELERACION * tau };
  }
  const s: EstadoCima = { u: u0 + V_DESPEGUE ** 2 / (2 * ACELERACION), d: d0, y: l.rellano, phi: 0, giro: 0, vy: 0, v: V_DESPEGUE };
  const PASO = 1 / 240;
  const fin = Math.min(t, T_CAMBIO) - T_DESPEGUE;
  for (let tau = 0; tau < fin; ) {
    const h = Math.min(PASO, fin - tau);
    const medio = tau + h / 2;
    s.v = V_DESPEGUE + 2 * medio;
    s.vy = SUBIDA * suave(medio / 0.8);
    const phiAntes = GIRO_DESPEGUE * suave(tau / T_GIRO);
    s.phi = GIRO_DESPEGUE * suave((tau + h) / T_GIRO);
    s.giro = (s.phi - phiAntes) / h;
    const phiMedio = (phiAntes + s.phi) / 2;
    s.u += Math.cos(phiMedio) * s.v * h;
    s.d -= Math.sin(phiMedio) * s.v * h;
    s.y += s.vy * h;
    tau += h;
  }
  return s;
}

/** La segunda parte, en el marco de Valencia: X a lo largo de la pista y la altura. */
function enValencia(t: number): { x: number; y: number; v: number; bajada: number } {
  if (t <= T_TOMA) {
    const falta = T_TOMA - t;
    const s = falta / T_PLANEO;
    // Baja cada vez más despacio (al final, la avioneta «flota» antes de tocar).
    return { x: X_TOMA - V_APROXIMACION * falta, y: SUELO_VALENCIA + ALTURA_APROXIMACION * s ** 1.6, v: V_APROXIMACION, bajada: s };
  }
  const tau = Math.min(t, T_PARADA) - T_TOMA;
  return { x: X_TOMA + V_APROXIMACION * tau - 0.5 * FRENADA * tau * tau, y: SUELO_VALENCIA, v: V_APROXIMACION - FRENADA * tau, bajada: 0 };
}

/** Dónde está la avioneta (y hacia dónde mira) en el instante `t`, sin cámara. */
function avioneta(l: Ladera, t: number): Omit<PoseVuelo, 'camara' | 'mira' | 'blanco' | 'motor' | 'puerta'> & { delante: { x: number; z: number } } {
  if (t < T_CAMBIO) {
    const s = enLaCima(l, t);
    const e = ejes(l);
    // Dirección en (u, d) → en el mundo: u va por T y d por N.
    const du = Math.cos(s.phi);
    const dd = -Math.sin(s.phi);
    const dx = e.tx * du + e.nx * dd;
    const dz = e.tz * du + e.nz * dd;
    const p = aMundo(l, s.d, s.u);
    const enAire = t > T_DESPEGUE;
    // Al despegar levanta el morro (con la subida) y se inclina al girar.
    const cabeceo = enAire ? Math.atan2(s.vy, s.v) + 0.06 : t > T_DESPEGUE - 0.6 ? 0.1 * suave((t - (T_DESPEGUE - 0.6)) / 0.6) : 0;
    return { lugar: 'cima', x: p.x, y: s.y, z: p.z, rumbo: Math.atan2(dx, dz), cabeceo, alabeo: Math.min(s.giro * 0.55, 0.5), delante: { x: dx, z: dz } };
  }
  const v = enValencia(t);
  const p = aMundoValencia(v.x, 0);
  // Morro algo levantado al bajar y más en el último momento (el «redondeo»).
  const cabeceo = t <= T_TOMA ? 0.02 + 0.1 * (1 - v.bajada) : 0.12 * Math.max(1 - (t - T_TOMA) / 0.8, 0);
  return { lugar: 'valencia', x: p.x, y: v.y, z: p.z, rumbo: Math.PI / 2, cabeceo, alabeo: 0, delante: { x: 1, z: 0 } };
}

/** Cuánto suena el motor en cada momento (0-1). */
function motorEn(t: number): number {
  if (t < T_ARRANQUE) return 0.35 * (t / T_ARRANQUE);
  if (t < T_DESPEGUE) return 0.35 + 0.65 * ((t - T_ARRANQUE) / (T_DESPEGUE - T_ARRANQUE));
  if (t < T_CAMBIO) return 1;
  if (t < T_TOMA) return 0.55;
  if (t < T_PARADA) return 0.55 - 0.43 * ((t - T_TOMA) / (T_PARADA - T_TOMA));
  return 0.12 * Math.max(1 - (t - T_PARADA) / 0.6, 0);
}

/** La escena en el instante `t` (s desde que se sube). Pasado el final, se queda al final. */
export function poseVuelo(l: Ladera, t: number): PoseVuelo {
  const ahora = Math.min(Math.max(t, 0), DURACION_VUELO);
  const a = avioneta(l, ahora);
  // La cámara, detrás de donde estaba la avioneta hace un momento (sin
  // pasar al otro sitio: después del cambio, como mucho desde el cambio).
  const antes = ahora >= T_CAMBIO ? Math.max(ahora - RETRASO_CAMARA, T_CAMBIO) : Math.max(ahora - RETRASO_CAMARA, 0);
  const b = avioneta(l, antes);
  // A la derecha de la dirección (fx, fz) es (−fz, fx): la cámara va un poco hacia ese lado.
  const camara = {
    x: b.x - b.delante.x * CAMARA.atras - b.delante.z * CAMARA.lado,
    y: b.y + CAMARA.arriba,
    z: b.z - b.delante.z * CAMARA.atras + b.delante.x * CAMARA.lado,
  };
  const suelo = a.lugar === 'cima' ? CIMA : SUELO_VALENCIA;
  camara.y = Math.max(camara.y, suelo + CAMARA.sueloMin);
  const mira = { x: a.x + a.delante.x * CAMARA.delante, y: a.y + 1.5, z: a.z + a.delante.z * CAMARA.delante };
  const blanco = ahora < T_CAMBIO ? suave((ahora - T_BLANCO) / (T_CAMBIO - T_BLANCO)) : 1 - suave((ahora - T_CAMBIO) / (T_VISTO - T_CAMBIO));
  // La puerta se cierra al subir y se abre al pararse.
  const puerta = ahora < T_PARADA ? 1 - suave(ahora / 0.6) : suave((ahora - T_PARADA - 0.2) / 0.6);
  const { delante: _d, ...pose } = a;
  return { ...pose, camara, mira, blanco, motor: motorEn(ahora), puerta };
}

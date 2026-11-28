/*
 * Las reglas de la CARRERA (modo multijugador, sesión 6). LÓGICA PURA: sin
 * Three.js, sin DOM y sin red. Las usan igual el jugador y los rivales del
 * ordenador, y cada navegador llega a lo mismo con los mismos datos.
 *
 * - Fases: esperando → cuenta atrás (3-2-1) → en curso → terminada.
 * - Meta: el rellano del primer tramo (220 m).
 * - Vida a 0 → no se acaba: se reaparece a los 3 s en el último punto de
 *   control (cada 55 m) con la vida llena.
 * - Gana el que llega antes (tiempo de carrera, contado en pasos de lógica);
 *   si dos llegan en el mismo tiempo, decide el orden en que se supo.
 */
import { crearEscalador, pasoEscalador, type Escalador, type Ordenes, type Suelo, type Sucesos } from '../jugador/control.ts';
import { REGLAS, crearPartida, pasoPartida, type Jugada, type Partida, type Peligros } from './partida.ts';
import { puntoDeSalida, posicionSaliente, type Tramo } from './torre.ts';
import { conCrampones, type Ladera, type Limite } from './ladera.ts';
import { alAireLibre, empiezaRafaga, viento } from './aire.ts';

export const CARRERA = {
  /** Segundos de cuenta atrás (3, 2, 1, ¡ya!). */
  cuentaAtras: 3,
  /** Cada cuántos metros hay un punto de control para reaparecer. */
  puntoDeControl: 55,
  /** Segundos que se tarda en reaparecer con la vida a 0. */
  reaparicion: 3,
  /** Segundos que se espera a los demás desde que llega el primero. */
  esperaTrasPrimero: 90,
  /** Jugadores como mucho (personas + ordenador). */
  maxCorredores: 4,
} as const;

export type FaseCarrera = 'esperando' | 'cuentaAtras' | 'enCurso' | 'terminada';

export interface EstadoCarrera {
  fase: FaseCarrera;
  /** Número de carrera en la sala (la 1, la 2…): los mensajes de otra ronda se ignoran. */
  ronda: number;
  /** Segundos que le quedan a la cuenta atrás. */
  cuentaAtras: number;
  /** Segundos desde la salida. */
  tiempo: number;
}

export type SucesoCarrera = { tipo: 'numero'; numero: number } | { tipo: 'salida' };

export function crearCarrera(): EstadoCarrera {
  return { fase: 'esperando', ronda: 0, cuentaAtras: 0, tiempo: 0 };
}

/** El anfitrión da la salida (o llega su mensaje): empieza la cuenta atrás. */
export function empezarCuentaAtras(c: EstadoCarrera, ronda: number): SucesoCarrera[] {
  c.fase = 'cuentaAtras';
  c.ronda = ronda;
  c.cuentaAtras = CARRERA.cuentaAtras;
  c.tiempo = 0;
  return [{ tipo: 'numero', numero: CARRERA.cuentaAtras }];
}

/** Avanza un paso: cuenta atrás (avisa de cada número y de la salida) o reloj de carrera. */
export function pasoCarrera(c: EstadoCarrera, paso: number): SucesoCarrera[] {
  if (c.fase === 'enCurso') {
    c.tiempo += paso;
    return [];
  }
  if (c.fase !== 'cuentaAtras') return [];
  const antes = Math.ceil(c.cuentaAtras - 1e-9);
  c.cuentaAtras -= paso;
  if (c.cuentaAtras <= 1e-9) {
    c.cuentaAtras = 0;
    c.fase = 'enCurso';
    return [{ tipo: 'salida' }];
  }
  const ahora = Math.ceil(c.cuentaAtras - 1e-9);
  return ahora < antes ? [{ tipo: 'numero', numero: ahora }] : [];
}

/** ¿Puede moverse el escalador? En la espera y en la cuenta atrás, no. */
export function sePuedeMover(c: EstadoCarrera): boolean {
  return c.fase === 'enCurso' || c.fase === 'terminada';
}

/** Altura del último punto de control alcanzado (0 = la salida). */
export function puntoDeControl(alturaMaxima: number, tramo: Tramo): number {
  const n = Math.floor((alturaMaxima - tramo.base + 1e-9) / CARRERA.puntoDeControl);
  return Math.min(tramo.base + n * CARRERA.puntoDeControl, tramo.rellano - CARRERA.puntoDeControl);
}

/**
 * Dónde se reaparece: en el saliente más alto que no pase del punto de
 * control, o en la salida (con su puesto) si aún no se ha llegado al primero.
 */
export function sitioDeReaparicion(tramo: Tramo, alturaMaxima: number, puesto: number): { x: number; y: number; z: number } {
  const control = puntoDeControl(alturaMaxima, tramo);
  let mejor: Tramo['salientes'][number] | undefined;
  for (const s of tramo.salientes) if (s.y <= control + 1e-9) mejor = s;
  if (control <= tramo.base || !mejor) {
    const { x, z } = puntoDeSalida(tramo, puesto);
    return { x, y: tramo.base, z };
  }
  return { ...posicionSaliente(mejor), y: mejor.y };
}

/** ¿Ha llegado a la meta? De pie en el rellano del tramo. */
export function haLlegado(e: Escalador, tramo: Tramo): boolean {
  return e.enSuelo && e.y >= tramo.rellano - 1e-6;
}

/* ---------- Un corredor: el jugador o un rival del ordenador ---------- */

export interface Corredor {
  escalador: Escalador;
  partida: Partida;
  /** Puesto de salida (0-3): de dónde sale y dónde reaparece si no ha pasado ningún control. */
  puesto: number;
  /** Segundos que le quedan para reaparecer; 0 = está jugando. */
  reaparecerEn: number;
  /** Tiempo de carrera con el que llegó a la meta, o null. */
  llegada: number | null;
}

export function crearCorredor(tramo: Tramo, puesto: number): Corredor {
  const { x, z } = puntoDeSalida(tramo, puesto);
  return { escalador: crearEscalador(x, tramo.base, z), partida: crearPartida(), puesto, reaparecerEn: 0, llegada: null };
}

export interface PasoCorredor {
  sucesos: Sucesos;
  jugadas: Jugada[];
  /** Acaba de llegar a la meta en este paso. */
  llego: boolean;
  /** Acaba de reaparecer en este paso. */
  reaparecio: boolean;
  /** Se acaba de poner los crampones (al salir a la nieve). */
  crampones: boolean;
  /** Acaba de empezar una ráfaga de viento y está al aire libre (para que suene). */
  rafaga: boolean;
}

const QUIETO: Ordenes = { moverX: 0, moverY: 0, saltar: false, giroCamara: 0 };

/**
 * Un paso de un corredor en carrera: movimiento, reglas (fragmentos, golpes,
 * caídas), reaparición y meta. `tiempo` es el tiempo de carrera de ESTE paso.
 */
export function pasoCorredor(
  c: Corredor,
  ordenes: Ordenes,
  tramo: Tramo,
  suelo: Suelo,
  peligros: Peligros,
  tiempo: number,
  paso: number,
  limite?: Limite,
  ladera?: Ladera,
): PasoCorredor {
  const r: PasoCorredor = { sucesos: { salto: false, dobleSalto: false, aterrizaje: 0, agarre: false }, jugadas: [], llego: false, reaparecio: false, crampones: false, rafaga: false };

  if (c.reaparecerEn > 0) {
    // Sin vida: no obedece, pero termina de caer si estaba en el aire.
    r.sucesos = pasoEscalador(c.escalador, { ...QUIETO, giroCamara: ordenes.giroCamara }, suelo, paso, limite);
    c.reaparecerEn = Math.max(c.reaparecerEn - paso, 0);
    if (c.reaparecerEn === 0) {
      const sitio = sitioDeReaparicion(tramo, c.partida.alturaMaxima, c.puesto);
      const orientacion = c.escalador.orientacion;
      c.escalador = crearEscalador(sitio.x, sitio.y, sitio.z);
      c.escalador.orientacion = orientacion;
      c.partida.vida = REGLAS.vidaInicial;
      c.partida.terminada = false;
      c.partida.invulnerable = REGLAS.invulnerabilidad; // que no le pille un murciélago al aparecer
      r.reaparecio = true;
    }
    return r;
  }

  // El viento de la montaña, con el tiempo de la partida (el de las águilas).
  const antes = c.escalador;
  const aire = ladera ? viento(ladera, antes.x, antes.y, antes.z, c.partida.tiempo) : undefined;
  r.sucesos = pasoEscalador(c.escalador, ordenes, suelo, paso, limite, aire);
  const e = c.escalador;
  r.rafaga = ladera !== undefined && alAireLibre(ladera, e.x, e.y, e.z) && empiezaRafaga(ladera, c.partida.tiempo, paso);
  if (ladera) {
    const tenia = e.crampones;
    e.crampones = conCrampones(ladera, e.x, e.y, e.z, tenia);
    r.crampones = e.crampones && !tenia;
  }
  r.jugadas = pasoPartida(c.partida, { x: e.x, y: e.y, z: e.z, aterrizaje: r.sucesos.aterrizaje }, peligros, paso);
  if (r.jugadas.some((j) => j.tipo === 'fin')) c.reaparecerEn = CARRERA.reaparicion;
  if (c.llegada === null && haLlegado(e, tramo)) {
    c.llegada = tiempo;
    r.llego = true;
  }
  return r;
}

/* ---------- Llegadas y clasificación ---------- */

export interface Participante {
  id: string;
  nombre: string;
  /** Persona (true) o rival del ordenador (false). */
  persona: boolean;
}

export interface Llegada {
  id: string;
  tiempo: number;
  /** Orden en que se supo (para desempatar). */
  orden: number;
}

export interface FilaClasificacion extends Participante {
  puesto: number;
  /** Tiempo de llegada, o null si no ha llegado. */
  tiempo: number | null;
  altura: number;
}

/**
 * Clasificación: primero los que han llegado, por tiempo (y, si empatan, por
 * el orden en que se supo); detrás, los que no, por altura.
 */
export function clasificar(participantes: Participante[], llegadas: Llegada[], alturas: Map<string, number>): FilaClasificacion[] {
  const porId = new Map(llegadas.map((l) => [l.id, l]));
  const filas = participantes.map((p) => ({
    ...p,
    puesto: 0,
    tiempo: porId.get(p.id)?.tiempo ?? null,
    altura: alturas.get(p.id) ?? 0,
    orden: porId.get(p.id)?.orden ?? Infinity,
  }));
  filas.sort((a, b) => {
    if (a.tiempo !== null && b.tiempo !== null) return a.tiempo - b.tiempo || a.orden - b.orden;
    if (a.tiempo !== null) return -1;
    if (b.tiempo !== null) return 1;
    return b.altura - a.altura;
  });
  return filas.map(({ orden: _orden, ...f }, i) => ({ ...f, puesto: i + 1 }));
}

/**
 * ¿Se da la carrera por acabada? Cuando han llegado todas las PERSONAS que
 * siguen en la sala, o cuando han pasado `esperaTrasPrimero` s desde el
 * primero en llegar (persona u ordenador). Lo decide el anfitrión.
 */
export function carreraAcabada(
  participantes: Participante[],
  presentes: Set<string>,
  llegadas: Llegada[],
  tiempo: number,
): boolean {
  const llegados = new Set(llegadas.map((l) => l.id));
  const personas = participantes.filter((p) => p.persona && presentes.has(p.id));
  if (personas.length > 0 && personas.every((p) => llegados.has(p.id))) return true;
  if (llegadas.length === 0) return false;
  const primero = Math.min(...llegadas.map((l) => l.tiempo));
  return tiempo - primero >= CARRERA.esperaTrasPrimero;
}

/** «1:23,4» a partir de segundos. */
export function formatearTiempo(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const s = segundos - min * 60;
  return `${min}:${s.toFixed(1).padStart(4, '0').replace('.', ',')}`;
}

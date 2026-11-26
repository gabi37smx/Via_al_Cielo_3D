/*
 * El «idioma» de la red. LÓGICA PURA (sin Supabase ni DOM): códigos de sala,
 * quién es el anfitrión y cómo se empaqueta el estado de un escalador.
 *
 * Cómo funciona la carrera en red (docs/diseno.md):
 * - Cada jugador simula SU escalador y envía su estado ~10 veces por segundo.
 * - Los demás lo ven interpolado con un pequeño retardo (red/interpolacion.ts).
 * - El anfitrión es el que lleva más tiempo en la sala; su semilla es la de
 *   la torre. Si se va, lo es el siguiente (y ya tiene la misma semilla).
 */
import type { Postura } from '../jugador/control.ts';

export const MAX_JUGADORES = 4;
/** Estados por segundo que envía cada jugador. */
export const ENVIOS_POR_SEGUNDO = 10;

/** Sin I ni O: no se confunden con 1 y 0 al dictar el código. */
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generarCodigo(azar: () => number = Math.random): string {
  return Array.from({ length: 4 }, () => LETRAS[Math.floor(azar() * LETRAS.length)]).join('');
}

/** Limpia lo que escribe el jugador: «ab-cd » → «ABCD». Devuelve null si no vale. */
export function normalizarCodigo(texto: string): string | null {
  const c = texto.toUpperCase().replace(/[^A-Z]/g, '');
  return c.length === 4 ? c : null;
}

/** Nombre visible: sin caracteres raros y como mucho 12 letras. */
export function limpiarNombre(texto: string): string {
  const n = texto.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  return n || 'Escalador';
}

/** Con quién se sube (idea I5): se elige en el menú, no se adivina por el nombre. */
export type Aspecto = 'escalador' | 'escaladora';
export const ASPECTOS: readonly Aspecto[] = ['escalador', 'escaladora'];

/** Lee un aspecto que llega de fuera (red, URL, localStorage); si no vale, escalador. */
export function leerAspecto(valor: unknown): Aspecto {
  return ASPECTOS.includes(valor as Aspecto) ? (valor as Aspecto) : 'escalador';
}

export interface Miembro {
  id: string;
  nombre: string;
  /** Escalador o escaladora: los rivales te ven como te has elegido. */
  aspecto: Aspecto;
  /** Cuándo entró en la sala (ms desde 1970): el más antiguo es el anfitrión. */
  unidoEn: number;
  /** Semilla de la torre que trae este jugador. */
  semilla: number;
}

/** Orden de la sala: por antigüedad (y por id si entraron a la vez). */
export function ordenarMiembros(miembros: Miembro[]): Miembro[] {
  return [...miembros].sort((a, b) => a.unidoEn - b.unidoEn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function elegirAnfitrion(miembros: Miembro[]): Miembro | undefined {
  return ordenarMiembros(miembros)[0];
}

/** ¿Este jugador cabe? Solo los MAX_JUGADORES más antiguos juegan. */
export function cabeEnSala(miembros: Miembro[], id: string): boolean {
  return ordenarMiembros(miembros).slice(0, MAX_JUGADORES).some((m) => m.id === id);
}

/* ---------- Estado de un escalador ---------- */

export const POSTURAS: readonly Postura[] = ['quieto', 'corriendo', 'subiendo', 'cayendo', 'dobleSalto', 'colgado', 'trepando'];

export interface EstadoRed {
  /** Reloj del que lo envía (ms). Solo sirve para espaciar los estados. */
  t: number;
  x: number;
  y: number;
  z: number;
  orientacion: number;
  postura: Postura;
  rapidez: number;
  /** Progreso de la voltereta del doble salto o de trepar (0-1). */
  voltereta: number;
}

/*
 * Se envía como una lista de números redondeados (cm y milésimas): unas 40
 * cifras en vez de un objeto con nombres. 10 veces por segundo × 4
 * jugadores, se nota.
 */
export function codificar(e: EstadoRed): number[] {
  const cm = (v: number) => Math.round(v * 100) / 100;
  return [
    Math.round(e.t),
    cm(e.x),
    cm(e.y),
    cm(e.z),
    Math.round(e.orientacion * 1000) / 1000,
    POSTURAS.indexOf(e.postura),
    cm(e.rapidez),
    Math.round(e.voltereta * 100) / 100,
  ];
}

/** Devuelve null si el mensaje no tiene buena pinta (no se confía en la red). */
export function decodificar(d: unknown): EstadoRed | null {
  if (!Array.isArray(d) || d.length !== 8 || !d.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const [t, x, y, z, orientacion, p, rapidez, voltereta] = d as number[];
  const postura = POSTURAS[p!];
  if (!postura) return null;
  return { t: t!, x: x!, y: y!, z: z!, orientacion: orientacion!, postura, rapidez: rapidez!, voltereta: voltereta! };
}

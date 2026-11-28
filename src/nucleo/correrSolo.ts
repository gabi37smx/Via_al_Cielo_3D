/*
 * CORRER SOLO (Gabi, 28-nov): pulsando 3 veces seguidas la misma tecla de
 * moverse (adelante, izquierda o derecha: W, A, D o las flechas) el escalador
 * sale corriendo más rápido HACIA ESE LADO sin tener que mantener nada
 * pulsado (se gira con el ratón). Se para al pulsar cualquier tecla.
 * Pensado para los tramos largos que hay que andar, para curiosear y para ir
 * de lado junto a la pared buscando por dónde subir.
 *
 * LÓGICA PURA: recibe las pulsaciones con su instante (s) y dice si está
 * corriendo y hacia dónde. La entrada (entrada.ts) le pasa las del teclado.
 */
import { CONFIG } from '../config.ts';

export type Sentido = 'adelante' | 'izquierda' | 'derecha';

/** Qué tecla mueve hacia qué lado (W y la flecha de arriba cuentan igual). */
export const TECLAS_CORRER: Readonly<Record<string, Sentido>> = {
  KeyW: 'adelante',
  ArrowUp: 'adelante',
  KeyA: 'izquierda',
  ArrowLeft: 'izquierda',
  KeyD: 'derecha',
  ArrowRight: 'derecha',
};

/** Lo que se mueve hacia cada lado (como las teclas: x de lado, y adelante). */
export const DIRECCION: Readonly<Record<Sentido, { moverX: number; moverY: number }>> = {
  adelante: { moverX: 0, moverY: 1 },
  izquierda: { moverX: -1, moverY: 0 },
  derecha: { moverX: 1, moverY: 0 },
};

export interface CorrerSolo {
  /** Hacia dónde corre, o null si no corre. */
  activo: Sentido | null;
  /** Hacia dónde son los toques que se están contando y sus instantes (s). */
  sentido: Sentido | null;
  toques: number[];
}

export function crearCorrerSolo(): CorrerSolo {
  return { activo: null, sentido: null, toques: [] };
}

/**
 * Una tecla pulsada (sin contar la repetición de mantenerla) en el instante
 * `t` (s). Corriendo, cualquier tecla lo para; si no, el tercer toque seguido
 * de la misma tecla de moverse (cada uno a menos de `separacionToques` del
 * anterior) lo empieza hacia ese lado. Devuelve true si ha empezado a correr.
 */
export function pulsarTecla(c: CorrerSolo, codigo: string, t: number): boolean {
  const { toquesCorrer, separacionToques } = CONFIG.escalador;
  if (c.activo) {
    pararCorrer(c);
    return false;
  }
  const sentido = TECLAS_CORRER[codigo];
  if (!sentido) {
    pararCorrer(c);
    return false;
  }
  const ultimo = c.toques[c.toques.length - 1];
  if (sentido !== c.sentido || (ultimo !== undefined && t - ultimo > separacionToques)) c.toques = [];
  c.sentido = sentido;
  c.toques.push(t);
  if (c.toques.length < toquesCorrer) return false;
  c.activo = sentido;
  c.toques = [];
  return true;
}

/** Parar (al subir a la avioneta, al acabar la partida, al quedarse quieto en la carrera…). */
export function pararCorrer(c: CorrerSolo): void {
  c.activo = null;
  c.sentido = null;
  c.toques = [];
}

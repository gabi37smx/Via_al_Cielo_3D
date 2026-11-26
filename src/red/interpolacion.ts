/*
 * Ver a los rivales SUAVES aunque sus estados lleguen 10 veces por segundo
 * y a trompicones. LÓGICA PURA.
 *
 * Idea: no se pinta al rival donde dice el último mensaje, sino donde estaba
 * hace RETARDO ms, mezclando los dos estados que rodean ese instante. Como
 * siempre hay un estado «después», el movimiento sale continuo.
 *
 * Los relojes de dos ordenadores no coinciden, así que se estima la
 * diferencia: (cuándo llegó aquí) − (cuándo dice que salió). El valor MÁS
 * PEQUEÑO visto es el del mensaje más rápido: es la mejor estimación.
 */
import type { EstadoRed } from './protocolo.ts';

/** Retardo con el que se pinta a los rivales (ms). Con 10 envíos/s, ~1,5 mensajes. */
export const RETARDO = 150;
/** Si deja de llegar nada, como mucho se alarga el último estado este tiempo (ms). */
const MAX_HUECO = 500;
/** Estados que se guardan por rival (2 s a 10/s). */
const MAX_ESTADOS = 20;

export class Interpolador {
  private estados: EstadoRed[] = [];
  private desfase = Infinity;
  /** Cuándo llegó el último estado (reloj local, ms). */
  ultimoRecibido = -Infinity;

  /** `recibidoEn`: reloj local cuando llegó el mensaje (ms). */
  anadir(e: EstadoRed, recibidoEn: number) {
    const ultimo = this.estados.at(-1);
    if (ultimo && e.t <= ultimo.t) return; // repetido o desordenado: fuera
    this.estados.push(e);
    if (this.estados.length > MAX_ESTADOS) this.estados.shift();
    this.desfase = Math.min(this.desfase, recibidoEn - e.t);
    this.ultimoRecibido = recibidoEn;
  }

  get vacio() {
    return this.estados.length === 0;
  }

  /** Estado a pintar en el instante local `ahora` (ms). */
  muestrear(ahora: number): EstadoRed | null {
    const n = this.estados.length;
    if (n === 0) return null;
    const objetivo = ahora - this.desfase - RETARDO; // en el reloj del rival
    const primero = this.estados[0]!;
    const ultimo = this.estados[n - 1]!;
    if (objetivo <= primero.t) return primero;
    if (objetivo >= ultimo.t) {
      // Sin estado posterior: se queda en el último (sin inventar movimiento).
      return objetivo - ultimo.t > MAX_HUECO ? { ...ultimo, rapidez: 0 } : ultimo;
    }
    let i = n - 1;
    while (this.estados[i - 1]!.t > objetivo) i--;
    const a = this.estados[i - 1]!;
    const b = this.estados[i]!;
    const f = (objetivo - a.t) / (b.t - a.t);
    let giro = b.orientacion - a.orientacion;
    giro = Math.atan2(Math.sin(giro), Math.cos(giro)); // el camino corto
    return {
      t: objetivo,
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      z: a.z + (b.z - a.z) * f,
      orientacion: a.orientacion + giro * f,
      postura: f < 0.5 ? a.postura : b.postura,
      rapidez: a.rapidez + (b.rapidez - a.rapidez) * f,
      voltereta: b.voltereta >= a.voltereta ? a.voltereta + (b.voltereta - a.voltereta) * f : b.voltereta,
    };
  }
}

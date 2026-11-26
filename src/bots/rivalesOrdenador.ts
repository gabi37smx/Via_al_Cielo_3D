/*
 * Los rivales del ordenador de la carrera (sesión 6): rellenan los huecos de
 * la sala hasta 4. LÓGICA PURA.
 *
 * No viajan por la red: cada navegador los simula por su cuenta con la
 * semilla de la sala, el mismo cerebro y las mismas reglas que el jugador
 * (`pasoCorredor`). Como todo es determinista, todos ven las mismas subidas
 * y los mismos tiempos de llegada, sin gastar mensajes.
 */
import type { Aspecto } from '../red/protocolo.ts';
import { crearAzar, derivarSemilla } from '../reglas/azar.ts';
import { crearCorredor, pasoCorredor, type Corredor, type Participante, type PasoCorredor } from '../reglas/carrera.ts';
import type { Peligros } from '../reglas/partida.ts';
import { alturaSuelo, type Tramo } from '../reglas/torre.ts';
import { crearCerebro, type Cerebro } from './cerebro.ts';

/** Nombre, aspecto y ritmo de cada rival (pausa máxima tras cada aterrizaje, s). */
export const PERSONALIDADES: readonly { nombre: string; aspecto: Aspecto; pausaMax: number }[] = [
  { nombre: 'Roca', aspecto: 'escalador', pausaMax: 0.5 },
  { nombre: 'Grieta', aspecto: 'escaladora', pausaMax: 0.8 },
  { nombre: 'Pico', aspecto: 'escalador', pausaMax: 1.1 },
];

export interface RivalOrdenador extends Participante {
  aspecto: Aspecto;
  corredor: Corredor;
  cerebro: Cerebro;
}

/**
 * `cantidad` rivales que salen desde los puestos `primerPuesto`,
 * `primerPuesto + 1`… (detrás de las personas de la sala).
 */
export function crearRivalesOrdenador(semilla: number, ronda: number, tramo: Tramo, cantidad: number, primerPuesto: number): RivalOrdenador[] {
  return PERSONALIDADES.slice(0, cantidad).map((p, i) => ({
    id: `ordenador-${i}`,
    nombre: p.nombre,
    persona: false,
    aspecto: p.aspecto,
    corredor: crearCorredor(tramo, primerPuesto + i),
    // Cada ronda, otras pausas: la revancha no es una repetición.
    cerebro: crearCerebro(tramo, { pausaMax: p.pausaMax, azar: crearAzar(derivarSemilla(semilla, 3000 + ronda * 10 + i)) }),
  }));
}

/** Un paso de todos los rivales del ordenador. Devuelve lo que le ha pasado a cada uno. */
export function pasoRivalesOrdenador(
  rivales: RivalOrdenador[],
  tramo: Tramo,
  peligros: Peligros,
  tiempo: number,
  paso: number,
): PasoCorredor[] {
  const suelo = (x: number, z: number, techo: number) => alturaSuelo(tramo, x, z, techo);
  return rivales.map((r) => pasoCorredor(r.corredor, r.cerebro.pensar(r.corredor.escalador, paso), tramo, suelo, peligros, tiempo, paso));
}

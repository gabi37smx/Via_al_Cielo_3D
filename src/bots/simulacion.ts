/*
 * Simula una subida completa de un tramo con el cerebro del ordenador, con
 * el mismo movimiento y las mismas reglas que el juego, sin navegador.
 * Responde a «¿se puede subir esta torre?» y «¿cuánto daño hacen los
 * murciélagos?» en milisegundos.
 */
import { crearEscalador, pasoEscalador } from '../jugador/control.ts';
import { PASO } from '../nucleo/bucle.ts';
import {
  REGLAS,
  crearPartida,
  generarFragmentos,
  generarMurcielagos,
  pasoPartida,
} from '../reglas/partida.ts';
import { RADIO_SALIENTES, alturaSuelo, generarTramo } from '../reglas/torre.ts';
import { crearCerebro } from './cerebro.ts';

export interface ResultadoSimulacion {
  semilla: number;
  /** Ha llegado al rellano de arriba. */
  llego: boolean;
  /** Se ha quedado sin vida. */
  murio: boolean;
  segundos: number;
  saltos: number;
  doblesSaltos: number;
  /** Caídas de más de 5 m (se ha equivocado de saliente). */
  tropiezos: number;
  golpes: number;
  fragmentos: number;
  vida: number;
}

export interface OpcionesSimulacion {
  murcielagos?: number;
  /** Corta si tarda más (s). */
  limite?: number;
}

export function simularSubida(semilla: number, op: OpcionesSimulacion = {}): ResultadoSimulacion {
  const tramo = generarTramo(semilla, 0);
  const suelo = (x: number, z: number, techo: number) => alturaSuelo(tramo, x, z, techo);
  const peligros = {
    fragmentos: generarFragmentos(semilla, tramo),
    murcielagos: generarMurcielagos(semilla, tramo, op.murcielagos ?? REGLAS.murcielagosCueva),
  };
  const a = tramo.salientes[0]!.angulo - 0.7;
  const e = crearEscalador(Math.cos(a) * (RADIO_SALIENTES + 2), 0, Math.sin(a) * (RADIO_SALIENTES + 2));
  const partida = crearPartida();
  const r: ResultadoSimulacion = {
    semilla, llego: false, murio: false, segundos: 0, saltos: 0, doblesSaltos: 0,
    tropiezos: 0, golpes: 0, fragmentos: 0, vida: 100,
  };

  const cerebro = crearCerebro(tramo);
  const limite = op.limite ?? 300;
  for (let t = 0; t < limite; t += PASO) {
    const sucesos = pasoEscalador(e, cerebro.pensar(e), suelo, PASO);
    if (sucesos.salto) r.saltos++;
    if (sucesos.dobleSalto) r.doblesSaltos++;
    if (sucesos.aterrizaje > 5) r.tropiezos++;
    pasoPartida(partida, { x: e.x, y: e.y, z: e.z, aterrizaje: sucesos.aterrizaje }, peligros, PASO);
    r.segundos = t;
    if (partida.terminada) {
      r.murio = true;
      break;
    }
    if (e.enSuelo && e.y >= tramo.rellano - 1e-6) {
      r.llego = true;
      break;
    }
  }
  r.golpes = partida.golpes;
  r.fragmentos = partida.recogidos.length;
  r.vida = partida.vida;
  return r;
}

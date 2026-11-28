/*
 * Simula una subida completa de un tramo con el cerebro del ordenador, con
 * el mismo movimiento y las mismas reglas que el juego, sin navegador.
 * Responde a «¿se puede subir esta torre?» y «¿cuánto daño hacen los
 * murciélagos?» en milisegundos.
 */
import { crearEscalador, pasoEscalador } from '../jugador/control.ts';
import { PASO } from '../nucleo/bucle.ts';
import {
  crearPartida,
  generarFragmentos,
  generarMurcielagos,
  murcielagosDelTramo,
  pasoPartida,
  type Peligros,
} from '../reglas/partida.ts';
import { generarAguilas, viento } from '../reglas/aire.ts';
import { INDICE_LADERA, alturaSueloLadera, conCrampones, generarLadera, limiteMundo, salidaLadera, type Ladera, type Limite } from '../reglas/ladera.ts';
import { generarFragmentosLadera } from '../reglas/partida.ts';
import { alturaSuelo, generarTramo, puntoDeSalida } from '../reglas/torre.ts';
import { crearCerebro, siguienteObjetivoLadera, type Cerebro } from './cerebro.ts';

export interface ResultadoSimulacion {
  semilla: number;
  /** Ha llegado al rellano de arriba. */
  llego: boolean;
  /** Se ha quedado sin vida. */
  murio: boolean;
  segundos: number;
  saltos: number;
  doblesSaltos: number;
  /** Veces que se ha quedado corto y se ha agarrado al borde. */
  agarres: number;
  /** Caídas de más de 5 m (se ha equivocado de saliente). */
  tropiezos: number;
  golpes: number;
  fragmentos: number;
  vida: number;
}

export interface OpcionesSimulacion {
  /** Qué tramo se sube (0 = la cueva, 1 = la grieta). */
  tramo?: number;
  /** Sin él, los del tramo (`murcielagosDelTramo`). En la ladera, son águilas (sin él, `AIRE.aguilas`). */
  murcielagos?: number;
  /** Corta si tarda más (s). */
  limite?: number;
}

/** Lo que necesita la simulación de un tramo: dónde se pisa, por dónde no se pasa, peligros, salida y cerebro. */
interface Escenario {
  base: number;
  rellano: number;
  suelo: (x: number, z: number, techo: number) => number;
  limite?: Limite;
  peligros: Peligros;
  salida: { x: number; z: number };
  cerebro: Cerebro;
  /** En la ladera: para ponerse los crampones. */
  ladera?: Ladera;
}

function escenario(semilla: number, indice: number, murcielagos?: number): Escenario {
  if (indice === INDICE_LADERA) {
    const l = generarLadera(semilla);
    return {
      base: l.base,
      rellano: l.rellano,
      suelo: (x, z, techo) => alturaSueloLadera(l, x, z, techo),
      limite: limiteMundo(l),
      peligros: { fragmentos: generarFragmentosLadera(semilla, l), murcielagos: [], aguilas: generarAguilas(semilla, l, murcielagos) },
      salida: salidaLadera(l),
      cerebro: crearCerebro((e, apoyo) => siguienteObjetivoLadera(e, l, apoyo)),
      ladera: l,
    };
  }
  const tramo = generarTramo(semilla, indice);
  return {
    base: tramo.base,
    rellano: tramo.rellano,
    suelo: (x, z, techo) => alturaSuelo(tramo, x, z, techo),
    peligros: {
      fragmentos: generarFragmentos(semilla, tramo),
      murcielagos: generarMurcielagos(semilla, tramo, murcielagos ?? murcielagosDelTramo(tramo.indice)),
    },
    salida: puntoDeSalida(tramo),
    cerebro: crearCerebro(tramo),
  };
}

export function simularSubida(semilla: number, op: OpcionesSimulacion = {}): ResultadoSimulacion {
  const { base, rellano, suelo, limite, peligros, salida, cerebro, ladera } = escenario(semilla, op.tramo ?? 0, op.murcielagos);
  const e = crearEscalador(salida.x, base, salida.z);
  const partida = crearPartida();
  partida.alturaMaxima = base;
  const r: ResultadoSimulacion = {
    semilla, llego: false, murio: false, segundos: 0, saltos: 0, doblesSaltos: 0,
    agarres: 0, tropiezos: 0, golpes: 0, fragmentos: 0, vida: 100,
  };

  const tope = op.limite ?? 300;
  for (let t = 0; t < tope; t += PASO) {
    const aire = ladera ? viento(ladera, e.x, e.y, e.z, partida.tiempo) : undefined;
    const sucesos = pasoEscalador(e, cerebro.pensar(e), suelo, PASO, limite, aire);
    if (ladera) e.crampones = conCrampones(ladera, e.x, e.y, e.z, e.crampones);
    if (sucesos.salto) r.saltos++;
    if (sucesos.dobleSalto) r.doblesSaltos++;
    if (sucesos.agarre) r.agarres++;
    if (sucesos.aterrizaje > 5) r.tropiezos++;
    pasoPartida(partida, { x: e.x, y: e.y, z: e.z, aterrizaje: sucesos.aterrizaje }, peligros, PASO);
    r.segundos = t;
    if (partida.terminada) {
      r.murio = true;
      break;
    }
    if (e.enSuelo && e.y >= rellano - 1e-6) {
      r.llego = true;
      break;
    }
  }
  r.golpes = partida.golpes;
  r.fragmentos = partida.recogidos.length;
  r.vida = partida.vida;
  return r;
}

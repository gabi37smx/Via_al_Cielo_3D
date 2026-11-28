/*
 * QUÉ suena en cada paso (sesión 7). LÓGICA PURA: sin Web Audio ni DOM.
 * Recibe lo que ha pasado en el paso del corredor (saltos, aterrizajes,
 * agarres, jugadas de las reglas…) y devuelve la lista de sonidos que tocan.
 * CÓMO suena cada uno lo decide sintetizador.ts.
 *
 * Los pasos al correr suenan cada `CONFIG.sonido.zancada` metros recorridos
 * por el suelo: así van más rápidos cuanto más rápido corre, sin depender de
 * los fps.
 */
import { CONFIG } from '../config.ts';
import type { Escalador, Postura } from '../jugador/control.ts';
import type { PasoCorredor } from '../reglas/carrera.ts';

export const SONIDOS = [
  'salto',
  'dobleSalto',
  'aterrizaje',
  'paso',
  'agarre',
  'trepar',
  'fragmento',
  'vidaExtra',
  'golpe',
  'caida',
  'derrota',
  'record',
  'reaparecer',
  'tramo',
  'cuenta',
  'salida',
  'meta',
  'victoria',
  'finCarrera',
  'gota',
  'crampones',
  'pasoNieve',
  'graznido',
  'rafaga',
  'puerta',
  'ruedas',
] as const;

export type Sonido = (typeof SONIDOS)[number];

/** Un sonido con su fuerza (0-1): un aterrizaje desde más alto suena más. */
export interface Toque {
  sonido: Sonido;
  fuerza: number;
}

/** Lo que hay que recordar de un paso al siguiente. */
export interface Oido {
  posturaAnterior: Postura;
  /** Metros corridos desde el último paso que sonó. */
  recorrido: number;
}

const S = CONFIG.sonido;
/** Al empezar a correr, el primer paso suena enseguida (a media zancada). */
const ARRANQUE = S.zancada * 0.6;

export function crearOido(): Oido {
  return { posturaAnterior: 'quieto', recorrido: ARRANQUE };
}

const limitar = (v: number) => Math.min(Math.max(v, 0), 1);

export function sonidosDelPaso(o: Oido, r: PasoCorredor, e: Escalador, paso: number): Toque[] {
  const toques: Toque[] = [];
  const tocar = (sonido: Sonido, fuerza = 1) => toques.push({ sonido, fuerza });
  const s = r.sucesos;

  if (r.reaparecio) tocar('reaparecer');
  if (r.crampones) tocar('crampones');
  if (r.rafaga) tocar('rafaga');
  if (s.dobleSalto) tocar('dobleSalto');
  else if (s.salto) tocar('salto');
  if (s.agarre) tocar('agarre');
  if (e.postura === 'trepando' && o.posturaAnterior !== 'trepando') tocar('trepar');

  // Una caída que hace daño ya suena como «caida» (más fuerte): no se repite.
  const caidaConDanio = r.jugadas.some((j) => j.tipo === 'caida');
  if (s.aterrizaje >= S.aterrizajeMin && !caidaConDanio) tocar('aterrizaje', limitar(0.25 + s.aterrizaje / 8));

  for (const j of r.jugadas) {
    if (j.tipo === 'caida') tocar('caida', limitar(0.6 + j.metros / 40));
    else if (j.tipo === 'fin') tocar('derrota');
    else if (j.tipo === 'golpe' && j.animal === 'aguila') {
      tocar('golpe');
      tocar('graznido');
    } else tocar(j.tipo);
  }

  // Pasos: solo corriendo por el suelo.
  if (e.enSuelo && e.postura === 'corriendo') {
    o.recorrido += Math.hypot(e.vx, e.vz) * paso;
    if (o.recorrido >= S.zancada) {
      o.recorrido -= S.zancada;
      tocar(e.crampones ? 'pasoNieve' : 'paso', limitar(Math.hypot(e.vx, e.vz) / CONFIG.escalador.velocidad));
    }
  } else {
    o.recorrido = ARRANQUE;
  }

  o.posturaAnterior = e.postura;
  return toques;
}

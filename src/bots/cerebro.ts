/*
 * El «cerebro» de un escalador del ordenador. Mira dónde está y devuelve las
 * MISMAS órdenes que daría el teclado (moverX, moverY, saltar), que pasan por
 * el mismo `pasoEscalador` que el jugador: no puede hacer nada que un jugador
 * no pueda. Sirve para simular partidas (equilibrio) y, en la sesión 6, para
 * los rivales de la carrera.
 *
 * Estrategia sencilla: ir hacia el centro del siguiente saliente, saltar
 * cuando está a tiro y usar el doble salto si se queda corto.
 */
import type { Escalador, Ordenes } from '../jugador/control.ts';
import { RADIO_RELLANO, type Tramo } from '../reglas/torre.ts';

/** Distancia horizontal (m) a la que salta hacia el siguiente saliente. */
const DISTANCIA_SALTO = 2.6;

export interface Objetivo {
  x: number;
  y: number;
  z: number;
}

/**
 * El siguiente sitio donde subir: el primer saliente por encima del último
 * sitio PISADO (`apoyo`), o el rellano. No sirve la altura actual: en mitad
 * del salto ya está por encima del objetivo y cambiaría al siguiente sin
 * llegar a posarse (primer fallo de la simulación).
 */
export function siguienteObjetivo(e: Escalador, tramo: Tramo, apoyo: number): Objetivo {
  const s = tramo.salientes.find((x) => x.y > apoyo + 0.3);
  if (s) {
    // Centro del saliente, un poco hacia la columna (más margen al caer).
    const r = RADIO_RELLANO - 1.3;
    return { x: Math.cos(s.angulo) * r, y: s.y, z: Math.sin(s.angulo) * r };
  }
  // El rellano es un anillo: el punto del anillo a la altura y el lado donde está.
  const a = Math.atan2(e.z, e.x);
  return { x: Math.cos(a) * (RADIO_RELLANO - 1), y: tramo.rellano, z: Math.sin(a) * (RADIO_RELLANO - 1) };
}

export interface Cerebro {
  pensar(e: Escalador): Ordenes;
}

export function crearCerebro(tramo: Tramo): Cerebro {
  let apoyo = -Infinity;
  return {
    pensar(e) {
      if (e.enSuelo) apoyo = e.y;
      return decidir(e, siguienteObjetivo(e, tramo, apoyo));
    },
  };
}

function decidir(e: Escalador, o: Objetivo): Ordenes {
  const dx = o.x - e.x;
  const dz = o.z - e.z;
  const d = Math.hypot(dx, dz);

  // Con la cámara en giro 0, adelante es −z y derecha es +x.
  // Cerca del objetivo afloja para no pasarse.
  const fuerza = Math.min(d / 0.8, 1);
  const moverX = d > 0.05 ? (dx / d) * fuerza : 0;
  const moverY = d > 0.05 ? (-dz / d) * fuerza : 0;

  let saltar = false;
  if (e.enSuelo) {
    saltar = d < DISTANCIA_SALTO;
  } else if (e.saltosAereos > 0 && e.vy < 0 && e.y < o.y + 0.3 && d > 0.6) {
    saltar = true; // se queda corto: doble salto
  }
  return { moverX, moverY, saltar, giroCamara: 0 };
}

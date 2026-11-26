/*
 * El «cerebro» de un escalador del ordenador. Mira dónde está y devuelve las
 * MISMAS órdenes que daría el teclado (moverX, moverY, saltar), que pasan por
 * el mismo `pasoEscalador` que el jugador: no puede hacer nada que un jugador
 * no pueda. Sirve para simular partidas (equilibrio) y, en la sesión 6, para
 * los rivales de la carrera.
 *
 * Estrategia sencilla: ir hacia el punto más cercano del siguiente saliente, saltar
 * cuando está a tiro y usar el doble salto si se queda corto.
 */
import type { Escalador, Ordenes } from '../jugador/control.ts';
import { PASO } from '../nucleo/bucle.ts';
import type { Azar } from '../reglas/azar.ts';
import { RADIO_CAMINO, RADIO_PARED, puntoEnAngulo, type Tramo } from '../reglas/torre.ts';

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
    // El punto del saliente más cercano, sin acercarse a sus bordes (en una
    // cornisa de 6 m no tiene sentido ir al medio), y un poco hacia la pared.
    const margen = Math.min(0.6, s.ancho / 2 - 0.1);
    const mitad = (s.ancho / 2 - margen) / RADIO_CAMINO;
    const delante = Math.atan2(Math.sin(Math.atan2(e.z, e.x) - s.angulo), Math.cos(Math.atan2(e.z, e.x) - s.angulo));
    const angulo = s.angulo + Math.min(Math.max(delante, -mitad), mitad);
    return { ...puntoEnAngulo(angulo, RADIO_PARED - Math.min(0.9, s.fondo - 0.4)), y: s.y };
  }
  // El rellano da la vuelta entera a la pared: el punto que tiene delante.
  return { ...puntoEnAngulo(Math.atan2(e.z, e.x), RADIO_PARED - 1), y: tramo.rellano };
}

export interface Cerebro {
  /** Las órdenes de este paso (`paso` = lo que dura el paso, para las pausas). */
  pensar(e: Escalador, paso?: number): Ordenes;
}

export interface OpcionesCerebro {
  /**
   * Pausa al azar (0 a `pausaMax` s) cada vez que aterriza en un saliente
   * nuevo, antes de seguir. Da a cada rival del ordenador su ritmo: sin
   * pausas todos subirían igual y llegarían casi juntos.
   */
  pausaMax?: number;
  /** El azar de las pausas (con semilla: todos los navegadores ven lo mismo). */
  azar?: Azar;
}

const QUIETO: Ordenes = { moverX: 0, moverY: 0, saltar: false, giroCamara: 0 };

export function crearCerebro(tramo: Tramo, opciones: OpcionesCerebro = {}): Cerebro {
  const { pausaMax = 0, azar } = opciones;
  let apoyo = -Infinity;
  let espera = 0;
  return {
    pensar(e, paso = PASO) {
      if (e.enSuelo) {
        // Acaba de aterrizar en otro sitio: pausa antes de seguir.
        if (Math.abs(e.y - apoyo) > 0.3 && azar && pausaMax > 0) espera = azar() * pausaMax;
        apoyo = e.y;
      }
      if (espera > 0) {
        espera -= paso;
        return QUIETO;
      }
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
  } else if (e.saltosAereos > 0 && e.vy < 0 && e.y < o.y) {
    // Se queda corto: doble salto. Aunque ya esté justo debajo (d ≈ 0): en
    // un saliente alto llega a su sitio antes que a su altura.
    saltar = true;
  }
  return { moverX, moverY, saltar, giroCamara: 0 };
}

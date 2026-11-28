/*
 * El viaje en avioneta de la cima a Valencia (idea I9): une las reglas del
 * vuelo (reglas/vuelo.ts), la avioneta que se ve (mundo/avioneta.ts), la
 * pantalla con las bandas y el blanco (ui/vuelo.ts) y el sonido del motor.
 *
 * Tres estados: la avioneta espera en la cima (`montana`), se vuela
 * (`volando`: la escena dura ~15 s y se puede saltar) y ya en Valencia
 * (`valencia`: aparcada al final de la pista). main.ts decide cuándo se sube
 * (al tocarla) y qué hacer al bajar (poner al escalador junto a la puerta).
 */
import type * as THREE from 'three';
import type { Avioneta } from '../mundo/avioneta.ts';
import type { Ladera } from '../reglas/ladera.ts';
import { DURACION_VUELO, T_TOMA, avionetaEnCima, poseVuelo, type PoseVuelo } from '../reglas/vuelo.ts';
import type { Sonido } from '../sonido/sucesos.ts';

/** Al subir, tantos segundos sin poder saltar la escena (que el salto con el que se llega no la salte). */
const SIN_SALTAR = 0.5;

export type EstadoViaje = 'montana' | 'volando' | 'valencia';

export interface OpcionesViaje {
  ladera: Ladera;
  avioneta: Avioneta;
  pantalla: { mostrar(si: boolean): void; blanco(cuanto: number): void };
  sonar(sonido: Sonido): void;
  motor(potencia: number): void;
}

export function crearViaje(o: OpcionesViaje) {
  let estado: EstadoViaje = 'montana';
  let t = 0;
  /** Tiempo de la escena en el paso anterior (para el chirrido de las ruedas). */
  let antes = 0;
  /** La pose del último paso y la de este: al pintar se mezclan (movimiento suave). */
  let poseAntes: PoseVuelo = poseVuelo(o.ladera, 0);
  let poseAhora: PoseVuelo = poseAntes;

  function aparcar(donde: 'montana' | 'valencia') {
    const p = poseVuelo(o.ladera, donde === 'montana' ? 0 : DURACION_VUELO);
    poseAntes = poseAhora = p;
    o.avioneta.colocar({ ...p, motor: 0, puerta: 1 }, 0);
  }
  aparcar('montana');

  /** Mezcla dos poses (en el cambio de sitio no: se salta de golpe, tapado de blanco). */
  function mezclar(a: PoseVuelo, b: PoseVuelo, alfa: number): PoseVuelo {
    if (a.lugar !== b.lugar) return b;
    const m = (x: number, y: number) => x + (y - x) * alfa;
    const ang = (x: number, y: number) => x + Math.atan2(Math.sin(y - x), Math.cos(y - x)) * alfa;
    const punto = (p: THREE.Vector3Like, q: THREE.Vector3Like) => ({ x: m(p.x, q.x), y: m(p.y, q.y), z: m(p.z, q.z) });
    return {
      ...b,
      ...punto(a, b),
      rumbo: ang(a.rumbo, b.rumbo),
      cabeceo: m(a.cabeceo, b.cabeceo),
      alabeo: m(a.alabeo, b.alabeo),
      camara: punto(a.camara, b.camara),
      mira: punto(a.mira, b.mira),
      blanco: m(a.blanco, b.blanco),
    };
  }

  return {
    get estado() {
      return estado;
    },
    volando: () => estado === 'volando',
    /** Dónde está lo que se ve ahora: en el vuelo, donde va la avioneta. */
    lugar(): 'montana' | 'valencia' {
      if (estado === 'volando') return poseAhora.lugar === 'cima' ? 'montana' : 'valencia';
      return estado;
    },
    /** Dónde espera la avioneta en la cima (para los avisos). */
    sitioEnCima: () => avionetaEnCima(o.ladera),
    /** Se sube: empieza la escena (`desde`: en otro segundo, para las capturas). */
    empezar(desde = 0) {
      if (estado !== 'montana') return;
      estado = 'volando';
      t = antes = Math.min(Math.max(desde, 0), DURACION_VUELO - 0.01);
      poseAntes = poseAhora = poseVuelo(o.ladera, t);
      o.pantalla.mostrar(true);
      o.sonar('puerta');
    },
    /** Saltar la escena (Espacio o Enter): se va al final. */
    saltar() {
      if (estado === 'volando' && t >= SIN_SALTAR) t = DURACION_VUELO;
    },
    /** Un paso de lógica. Devuelve true en el paso en que se acaba (toca bajar). */
    paso(dt: number): boolean {
      if (estado !== 'volando') return false;
      antes = t;
      t = Math.min(t + dt, DURACION_VUELO);
      poseAntes = poseAhora;
      poseAhora = poseVuelo(o.ladera, t);
      if (antes < T_TOMA && t >= T_TOMA && t - antes < 1) o.sonar('ruedas');
      if (t < DURACION_VUELO) return false;
      estado = 'valencia';
      o.pantalla.mostrar(false);
      o.pantalla.blanco(0);
      o.motor(0);
      aparcar('valencia');
      return true;
    },
    /**
     * Al pintar, durante el vuelo: coloca la avioneta, pone la cámara de la
     * escena, el blanco y el motor. Devuelve dónde está la avioneta (para
     * las luces) o null si no se vuela.
     */
    pintar(alfa: number, dt: number, camara: THREE.PerspectiveCamera): PoseVuelo | null {
      if (estado !== 'volando') return null;
      const p = mezclar(poseAntes, poseAhora, alfa);
      o.avioneta.colocar(p, dt);
      camara.position.set(p.camara.x, p.camara.y, p.camara.z);
      camara.lookAt(p.mira.x, p.mira.y, p.mira.z);
      o.pantalla.blanco(p.blanco);
      o.motor(p.motor);
      return p;
    },
    /** Volver a jugar: la avioneta vuelve a la cima. */
    reiniciar() {
      estado = 'montana';
      o.pantalla.mostrar(false);
      o.pantalla.blanco(0);
      o.motor(0);
      aparcar('montana');
    },
    /** Empezar ya en Valencia (`?valencia=1`): la avioneta, aparcada allí. */
    yaEnValencia() {
      estado = 'valencia';
      aparcar('valencia');
    },
  };
}

export type Viaje = ReturnType<typeof crearViaje>;

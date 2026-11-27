/*
 * Cámara en tercera persona: detrás del escalador y algo por encima. Gira
 * con el ratón, Q/E o el stick derecho, y le sigue con un pequeño retardo
 * (suaviza los saltos sin perderle de vista).
 *
 * Se escala la pared de un pozo (idea I2): lo natural es que la cámara vaya
 * por DENTRO, entre el centro y el escalador, mirando a la pared. Así nada se
 * pone en medio. Si no se toca la cámara un rato, vuelve sola a ese sitio
 * (`recolocar`). Si se la gira hasta que la pared queda detrás, se acerca al
 * escalador para no meterse en la roca (`acortarPorPared`).
 */
import * as THREE from 'three';
import { CONFIG } from '../config.ts';
import { RADIO_PARED } from '../reglas/torre.ts';

const C = CONFIG.camara;

/**
 * El giro que pone la cámara entre el centro del pozo y el punto (x, z),
 * mirando hacia la pared. La cámara está en (sin giro, cos giro) respecto al
 * escalador, así que esa dirección tiene que apuntar al centro. Pura.
 */
export function giroHaciaPared(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/**
 * La cámara tiene que quedarse dentro del pozo (un círculo de `radio` en el
 * plano). Si el segmento escalador → cámara se sale, devuelve qué fracción
 * del segmento se puede usar (0-1). Pura: sin Three.js.
 */
export function acortarPorPared(px: number, pz: number, cx: number, cz: number, radio: number): number {
  const dx = cx - px;
  const dz = cz - pz;
  // |p + t·d|² = radio²  →  a·t² + b·t + c = 0
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return 1;
  const b = 2 * (px * dx + pz * dz);
  const c = px * px + pz * pz - radio * radio;
  if (c >= 0) return 0; // el escalador ya está fuera del círculo (no debería pasar)
  // Con el escalador dentro (c < 0) siempre hay dos raíces, una negativa y
  // otra positiva: la positiva es por donde el segmento sale del círculo.
  const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return Math.min(t, 1);
}

export interface CamaraTerceraPersona {
  /** Hacia dónde mira (rad): la cámara está en (sin giro, cos giro) respecto al escalador. */
  readonly giro: number;
  girar(dGiro: number, dInclinacion: number): void;
  /**
   * Llamar en cada paso de la lógica con la posición del escalador: si nadie
   * ha tocado la cámara en un rato, la vuelve poco a poco hacia la pared (o
   * hacia `ideal`, si se da: fuera, detrás del escalador mirando a la montaña).
   */
  recolocar(x: number, z: number, paso: number, ideal?: number, inclinacionIdeal?: number): void;
  /**
   * Llamar al pintar con la posición (interpolada) de los pies del escalador.
   * `acortar` (fuera del pozo): qué fracción del segmento mira → cámara se puede usar sin meterse en la roca.
   */
  seguir(x: number, y: number, z: number, dt: number, acortar?: (mira: THREE.Vector3Like, camara: THREE.Vector3Like) => number): void;
}

export function crearCamaraTerceraPersona(camara: THREE.PerspectiveCamera, giroInicial = 0, inclinacionInicial: number = C.inclinacion): CamaraTerceraPersona {
  let giro = giroInicial;
  let inclinacion = inclinacionInicial;
  /** Segundos desde la última vez que se giró la cámara a mano. */
  let sinTocar = 0;
  const mira = new THREE.Vector3();
  let primera = true;

  return {
    get giro() {
      return giro;
    },
    girar(dGiro, dInclinacion) {
      if (dGiro !== 0 || dInclinacion !== 0) sinTocar = 0;
      giro += dGiro;
      inclinacion = Math.min(Math.max(inclinacion + dInclinacion, C.inclinacionMin), C.inclinacionMax);
    },
    recolocar(x, z, paso, ideal, inclinacionIdeal) {
      sinTocar += paso;
      // En el centro del pozo no hay «hacia la pared»: se deja como está.
      if (sinTocar < C.esperaRecolocar || (ideal === undefined && Math.hypot(x, z) < 1)) return;
      let falta = (ideal ?? giroHaciaPared(x, z)) - giro;
      falta = Math.atan2(Math.sin(falta), Math.cos(falta)); // el camino corto
      const f = 1 - Math.exp(-C.recolocar * paso);
      giro += falta * f;
      // También la inclinación (fuera mira más de frente: se ve la montaña y el cielo).
      inclinacion += ((inclinacionIdeal ?? C.inclinacion) - inclinacion) * f;
    },
    seguir(x, y, z, dt, acortar) {
      const objetivoY = y + C.alturaMira;
      if (primera) {
        mira.set(x, objetivoY, z);
        primera = false;
      } else {
        // Retardo independiente de los fps: 1 − e^(−k·dt).
        const f = 1 - Math.exp(-C.seguimiento * dt);
        mira.x += (x - mira.x) * f;
        mira.y += (objetivoY - mira.y) * f;
        mira.z += (z - mira.z) * f;
      }

      const horizontal = Math.cos(inclinacion) * C.distancia;
      let cx = mira.x + Math.sin(giro) * horizontal;
      let cz = mira.z + Math.cos(giro) * horizontal;
      let cy = mira.y + Math.sin(inclinacion) * C.distancia;

      // Que no se meta en la pared del pozo (solo dentro del pozo: fuera no hay pared detrás).
      const enPozo = Math.hypot(mira.x, mira.z) < RADIO_PARED - C.margenPared;
      const t = enPozo ? acortarPorPared(mira.x, mira.z, cx, cz, RADIO_PARED - C.margenPared) : (acortar?.(mira, { x: cx, y: cy, z: cz }) ?? 1);
      if (t < 1) {
        cx = mira.x + (cx - mira.x) * t;
        cz = mira.z + (cz - mira.z) * t;
        cy = mira.y + (cy - mira.y) * t;
      }

      camara.position.set(cx, cy, cz);
      camara.lookAt(mira);
    },
  };
}

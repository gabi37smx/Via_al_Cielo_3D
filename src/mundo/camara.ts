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
   * ha tocado la cámara en un rato, la vuelve poco a poco hacia la pared.
   */
  recolocar(x: number, z: number, paso: number): void;
  /** Llamar al pintar con la posición (interpolada) de los pies del escalador. */
  seguir(x: number, y: number, z: number, dt: number): void;
}

export function crearCamaraTerceraPersona(camara: THREE.PerspectiveCamera, giroInicial = 0): CamaraTerceraPersona {
  let giro = giroInicial;
  let inclinacion: number = C.inclinacion;
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
    recolocar(x, z, paso) {
      sinTocar += paso;
      // En el centro del pozo no hay «hacia la pared»: se deja como está.
      if (sinTocar < C.esperaRecolocar || Math.hypot(x, z) < 1) return;
      let falta = giroHaciaPared(x, z) - giro;
      falta = Math.atan2(Math.sin(falta), Math.cos(falta)); // el camino corto
      giro += falta * (1 - Math.exp(-C.recolocar * paso));
    },
    seguir(x, y, z, dt) {
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

      // Que no se meta en la pared del pozo.
      const t = acortarPorPared(mira.x, mira.z, cx, cz, RADIO_PARED - C.margenPared);
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

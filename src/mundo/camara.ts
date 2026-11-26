/*
 * Cámara en tercera persona: detrás del escalador y algo por encima. Gira
 * con el ratón, Q/E o el stick derecho, y le sigue con un pequeño retardo
 * (suaviza los saltos sin perderle de vista).
 *
 * Problema propio de una torre: si el escalador queda entre la cámara y la
 * columna no pasa nada, pero si la COLUMNA queda entre la cámara y el
 * escalador, la cámara se metería dentro de la roca. En ese caso se acerca
 * al escalador hasta quedar fuera de la columna (`acortarPorColumna`).
 */
import * as THREE from 'three';
import { CONFIG } from '../config.ts';
import { RADIO_COLUMNA, RADIO_MUNDO } from '../reglas/torre.ts';

const C = CONFIG.camara;

/**
 * Si el segmento escalador → cámara atraviesa la columna (un círculo en el
 * plano), devuelve qué fracción del segmento se puede usar (0-1). Pura: sin Three.js.
 */
export function acortarPorColumna(px: number, pz: number, cx: number, cz: number, radio: number): number {
  const dx = cx - px;
  const dz = cz - pz;
  // |p + t·d|² = radio²  →  a·t² + b·t + c = 0
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return 1;
  const b = 2 * (px * dx + pz * dz);
  const c = px * px + pz * pz - radio * radio;
  if (c < 0) return 1; // el escalador ya está «dentro» (no debería pasar)
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 1; // la línea no toca la columna
  const t = (-b - Math.sqrt(disc)) / (2 * a); // primer punto de entrada
  return t >= 0 && t < 1 ? t : 1;
}

export interface CamaraTerceraPersona {
  /** Hacia dónde mira (rad): la cámara está en (sin giro, cos giro) respecto al escalador. */
  readonly giro: number;
  girar(dGiro: number, dInclinacion: number): void;
  /** Llamar al pintar con la posición (interpolada) de los pies del escalador. */
  seguir(x: number, y: number, z: number, dt: number): void;
}

export function crearCamaraTerceraPersona(camara: THREE.PerspectiveCamera, giroInicial = 0): CamaraTerceraPersona {
  let giro = giroInicial;
  let inclinacion: number = C.inclinacion;
  const mira = new THREE.Vector3();
  let primera = true;

  return {
    get giro() {
      return giro;
    },
    girar(dGiro, dInclinacion) {
      giro += dGiro;
      inclinacion = Math.min(Math.max(inclinacion + dInclinacion, C.inclinacionMin), C.inclinacionMax);
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

      // Que no se meta en la columna...
      const t = acortarPorColumna(mira.x, mira.z, cx, cz, RADIO_COLUMNA + C.margenColumna);
      if (t < 1) {
        cx = mira.x + (cx - mira.x) * t;
        cz = mira.z + (cz - mira.z) * t;
        cy = mira.y + (cy - mira.y) * t;
      }
      // ...ni atraviese las paredes de la cueva.
      const r = Math.hypot(cx, cz);
      const rMax = RADIO_MUNDO - 1;
      if (r > rMax) {
        cx *= rMax / r;
        cz *= rMax / r;
      }

      camara.position.set(cx, cy, cz);
      camara.lookAt(mira);
    },
  };
}

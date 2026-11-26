/*
 * El escalador, hecho con piezas sencillas (nada descargado y nada de
 * Minecraft): cuerpo en cápsula, cabeza, casco con linterna, gafas y mochila
 * con cuerda. Mide 1,7 m y mira hacia +z.
 *
 * La animación es por código y la decide la POSTURA (quieto, corriendo,
 * subiendo, cayendo, doble salto), no las teclas: así servirá igual para el
 * jugador, los rivales de la red y los del ordenador.
 */
import * as THREE from 'three';
import type { Postura } from './control.ts';

export interface Personaje {
  raiz: THREE.Group;
  /** Coloca los pies en (x, y, z) mirando hacia `orientacion`. */
  colocar(x: number, y: number, z: number, orientacion: number): void;
  /** `progresoVoltereta` va de 0 a 1 durante el doble salto. */
  animar(postura: Postura, rapidez: number, progresoVoltereta: number, dt: number): void;
  /** Aplastamiento breve al tocar el suelo. */
  aterrizar(fuerza: number): void;
}

/** Altura del centro de giro del cuerpo (para la voltereta). */
const CENTRO = 0.85;

export function crearPersonaje(color = 0xe8553a): Personaje {
  const raiz = new THREE.Group();
  raiz.name = 'escalador';
  const cuerpo = new THREE.Group(); // se estira, se inclina y da la voltereta
  cuerpo.position.y = CENTRO;
  raiz.add(cuerpo);

  const mat = (c: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });
  const pieza = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const p = new THREE.Mesh(geo, m);
    p.position.set(x, y, z);
    p.castShadow = true;
    cuerpo.add(p);
    return p;
  };

  // Cuerpo (los pies quedan en y = 0).
  pieza(new THREE.CapsuleGeometry(0.3, 0.55, 6, 14), mat(color), 0, -0.25, 0);
  // Cabeza, casco amarillo y linterna encendida.
  pieza(new THREE.SphereGeometry(0.24, 18, 12), mat(0xf1c9a5), 0, 0.6, 0);
  pieza(new THREE.SphereGeometry(0.26, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf5c518, { roughness: 0.4 }), 0, 0.63, 0);
  const linterna = pieza(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 12), mat(0xfff2c0, { emissive: 0xffd27a, emissiveIntensity: 2 }), 0, 0.74, 0.22);
  linterna.rotation.x = Math.PI / 2;
  // Gafas.
  pieza(new THREE.BoxGeometry(0.32, 0.08, 0.06), mat(0x1d2430, { roughness: 0.2, metalness: 0.4 }), 0, 0.58, 0.21);
  // Mochila con la cuerda enrollada.
  pieza(new THREE.BoxGeometry(0.42, 0.5, 0.2), mat(0x5a3d2b), 0, -0.05, -0.3);
  const cuerda = pieza(new THREE.TorusGeometry(0.14, 0.045, 8, 18), mat(0x2f8f5b), 0, -0.02, -0.43);
  cuerda.rotation.y = Math.PI / 2;

  // Estado de la animación.
  let tiempo = 0;
  let aplastado = 0;
  let inclinacionActual = 0;
  const escala = new THREE.Vector3(1, 1, 1);
  const escalaObjetivo = new THREE.Vector3();

  return {
    raiz,
    colocar(x, y, z, orientacion) {
      raiz.position.set(x, y, z);
      raiz.rotation.y = orientacion;
    },
    animar(postura, rapidez, progresoVoltereta, dt) {
      tiempo += dt;
      aplastado = Math.max(aplastado - dt * 6, 0);
      const suave = 1 - Math.exp(-15 * dt);
      let alturaCentro = CENTRO;
      let inclinacion = 0;

      switch (postura) {
        case 'quieto':
          escalaObjetivo.set(1, 1 + Math.sin(tiempo * 2.5) * 0.02, 1); // respira
          break;
        case 'corriendo': {
          const f = Math.min(rapidez / 6, 1);
          escalaObjetivo.set(1, 1, 1);
          alturaCentro += Math.abs(Math.sin(tiempo * 12)) * 0.08 * f; // bota al correr
          inclinacion = 0.18 * f; // se inclina hacia delante
          break;
        }
        case 'subiendo':
          escalaObjetivo.set(0.92, 1.1, 0.92); // se estira
          break;
        case 'cayendo':
          escalaObjetivo.set(1.04, 0.96, 1.04);
          inclinacion = -0.1;
          break;
        case 'dobleSalto':
          escalaObjetivo.set(0.95, 1.05, 0.95);
          break;
      }

      // Aplastamiento al aterrizar (se suma a la postura).
      escalaObjetivo.y *= 1 - aplastado * 0.25;
      escalaObjetivo.x *= 1 + aplastado * 0.15;
      escalaObjetivo.z *= 1 + aplastado * 0.15;

      escala.lerp(escalaObjetivo, suave);
      cuerpo.scale.copy(escala);
      cuerpo.position.y += (alturaCentro - cuerpo.position.y) * suave;
      inclinacionActual += (inclinacion - inclinacionActual) * suave;
      // En el doble salto, voltereta completa hacia delante encima de la inclinación.
      cuerpo.rotation.x = inclinacionActual + (postura === 'dobleSalto' ? progresoVoltereta * Math.PI * 2 : 0);
    },
    aterrizar(fuerza) {
      aplastado = Math.min(Math.max(fuerza, 0.3), 1);
    },
  };
}

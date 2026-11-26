/*
 * El escalador: el «trabajador» de Kenney Mini Characters (CC0), con casco,
 * brazos, piernas y sus propias animaciones (ver docs/creditos.md).
 *
 * La animación la decide la POSTURA (quieto, corriendo, subiendo, cayendo,
 * doble salto), no las teclas: así servirá igual para el jugador, los
 * rivales de la red y los del ordenador. Por encima del modelo se añaden la
 * voltereta del doble salto y el aplastamiento al aterrizar.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

/** Altura del escalador (m). */
const ALTURA = 1.7;
/** Altura del centro de giro de la voltereta (m). */
const CENTRO = 0.85;
/** Por debajo de esta rapidez (m/s) anda en vez de correr. */
const RAPIDEZ_ANDAR = 3;
/** Duración del fundido entre animaciones (s). */
const FUNDIDO = 0.15;

/** Qué animación del modelo corresponde a cada postura. */
const ANIMACION: Record<Postura, string> = {
  quieto: 'idle',
  corriendo: 'sprint',
  subiendo: 'jump',
  cayendo: 'fall',
  dobleSalto: 'jump',
};

export async function cargarPersonaje(url = `${import.meta.env.BASE_URL}modelos/escalador.glb`): Promise<Personaje> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const modelo = gltf.scene;
  modelo.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      // Three.js lo descartaría por la caja de la postura de reposo y
      // desaparecería en los bordes (tropiezo de la sesión 3 del curso).
      o.frustumCulled = false;
    }
  });

  // Medir con el esqueleto aplicado (`true`) y escalar a 1,7 m con los pies en y = 0.
  modelo.updateMatrixWorld(true);
  const caja = new THREE.Box3().setFromObject(modelo, true);
  const escala = ALTURA / (caja.max.y - caja.min.y);
  modelo.scale.setScalar(escala);
  modelo.position.y = -caja.min.y * escala - CENTRO;

  const raiz = new THREE.Group();
  raiz.name = 'escalador';
  const cuerpo = new THREE.Group(); // gira en la voltereta y se aplasta al aterrizar
  cuerpo.position.y = CENTRO;
  cuerpo.add(modelo);
  raiz.add(cuerpo);

  // Animaciones: una acción por clip; se pasa de una a otra con un fundido.
  const mezclador = new THREE.AnimationMixer(modelo);
  const acciones = new Map<string, THREE.AnimationAction>();
  for (const clip of gltf.animations) acciones.set(clip.name, mezclador.clipAction(clip));
  for (const nombre of ['jump']) {
    // El salto se hace una vez y se queda en la última pose.
    const a = acciones.get(nombre);
    if (a) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
  }
  let actual: THREE.AnimationAction | undefined;
  let posturaAnterior: Postura | undefined;

  function cambiarA(nombre: string, reiniciar = false) {
    const nueva = acciones.get(nombre);
    if (!nueva || (nueva === actual && !reiniciar)) return;
    nueva.reset().play();
    if (actual && actual !== nueva) nueva.crossFadeFrom(actual, FUNDIDO, false);
    actual = nueva;
  }

  let aplastado = 0;

  return {
    raiz,
    colocar(x, y, z, orientacion) {
      raiz.position.set(x, y, z);
      raiz.rotation.y = orientacion;
    },
    animar(postura, rapidez, progresoVoltereta, dt) {
      let nombre = ANIMACION[postura];
      if (postura === 'corriendo' && rapidez < RAPIDEZ_ANDAR) nombre = 'walk';
      // El doble salto vuelve a empezar la animación de salto.
      cambiarA(nombre, postura === 'dobleSalto' && posturaAnterior !== 'dobleSalto');
      if (actual && (nombre === 'walk' || nombre === 'sprint')) {
        // Que los pies acompañen a la velocidad real.
        actual.timeScale = Math.max(rapidez / (nombre === 'walk' ? 2 : 6), 0.5);
      }
      posturaAnterior = postura;
      mezclador.update(dt);

      // Voltereta del doble salto y aplastamiento al aterrizar, encima de la animación.
      aplastado = Math.max(aplastado - dt * 6, 0);
      cuerpo.rotation.x = postura === 'dobleSalto' ? progresoVoltereta * Math.PI * 2 : 0;
      cuerpo.scale.set(1 + aplastado * 0.15, 1 - aplastado * 0.25, 1 + aplastado * 0.15);
    },
    aterrizar(fuerza) {
      aplastado = Math.min(Math.max(fuerza, 0.3), 1);
    },
  };
}

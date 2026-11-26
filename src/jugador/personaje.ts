/*
 * El escalador y la escaladora (idea I5), de Kenney Mini Characters (CC0),
 * con brazos, piernas y sus propias animaciones (ver docs/creditos.md):
 * - escalador: el «trabajador», con casco de obra;
 * - escaladora: `character-female-f`, la única con pelo largo, con la ropa
 *   cambiada a rosa (jugador/paleta.ts). Los dos tienen el mismo esqueleto
 *   y las mismas animaciones, así que todo lo demás sirve igual.
 *
 * La animación la decide la POSTURA (quieto, corriendo, subiendo, cayendo,
 * doble salto), no las teclas: así servirá igual para el jugador, los
 * rivales de la red y los del ordenador. Por encima del modelo se añaden la
 * voltereta del doble salto y el aplastamiento al aterrizar.
 *
 * Kenney no trae animación de colgarse ni de trepar (idea I3): se hacen con
 * sus propias animaciones (`fall`, `crouch`) y levantando los brazos a mano,
 * girando los huesos `arm-left` y `arm-right` después de la animación.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarConEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import type { Aspecto } from '../red/protocolo.ts';
import type { Postura } from './control.ts';
import { ROPA_ESCALADORA, recolocarEnPaleta, type CambioColor } from './paleta.ts';

export interface Personaje {
  raiz: THREE.Group;
  /** Coloca los pies en (x, y, z) mirando hacia `orientacion`. */
  colocar(x: number, y: number, z: number, orientacion: number): void;
  /** `progreso` va de 0 a 1 durante el doble salto y al trepar (ver `progresoPostura`). */
  animar(postura: Postura, rapidez: number, progreso: number, dt: number): void;
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
  colgado: 'fall',
  trepando: 'crouch',
};

/** Giro de los brazos para tenerlos estirados hacia arriba (rad). */
/**
 * Giro de cada brazo para tenerlo arriba, agarrado al borde. En el modelo, el
 * brazo en reposo apunta HACIA EL LADO (pose en T) y las animaciones lo bajan
 * girando en z. Se sube con 90° en z (en espejo: + el izquierdo, − el
 * derecho) y luego 0,45 rad en x para echarlo hacia delante. Medido: apunta
 * arriba (0,82) y hacia delante (0,57).
 */
function giroBrazoArriba(lado: 1 | -1): THREE.Quaternion {
  const enZ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (lado * Math.PI) / 2));
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0.45, 0, 0)).multiply(enZ);
}

/** El archivo de cada aspecto y los cambios de color de su ropa. */
const MODELOS: Record<Aspecto, { archivo: string; ropa: readonly CambioColor[] }> = {
  escalador: { archivo: 'escalador.glb', ropa: [] },
  escaladora: { archivo: 'escaladora.glb', ropa: ROPA_ESCALADORA },
};

const modelosCargados = new Map<Aspecto, Promise<GLTF>>();

/**
 * Cambia el color de la ropa apuntando sus vértices a otras casillas de la
 * paleta (ver jugador/paleta.ts). Se hace una vez sobre el modelo cargado:
 * todos los clones comparten la geometría y salen ya con la ropa cambiada.
 */
function cambiarRopa(gltf: GLTF, cambios: readonly CambioColor[]) {
  if (cambios.length === 0) return;
  gltf.scene.traverse((o) => {
    const malla = o as THREE.SkinnedMesh;
    if (!malla.isSkinnedMesh) return;
    const g = malla.geometry;
    const uv = g.attributes.uv!;
    const indices = g.attributes.skinIndex!;
    const pesos = g.attributes.skinWeight!;
    for (let i = 0; i < uv.count; i++) {
      // El hueso que más mueve este vértice.
      let mejor = 0;
      for (let k = 1; k < 4; k++) if (pesos.getComponent(i, k) > pesos.getComponent(i, mejor)) mejor = k;
      const hueso = malla.skeleton.bones[indices.getComponent(i, mejor)]?.name ?? '';
      const [u, v] = recolocarEnPaleta(uv.getX(i), uv.getY(i), hueso, cambios);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  });
}

/** Descarga cada modelo UNA vez; todos los que lo usan (tú y los rivales) lo comparten. */
export function cargarModelo(aspecto: Aspecto): Promise<GLTF> {
  let promesa = modelosCargados.get(aspecto);
  if (!promesa) {
    const { archivo, ropa } = MODELOS[aspecto];
    promesa = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}modelos/${archivo}`).then((gltf) => {
      cambiarRopa(gltf, ropa);
      return gltf;
    });
    modelosCargados.set(aspecto, promesa);
  }
  return promesa;
}

/** Los dos modelos, para poder dibujar a cualquier rival de la sala. */
export async function cargarModelos(): Promise<Record<Aspecto, GLTF>> {
  const [escalador, escaladora] = await Promise.all([cargarModelo('escalador'), cargarModelo('escaladora')]);
  return { escalador, escaladora };
}

/**
 * Un escalador nuevo a partir del modelo ya descargado. Se clona con
 * `SkeletonUtils.clone`: con `clone()` normal todos los clones compartirían
 * los huesos y se moverían a la vez (tropiezo de la sesión 3 del curso).
 */
export function crearPersonaje(gltf: GLTF): Personaje {
  const modelo = clonarConEsqueleto(gltf.scene);
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
  const brazos = (
    [
      ['arm-left', giroBrazoArriba(1)],
      ['arm-right', giroBrazoArriba(-1)],
    ] as const
  ).flatMap(([nombre, arriba]) => {
    const hueso = modelo.getObjectByName(nombre);
    return hueso ? [{ hueso, arriba }] : [];
  });

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
    animar(postura, rapidez, progreso, dt) {
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

      // Colgado y trepando: brazos arriba, agarrados al borde. Al trepar se
      // bajan mientras el cuerpo sube (60 % del tiempo) y se inclina hacia
      // delante al pasar encima del saliente.
      const arriba = postura === 'colgado' ? 1 : postura === 'trepando' ? Math.max(1 - progreso / 0.6, 0) : 0;
      // Se funde la pose de la animación con «brazos arriba».
      if (arriba > 0) for (const b of brazos) b.hueso.quaternion.slerp(b.arriba, arriba);
      const inclinado = postura === 'trepando' ? Math.sin(Math.PI * Math.min(Math.max((progreso - 0.4) / 0.6, 0), 1)) * 0.5 : 0;

      // Voltereta del doble salto y aplastamiento al aterrizar, encima de la animación.
      aplastado = Math.max(aplastado - dt * 6, 0);
      cuerpo.rotation.x = postura === 'dobleSalto' ? progreso * Math.PI * 2 : inclinado;
      cuerpo.scale.set(1 + aplastado * 0.15, 1 - aplastado * 0.25, 1 + aplastado * 0.15);
    },
    aterrizar(fuerza) {
      aplastado = Math.min(Math.max(fuerza, 0.3), 1);
    },
  };
}

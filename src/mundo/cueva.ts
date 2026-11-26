/*
 * El escenario del primer tramo: LA CUEVA.
 *
 * - Paredes: un cilindro grande visto por dentro (BackSide).
 * - Niebla del color del fondo: lo lejano se funde con la oscuridad, da
 *   profundidad y además oculta dónde acaba la cueva.
 * - Cristales que brillan (material emisivo) en las paredes: dan color y
 *   pistas de altura SIN coste de luces; son una malla instanciada (1 llamada).
 */
import * as THREE from 'three';
import { crearAzar, entre } from '../reglas/azar.ts';
import { METROS_POR_TRAMO } from '../reglas/torre.ts';
import { materialRoca, type TexturaRoca } from './texturas.ts';

export const RADIO_CUEVA = 22;
export const COLOR_CUEVA = 0x101724;
const CRISTALES = 140;

export function crearCueva(escena: THREE.Scene, roca: TexturaRoca): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'cueva';

  escena.background = new THREE.Color(COLOR_CUEVA);
  escena.fog = new THREE.FogExp2(COLOR_CUEVA, 0.028);

  const alto = METROS_POR_TRAMO + 20;
  const vueltas = Math.round((2 * Math.PI * RADIO_CUEVA) / 8);
  const paredes = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIO_CUEVA, RADIO_CUEVA, alto, 64, 1, true),
    materialRoca(roca, vueltas, alto / 8, { side: THREE.BackSide, color: 0x8a8070 }),
  );
  paredes.position.y = alto / 2 - 10;
  paredes.receiveShadow = true;
  grupo.add(paredes);

  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(RADIO_CUEVA, 64),
    materialRoca(roca, 10, 10, { color: 0x9a8f80 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  grupo.add(suelo);

  // Cristales: siempre los mismos (semilla fija), repartidos por las paredes.
  const azar = crearAzar(2026);
  const cristales = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      // Emisivo moderado: con más intensidad el mapeo de tonos (ACES) lo
      // desatura y el cristal sale blanco en vez de azul.
      color: 0x1a6f8f,
      emissive: 0x0aa6e6,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.1,
    }),
    CRISTALES,
  );
  const matriz = new THREE.Matrix4();
  const posicion = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const escala = new THREE.Vector3();
  for (let i = 0; i < CRISTALES; i++) {
    const angulo = azar() * Math.PI * 2;
    const radio = RADIO_CUEVA - entre(azar, 0.2, 0.8);
    posicion.set(Math.cos(angulo) * radio, entre(azar, 0.5, METROS_POR_TRAMO), Math.sin(angulo) * radio);
    giro.setFromEuler(euler.set(azar() * Math.PI, azar() * Math.PI, azar() * Math.PI));
    const t = entre(azar, 0.25, 0.8);
    escala.set(t, t * entre(azar, 1.5, 3), t);
    cristales.setMatrixAt(i, matriz.compose(posicion, giro, escala));
  }
  cristales.instanceMatrix.needsUpdate = true;
  cristales.computeBoundingSphere();
  grupo.add(cristales);

  return grupo;
}

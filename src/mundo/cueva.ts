/*
 * El escenario del primer tramo: LA CUEVA.
 *
 * - Paredes: un cilindro visto por dentro (BackSide). Es la pared que se
 *   escala (idea I2): los salientes de mundo/torre.ts salen de ella.
 * - Niebla del color del fondo: lo lejano se funde con la oscuridad, da
 *   profundidad y además oculta dónde acaba la cueva.
 * - Cristales que brillan (material emisivo) en las paredes: dan color y
 *   pistas de altura SIN coste de luces; son una malla instanciada (1 llamada).
 *   No salen encima ni debajo de un saliente: allí parecerían algo que coger.
 */
import * as THREE from 'three';
import { crearAzar, entre } from '../reglas/azar.ts';
import { GROSOR_SALIENTE, METROS_POR_TRAMO, RADIO_PARED, sobreSaliente, type Tramo } from '../reglas/torre.ts';
import { materialRoca, type TexturaRoca } from './texturas.ts';

export const RADIO_CUEVA = RADIO_PARED;
export const COLOR_CUEVA = 0x101724;
const CRISTALES = 140;

export function crearCueva(escena: THREE.Scene, roca: TexturaRoca, tramo: Tramo): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'cueva';

  escena.background = new THREE.Color(COLOR_CUEVA);
  escena.fog = new THREE.FogExp2(COLOR_CUEVA, 0.028);

  const alto = METROS_POR_TRAMO + 20;
  // La textura se repite cada 4 m: la pared se ve de cerca al escalar.
  const vueltas = Math.round((2 * Math.PI * RADIO_CUEVA) / 4);
  const paredes = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIO_CUEVA, RADIO_CUEVA, alto, 64, 1, true),
    materialRoca(roca, vueltas, alto / 4, { side: THREE.BackSide, color: 0x8a8070 }),
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
  let puestos = 0;
  for (let intento = 0; puestos < CRISTALES && intento < CRISTALES * 10; intento++) {
    const angulo = azar() * Math.PI * 2;
    const radio = RADIO_CUEVA - entre(azar, 0.2, 0.8);
    posicion.set(Math.cos(angulo) * radio, entre(azar, 0.5, METROS_POR_TRAMO), Math.sin(angulo) * radio);
    const estorba = tramo.salientes.some(
      (s) => posicion.y > s.y - GROSOR_SALIENTE - 1 && posicion.y < s.y + 2.2 && sobreSaliente(s, posicion.x, posicion.z, 0.5),
    );
    if (estorba) continue;
    giro.setFromEuler(euler.set(azar() * Math.PI, azar() * Math.PI, azar() * Math.PI));
    const t = entre(azar, 0.25, 0.8);
    escala.set(t, t * entre(azar, 1.5, 3), t);
    cristales.setMatrixAt(puestos++, matriz.compose(posicion, giro, escala));
  }
  cristales.count = puestos;
  cristales.instanceMatrix.needsUpdate = true;
  cristales.computeBoundingSphere();
  grupo.add(cristales);

  return grupo;
}

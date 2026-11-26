/*
 * Dibuja un tramo de la torre a partir de lo que calcula `reglas/torre.ts`.
 *
 * Los ~90 salientes de un tramo son UNA sola malla instanciada: la GPU recibe
 * la caja una vez y una lista de posiciones, y la dibuja en una sola llamada.
 * Con 90 mallas sueltas serían 90 llamadas (el presupuesto es < 200 en total).
 */
import * as THREE from 'three';
import {
  FONDO_SALIENTE,
  GROSOR_SALIENTE,
  METROS_POR_TRAMO,
  RADIO_COLUMNA,
  RADIO_SALIENTES,
  type Tramo,
} from '../reglas/torre.ts';
import { materialRoca, type TexturaRoca } from './texturas.ts';

/** Cada cuántos metros se repite la textura de roca. */
const METROS_POR_TEXTURA = 4;

/**
 * @param roca textura de la columna
 * @param piedra textura de salientes y rellano: MÁS CLARA que la columna,
 *   porque lo que se pisa tiene que distinguirse de un vistazo
 */
export function crearTorre(tramo: Tramo, roca: TexturaRoca, piedra: TexturaRoca): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = `tramo-${tramo.indice}`;

  // La columna central: un cilindro de 220 m.
  const vueltas = Math.round((2 * Math.PI * RADIO_COLUMNA) / METROS_POR_TEXTURA);
  const columna = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIO_COLUMNA, RADIO_COLUMNA, METROS_POR_TRAMO, 48, 1, true),
    materialRoca(roca, vueltas, METROS_POR_TRAMO / METROS_POR_TEXTURA),
  );
  columna.position.y = tramo.base + METROS_POR_TRAMO / 2;
  columna.castShadow = columna.receiveShadow = true;
  grupo.add(columna);

  // Los salientes: una caja de 1×1×1 que cada instancia escala y gira.
  const salientes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    materialRoca(piedra, 0.6, 0.6),
    tramo.salientes.length,
  );
  salientes.castShadow = salientes.receiveShadow = true;

  const matriz = new THREE.Matrix4();
  const posicion = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const ejeY = new THREE.Vector3(0, 1, 0);

  tramo.salientes.forEach((s, i) => {
    // Un poco metido en la columna para que no se vea una rendija.
    const radio = RADIO_SALIENTES - 0.1;
    posicion.set(Math.cos(s.angulo) * radio, s.y - GROSOR_SALIENTE / 2, Math.sin(s.angulo) * radio);
    // Girar la caja para que su eje z apunte hacia fuera de la columna.
    giro.setFromAxisAngle(ejeY, Math.PI / 2 - s.angulo);
    escala.set(s.ancho, GROSOR_SALIENTE, FONDO_SALIENTE + 0.2);
    salientes.setMatrixAt(i, matriz.compose(posicion, giro, escala));
  });
  salientes.instanceMatrix.needsUpdate = true;
  salientes.computeBoundingSphere();
  grupo.add(salientes);

  // El rellano de arriba: un anillo completo, se llega desde cualquier lado.
  const rellano = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIO_COLUMNA + FONDO_SALIENTE, RADIO_COLUMNA + FONDO_SALIENTE, GROSOR_SALIENTE, 48),
    materialRoca(piedra, 3, 0.3),
  );
  rellano.position.y = tramo.rellano - GROSOR_SALIENTE / 2;
  rellano.castShadow = rellano.receiveShadow = true;
  grupo.add(rellano);

  return grupo;
}

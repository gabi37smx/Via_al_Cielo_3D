/*
 * Dibuja un tramo de la torre a partir de lo que calcula `reglas/torre.ts`.
 * La pared que se escala la pone el escenario (mundo/cueva.ts); aquí van los
 * salientes y el rellano, que salen de esa pared hacia dentro.
 *
 * Los ~90 salientes de un tramo son UNA sola malla instanciada: la GPU recibe
 * la caja una vez y una lista de posiciones, y la dibuja en una sola llamada.
 * Con 90 mallas sueltas serían 90 llamadas (el presupuesto es < 200 en total).
 */
import * as THREE from 'three';
import {
  FONDO_CAJA,
  GROSOR_SALIENTE,
  RADIO_CENTRO_CAJA,
  RADIO_PARED,
  RADIO_RELLANO,
  type Tramo,
} from '../reglas/torre.ts';
import { materialRoca, type TexturaRoca } from './texturas.ts';

/**
 * @param piedra textura de salientes y rellano: MÁS CLARA que la pared,
 *   porque lo que se pisa tiene que distinguirse de un vistazo
 */
export function crearTorre(tramo: Tramo, piedra: TexturaRoca): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = `tramo-${tramo.indice}`;

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
    // Las medidas de la caja salen de reglas/torre.ts: lo que se ve = lo que se pisa.
    const radio = RADIO_CENTRO_CAJA;
    posicion.set(Math.cos(s.angulo) * radio, s.y - GROSOR_SALIENTE / 2, Math.sin(s.angulo) * radio);
    // Girar la caja para que su eje z vaya a lo largo del radio (hacia la pared).
    giro.setFromAxisAngle(ejeY, Math.PI / 2 - s.angulo);
    escala.set(s.ancho, GROSOR_SALIENTE, FONDO_CAJA);
    salientes.setMatrixAt(i, matriz.compose(posicion, giro, escala));
  });
  salientes.instanceMatrix.needsUpdate = true;
  salientes.computeBoundingSphere();
  grupo.add(salientes);

  // El rellano de arriba: una cornisa que da la vuelta entera a la pared
  // (un círculo con un agujero, con grosor). Se llega desde cualquier lado.
  const forma = new THREE.Shape().absarc(0, 0, RADIO_PARED + 0.2, 0, Math.PI * 2);
  forma.holes.push(new THREE.Path().absarc(0, 0, RADIO_RELLANO, 0, Math.PI * 2, true));
  const geometria = new THREE.ExtrudeGeometry(forma, { depth: GROSOR_SALIENTE, bevelEnabled: false, curveSegments: 48 });
  geometria.rotateX(-Math.PI / 2); // de vertical a tumbada; la cara de arriba queda en y = GROSOR
  // Las coordenadas de textura de ExtrudeGeometry van en metros: 0,3 = cada 3,3 m.
  const rellano = new THREE.Mesh(geometria, materialRoca(piedra, 0.3, 0.3));
  rellano.position.y = tramo.rellano - GROSOR_SALIENTE;
  rellano.castShadow = rellano.receiveShadow = true;
  grupo.add(rellano);

  return grupo;
}

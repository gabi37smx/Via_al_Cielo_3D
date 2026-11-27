/*
 * Dibuja un tramo de la torre a partir de lo que calcula `reglas/torre.ts`.
 * La pared que se escala la pone el escenario (mundo/cueva.ts); aquí van los
 * salientes y el rellano, que salen de esa pared hacia dentro.
 *
 * Los salientes son ROCAS IRREGULARES (idea I7): una caja deformada con
 * ruido. La cara de arriba se queda plana y del tamaño exacto de lo que se
 * pisa (lo que se ve = lo que se pisa); los lados se meten hacia dentro al
 * bajar y la parte de abajo acaba en cuña, como una laja de roca.
 *
 * Hay 3 formas de roca y cada saliente usa una (según su número). Cada forma
 * es UNA malla instanciada: la GPU recibe la roca una vez y una lista de
 * posiciones. 3 llamadas para los ~90 salientes (el presupuesto es < 200).
 */
import * as THREE from 'three';
import { crearAzar, entre } from '../reglas/azar.ts';
import {
  GROSOR_RELLANO,
  RADIO_PARED,
  RADIO_RELLANO,
  fondoCaja,
  radioCentroCaja,
  type Tramo,
} from '../reglas/torre.ts';
import { materialRoca, type TexturaRoca } from './texturas.ts';

const FORMAS = 3;

/**
 * Una roca de 1×1×1 con la cara de arriba en y = 0 (plana, sin tocar) y el
 * resto hacia abajo, deformado.
 */
export function crearForma(semilla: number): THREE.BufferGeometry {
  const geometria = new THREE.BoxGeometry(1, 1, 1, 4, 3, 4);
  geometria.translate(0, -0.5, 0); // arriba en y = 0, abajo en y = −1
  const azar = crearAzar(semilla);
  const posicion = geometria.attributes.position!;
  // BoxGeometry repite los vértices de las aristas (uno por cara): se deforma
  // cada punto según su posición para que las caras sigan cosidas.
  const cache = new Map<string, [number, number, number]>();
  const v = new THREE.Vector3();
  for (let i = 0; i < posicion.count; i++) {
    v.fromBufferAttribute(posicion, i);
    const clave = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let d = cache.get(clave);
    if (!d) {
      const bajada = -v.y; // 0 arriba, 1 abajo
      if (bajada < 1e-6) {
        d = [0, 0, 0]; // la cara de arriba no se toca
      } else {
        // Hacia abajo se estrecha (cuña) y cada punto se mueve un poco al azar.
        const cuna = 1 - 0.45 * bajada;
        const ruido = 0.12 * Math.min(bajada * 3, 1);
        d = [
          v.x * cuna - v.x + entre(azar, -ruido, ruido),
          entre(azar, -ruido, ruido) * (bajada === 1 ? 2 : 1),
          v.z * cuna - v.z + entre(azar, -ruido, ruido),
        ];
        // La cara pegada a la pared (z = +0,5) no se estrecha: va metida en la roca.
        if (v.z > 0.49) d[2] = 0;
      }
      cache.set(clave, d);
    }
    posicion.setXYZ(i, v.x + d[0], v.y + d[1], v.z + d[2]);
  }
  geometria.computeVertexNormals();
  return geometria;
}

/**
 * @param piedra textura de salientes y rellano: MÁS CLARA que la pared,
 *   porque lo que se pisa tiene que distinguirse de un vistazo
 */
export function crearTorre(tramo: Tramo, piedra: TexturaRoca): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = `tramo-${tramo.indice}`;

  const material = materialRoca(piedra, 0.6, 0.6);
  const porForma = Array.from({ length: FORMAS }, () => [] as number[]);
  tramo.salientes.forEach((_, i) => porForma[i % FORMAS]!.push(i));

  const matriz = new THREE.Matrix4();
  const posicion = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const ejeY = new THREE.Vector3(0, 1, 0);

  porForma.forEach((indices, forma) => {
    const rocas = new THREE.InstancedMesh(crearForma(7 + forma * 101), material, indices.length);
    rocas.castShadow = rocas.receiveShadow = true;
    indices.forEach((n, i) => {
      const s = tramo.salientes[n]!;
      // Las medidas de la caja salen de reglas/torre.ts: lo que se ve = lo que se pisa.
      const radio = radioCentroCaja(s);
      posicion.set(Math.cos(s.angulo) * radio, s.y, Math.sin(s.angulo) * radio);
      // Girar la roca para que su eje +z apunte hacia la pared.
      giro.setFromAxisAngle(ejeY, Math.PI / 2 - s.angulo);
      escala.set(s.ancho, s.grosor, fondoCaja(s));
      rocas.setMatrixAt(i, matriz.compose(posicion, giro, escala));
    });
    rocas.instanceMatrix.needsUpdate = true;
    rocas.computeBoundingSphere();
    grupo.add(rocas);
  });

  // El rellano de arriba: una cornisa que da la vuelta entera a la pared
  // (un círculo con un agujero, con grosor). Se llega desde cualquier lado.
  const forma = new THREE.Shape().absarc(0, 0, RADIO_PARED + 0.2, 0, Math.PI * 2);
  forma.holes.push(new THREE.Path().absarc(0, 0, RADIO_RELLANO, 0, Math.PI * 2, true));
  const geometria = new THREE.ExtrudeGeometry(forma, { depth: GROSOR_RELLANO, bevelEnabled: false, curveSegments: 48 });
  geometria.rotateX(-Math.PI / 2); // de vertical a tumbada; la cara de arriba queda en y = GROSOR
  // Las coordenadas de textura de ExtrudeGeometry van en metros: 0,3 = cada 3,3 m.
  const rellano = new THREE.Mesh(geometria, materialRoca(piedra, 0.3, 0.3));
  rellano.position.y = tramo.rellano - GROSOR_RELLANO;
  rellano.castShadow = rellano.receiveShadow = true;
  grupo.add(rellano);

  return grupo;
}

/*
 * El escenario del primer tramo: LA CUEVA (oscura).
 *
 * - Paredes: un cilindro visto por dentro (BackSide). Es la pared que se
 *   escala (idea I2): los salientes de mundo/torre.ts salen de ella. Acaba
 *   justo debajo del rellano de los 220 m, donde empieza la grieta.
 * - La niebla y el color del fondo los pone mundo/escena.ts (`ambientar`),
 *   que los cambia poco a poco al pasar de la cueva a la grieta.
 * - Cristales que brillan (material emisivo) en las paredes: dan color y
 *   pistas de altura SIN coste de luces; son una malla instanciada (1 llamada).
 *   No salen encima ni debajo de un saliente: allí parecerían algo que coger.
 */
import * as THREE from 'three';
import { crearAzar, entre } from '../reglas/azar.ts';
import { GROSOR_RELLANO, RADIO_PARED, sobreSaliente, type Tramo } from '../reglas/torre.ts';
import { materialRoca, type TexturaRoca } from './texturas.ts';

export const RADIO_CUEVA = RADIO_PARED;
const CRISTALES = 140;

/** Un hueco en la pared (el pasillo de la ladera): alrededor de `angulo`, de `ancho` m, entre dos alturas. */
export interface HuecoPared {
  angulo: number;
  ancho: number;
  desde: number;
  hasta: number;
}

/**
 * Pared de un tramo: un cilindro visto por dentro desde `desde` hasta `hasta`
 * (m). Entre dos tramos la junta queda escondida debajo del rellano.
 * `aclararEn` (m): la pared empieza oscura (como la del tramo de abajo) y se
 * aclara en esos metros; así no se ve una raya donde cambia de escenario.
 * `hueco`: se parte en tres trozos (debajo, a la altura del hueco y encima) y
 * la textura se cuadra entre ellos para que no se noten las juntas.
 */
export function crearPared(
  roca: TexturaRoca,
  desde: number,
  hasta: number,
  color: THREE.ColorRepresentation,
  aclararEn = 0,
  hueco?: HuecoPared,
): THREE.Object3D {
  // La textura se repite cada 4 m: la pared se ve de cerca al escalar.
  const vueltas = Math.round((2 * Math.PI * RADIO_CUEVA) / 4);
  const trozo = (abajo: number, arriba: number, inicio = 0, largo = Math.PI * 2) => {
    const alto = arriba - abajo;
    const geometria = new THREE.CylinderGeometry(RADIO_CUEVA, RADIO_CUEVA, alto, Math.max(Math.round((64 * largo) / (Math.PI * 2)), 4), aclararEn > 0 ? Math.max(Math.ceil(alto), 1) : 1, true, inicio, largo);
    if (aclararEn > 0) {
      // Color por vértice: 0,3 abajo → 1 a `aclararEn` m (multiplica al de la textura).
      const pos = geometria.attributes.position!;
      const colores = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const t = Math.min((pos.getY(i) + alto / 2 + abajo - desde) / aclararEn, 1);
        colores.fill(0.3 + 0.7 * t * t * (3 - 2 * t), i * 3, i * 3 + 3);
      }
      geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    }
    const material = materialRoca(roca, (vueltas * largo) / (Math.PI * 2), alto / 4, { side: THREE.BackSide, color, vertexColors: aclararEn > 0 });
    // Cuadrar la textura con la de los otros trozos (misma escala, desplazada).
    for (const t of [material.map, material.normalMap, material.roughnessMap]) t?.offset.set((vueltas * inicio) / (Math.PI * 2), (abajo - desde) / 4);
    const malla = new THREE.Mesh(geometria, material);
    malla.position.y = abajo + alto / 2;
    malla.receiveShadow = true;
    return malla;
  };
  if (!hueco) return trozo(desde, hasta);
  const grupo = new THREE.Group();
  const anchoAngulo = hueco.ancho / RADIO_CUEVA;
  // En CylinderGeometry el ángulo θ va al revés y empieza en otro sitio: θ = π/2 − ángulo.
  const centro = Math.PI / 2 - hueco.angulo;
  grupo.add(
    trozo(desde, hueco.desde),
    trozo(hueco.desde, hueco.hasta, centro + anchoAngulo / 2, Math.PI * 2 - anchoAngulo),
    trozo(hueco.hasta, hasta),
  );
  return grupo;
}

export interface OpcionesCristales {
  cantidad: number;
  color: THREE.ColorRepresentation;
  emisivo: THREE.ColorRepresentation;
  intensidad: number;
  semilla: number;
}

/** Cristales que brillan en la pared de un tramo, sin tapar ningún saliente. */
export function crearCristales(tramo: Tramo, o: OpcionesCristales): THREE.InstancedMesh {
  const azar = crearAzar(o.semilla);
  const cristales = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      // Emisivo moderado: con más intensidad el mapeo de tonos (ACES) lo
      // desatura y el cristal sale blanco en vez de su color.
      color: o.color,
      emissive: o.emisivo,
      emissiveIntensity: o.intensidad,
      roughness: 0.2,
      metalness: 0.1,
    }),
    o.cantidad,
  );
  const matriz = new THREE.Matrix4();
  const posicion = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const escala = new THREE.Vector3();
  let puestos = 0;
  for (let intento = 0; puestos < o.cantidad && intento < o.cantidad * 10; intento++) {
    const angulo = azar() * Math.PI * 2;
    const radio = RADIO_CUEVA - entre(azar, 0.2, 0.8);
    posicion.set(Math.cos(angulo) * radio, entre(azar, tramo.base + 0.5, tramo.rellano - 1), Math.sin(angulo) * radio);
    const estorba = tramo.salientes.some(
      (s) => posicion.y > s.y - s.grosor - 1 && posicion.y < s.y + 2.2 && sobreSaliente(s, posicion.x, posicion.z, 0.5),
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
  return cristales;
}

export function crearCueva(roca: TexturaRoca, tramo: Tramo): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'cueva';

  // De 10 m bajo el suelo hasta justo debajo del rellano de los 220 m.
  grupo.add(crearPared(roca, -10, tramo.rellano - GROSOR_RELLANO, 0x8a8070));

  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(RADIO_CUEVA, 64),
    materialRoca(roca, 10, 10, { color: 0x9a8f80 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  grupo.add(suelo);

  // Cristales azules: siempre los mismos (semilla fija), repartidos por las paredes.
  grupo.add(crearCristales(tramo, { cantidad: CRISTALES, color: 0x1a6f8f, emisivo: 0x0aa6e6, intensidad: 1.1, semilla: 2026 }));

  return grupo;
}

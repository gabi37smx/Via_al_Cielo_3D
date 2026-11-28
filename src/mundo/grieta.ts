/*
 * El escenario del segundo tramo (220-440 m): LA GRIETA, la cueva clara
 * (decisión 038). Como en el Vía al Cielo 2D: roca marrón cálida, musgo,
 * cristales y luz que entra por las rendijas de la roca.
 *
 * - Pared más clara que la de la cueva, de la misma forma (crearPared).
 * - Grietas de luz: rendijas verticales en zigzag que brillan (material sin
 *   luz, MeshBasic) y, saliendo de ellas, RAYOS de luz: conos transparentes
 *   que suman color (mezcla aditiva) y se desvanecen al alejarse. Todos los
 *   rayos van en UNA malla (1 llamada de dibujo) y no usan luces de verdad.
 * - Musgo verde junto a las grietas, donde llega la luz y el agua.
 * - Cristales ámbar (en la cueva eran azules).
 * - Arriba del todo, el cielo: la salida al aire libre (el tramo 3).
 * - Estalactitas colgando debajo de los rellanos (techo de cada tramo).
 *
 * Todo con semilla fija: no depende de la torre, salvo para no tapar
 * salientes. Lo que se pisa sigue saliendo solo de reglas/torre.ts.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearAzar, entre, type Azar } from '../reglas/azar.ts';
import { GROSOR_RELLANO, RADIO_PARED, RADIO_RELLANO, sobreSaliente, type Tramo } from '../reglas/torre.ts';
import { crearCristales, crearPared, type HuecoPared } from './cueva.ts';
import type { TexturaRoca } from './texturas.ts';

/** Cuántas grietas de luz hay y cada cuántos metros sale un rayo de una grieta. */
const GRIETAS = 3;
const METROS_ENTRE_RAYOS = 24;
const MUSGO = 160;
const ESTALACTITAS = 70;
const COLOR_LUZ = 0xfff0cf;

/** ¿Hay un saliente en (x, y, z) o justo encima o debajo? (para no taparlo) */
function tapaSaliente(tramo: Tramo, p: THREE.Vector3, margen = 0.5): boolean {
  return tramo.salientes.some((s) => p.y > s.y - s.grosor - 1 && p.y < s.y + 2.2 && sobreSaliente(s, p.x, p.z, margen));
}

/** Ángulos de las grietas: repartidas alrededor, con algo de azar. */
function angulosGrietas(azar: Azar): number[] {
  const inicio = azar() * Math.PI * 2;
  return Array.from({ length: GRIETAS }, (_, i) => inicio + (i * Math.PI * 2) / GRIETAS + entre(azar, -0.4, 0.4));
}

/* ---------- Grietas de luz ---------- */

/** Cómo va una grieta: a qué ángulo y con qué ancho a cada altura. */
interface Recorrido {
  angulo: number;
  y: number;
  ancho: number;
}

/** Recorrido de una grieta de `desde` a `hasta` (m): se tuerce suave, sin esquinas. */
function recorridoGrieta(azar: Azar, angulo: number, desde: number, hasta: number): Recorrido[] {
  // Suma de ondas con fase al azar: se tuerce como una raja de verdad.
  const ondas = [0.9, 2.3, 5.1].map((f) => ({ f, fase: azar() * Math.PI * 2, fuerza: entre(azar, 0.5, 1) / f }));
  const puntos = Math.ceil(hasta - desde); // un punto por metro
  return Array.from({ length: puntos + 1 }, (_, k) => {
    const y = desde + ((hasta - desde) * k) / puntos;
    const giro = ondas.reduce((a, o) => a + Math.sin((y / 10) * o.f + o.fase) * o.fuerza, 0) * 0.05;
    // Más ancha por el medio, se cierra en los extremos y respira a lo largo.
    const forma = Math.sin((Math.PI * k) / puntos);
    const ancho = (0.06 + 0.22 * forma) * (0.6 + 0.4 * Math.sin(y * 0.7 + ondas[0]!.fase));
    return { angulo: angulo + giro, y, ancho };
  });
}

/**
 * Tira pegada a la pared a lo largo de un recorrido, `veces` más ancha que la
 * grieta. Lleva coordenadas de textura a lo ancho (u de 0 a 1) para el halo.
 */
function tiraGrieta(recorrido: Recorrido[], veces: number, separacion: number): THREE.BufferGeometry {
  const radio = RADIO_PARED - separacion;
  const posiciones: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  recorrido.forEach((p, k) => {
    const ancho = (p.ancho * veces) / radio; // en radianes
    for (const lado of [-1, 1]) {
      const al = p.angulo + (lado * ancho) / 2;
      posiciones.push(Math.cos(al) * radio, p.y, Math.sin(al) * radio);
      uvs.push(lado < 0 ? 0 : 1, k / (recorrido.length - 1));
    }
    if (k > 0) {
      const i = k * 2;
      indices.push(i - 2, i - 1, i, i - 1, i + 1, i);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

/** Degradado de lado a lado (transparente, opaco en el medio, transparente): el halo. */
function texturaHalo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#000');
  g.addColorStop(0.5, '#fff');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 4);
  return new THREE.CanvasTexture(c);
}

/**
 * Material de los rayos: un shader pequeño. Un cono pintado tal cual se ve
 * como un tubo de bordes duros; aquí cada punto brilla más cuanto más de
 * frente se mira (en los bordes del cono se mira de lado y desaparece) y se
 * apaga al alejarse de la grieta. Suma su color (mezcla aditiva) y no escribe
 * profundidad: no tapa nada de lo que hay detrás.
 */
function materialRayo(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(COLOR_LUZ) }, fuerza: { value: 0.32 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vVista;
      void main() {
        vUv = uv;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vVista = -p.xyz;
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float fuerza;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vVista;
      void main() {
        float deFrente = abs(dot(normalize(vNormal), normalize(vVista)));
        // v = 1 en la punta (junto a la grieta) y 0 al final del rayo.
        float largo = smoothstep(0.0, 0.7, vUv.y);
        float a = fuerza * pow(deFrente, 2.0) * largo;
        gl_FragColor = vec4(color * a, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Conos de luz que salen de las grietas hacia el centro del pozo, hacia abajo. */
function crearRayos(azar: Azar, angulos: number[], desde: number, hasta: number): THREE.Mesh {
  const piezas: THREE.BufferGeometry[] = [];
  const arriba = new THREE.Vector3(0, 1, 0);
  const giro = new THREE.Quaternion();
  for (const angulo of angulos) {
    for (let y = desde + entre(azar, 6, 14); y < hasta - 4; y += METROS_ENTRE_RAYOS * entre(azar, 0.7, 1.3)) {
      const largo = entre(azar, 13, 20);
      const cono = new THREE.CylinderGeometry(0.25, entre(azar, 1.6, 3), largo, 16, 1, true);
      // Hacia dentro del pozo, un poco de lado y bajando (la luz viene de arriba).
      const a = angulo + entre(azar, -0.25, 0.25);
      const dir = new THREE.Vector3(-Math.cos(a), -entre(azar, 0.55, 0.95), -Math.sin(a)).normalize();
      // La punta (arriba del cilindro) en la grieta; el resto, hacia `dir`.
      giro.setFromUnitVectors(arriba, dir.clone().negate());
      cono.applyQuaternion(giro);
      const origen = new THREE.Vector3(Math.cos(angulo) * (RADIO_PARED - 0.1), y, Math.sin(angulo) * (RADIO_PARED - 0.1));
      const centro = origen.addScaledVector(dir, largo / 2);
      cono.translate(centro.x, centro.y, centro.z);
      piezas.push(cono);
    }
  }
  const rayos = new THREE.Mesh(mergeGeometries(piezas), materialRayo());
  rayos.name = 'rayos-de-luz';
  rayos.renderOrder = 1; // después de lo opaco
  for (const p of piezas) p.dispose();
  return rayos;
}

/* ---------- Musgo ---------- */

/** Mancha de musgo pintada en canvas: muchas bolitas verdes, más densas en el centro. */
function texturaMusgo(): THREE.CanvasTexture {
  const tam = 128;
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const ctx = c.getContext('2d')!;
  const azar = crearAzar(77);
  const verdes = ['#3f5a24', '#4f6e2c', '#5f7f34', '#6f8f3c', '#7d9a45'];
  for (let i = 0; i < 900; i++) {
    // Más bolitas cerca del centro: la mancha se deshace por los bordes.
    const r = Math.sqrt(azar()) * azar() * (tam / 2 - 6);
    const a = azar() * Math.PI * 2;
    ctx.fillStyle = verdes[Math.floor(azar() * verdes.length)]!;
    ctx.beginPath();
    ctx.arc(tam / 2 + Math.cos(a) * r, tam / 2 + Math.sin(a) * r * 0.8, entre(azar, 2, 5), 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Musgo: manchas PLANAS pegadas a la roca (un cuadrado con la textura de
 * arriba; lo transparente se descarta con alphaTest y no hay que ordenar
 * nada). Casi todas cerca de las grietas, donde llegan la luz y el agua.
 */
function crearMusgo(azar: Azar, tramo: Tramo, angulos: number[]): THREE.InstancedMesh {
  const musgo = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ map: texturaMusgo(), alphaTest: 0.5, roughness: 1 }),
    MUSGO,
  );
  const matriz = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const radio = RADIO_PARED - 0.04; // un pelo por delante de la pared
  let puestos = 0;
  for (let intento = 0; puestos < MUSGO && intento < MUSGO * 10; intento++) {
    const cerca = azar() < 0.75;
    const angulo = cerca ? angulos[Math.floor(azar() * angulos.length)]! + entre(azar, -0.3, 0.3) : azar() * Math.PI * 2;
    p.set(Math.cos(angulo) * radio, entre(azar, tramo.base + 1, tramo.rellano - 1), Math.sin(angulo) * radio);
    if (tapaSaliente(tramo, p, 0.3)) continue;
    // El cuadrado mira al centro del pozo (su +z hacia dentro) y gira sobre sí mismo.
    giro.setFromEuler(euler.set(0, -Math.PI / 2 - angulo, azar() * Math.PI * 2));
    const t = entre(azar, 0.7, 1.8);
    escala.set(t * entre(azar, 1, 1.5), t, 1);
    musgo.setMatrixAt(puestos++, matriz.compose(p, giro, escala));
  }
  musgo.count = puestos;
  musgo.instanceMatrix.needsUpdate = true;
  musgo.computeBoundingSphere();
  musgo.receiveShadow = true;
  return musgo;
}

/* ---------- Estalactitas ---------- */

/**
 * Estalactitas colgando de la parte de abajo del rellano que cierra `tramo`
 * (el techo del tramo). Cortas y lejos de los últimos salientes, para no
 * meterse en la cabeza del escalador cuando salta al rellano.
 */
export function crearEstalactitas(tramo: Tramo, color: THREE.ColorRepresentation, semilla: number): THREE.InstancedMesh {
  const azar = crearAzar(semilla);
  const geometria = new THREE.ConeGeometry(1, 1, 6);
  geometria.rotateX(Math.PI); // la punta hacia abajo
  geometria.translate(0, -0.5, 0); // la base arriba, en y = 0
  const estalactitas = new THREE.InstancedMesh(geometria, new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }), ESTALACTITAS);
  const techo = tramo.rellano - GROSOR_RELLANO;
  const ultimos = tramo.salientes.filter((s) => s.y > techo - 7);
  const matriz = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  let puestos = 0;
  for (let intento = 0; puestos < ESTALACTITAS && intento < ESTALACTITAS * 10; intento++) {
    const angulo = azar() * Math.PI * 2;
    const radio = entre(azar, RADIO_RELLANO + 0.3, RADIO_PARED - 0.2);
    p.set(Math.cos(angulo) * radio, techo + 0.05, Math.sin(angulo) * radio);
    if (ultimos.some((s) => sobreSaliente(s, p.x, p.z, 2.5))) continue;
    giro.setFromAxisAngle(new THREE.Vector3(0, 1, 0), azar() * Math.PI);
    const grueso = entre(azar, 0.12, 0.35);
    escala.set(grueso, entre(azar, 0.5, 1.4), grueso);
    estalactitas.setMatrixAt(puestos++, matriz.compose(p, giro, escala));
  }
  estalactitas.count = puestos;
  estalactitas.instanceMatrix.needsUpdate = true;
  estalactitas.computeBoundingSphere();
  return estalactitas;
}

/* ---------- La grieta entera ---------- */

/** `salida`: el hueco del pasillo que sale a la ladera (a la altura del rellano de arriba). */
export function crearGrieta(roca: TexturaRoca, tramo: Tramo, salida?: HuecoPared): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'grieta';
  const azar = crearAzar(4401);
  const arriba = tramo.rellano + 20;

  // Desde justo debajo del rellano de abajo (la junta queda escondida).
  grupo.add(crearPared(roca, tramo.base - GROSOR_RELLANO, arriba, 0xe2d9cc, 12, salida));

  // Cada grieta: un núcleo fino que brilla y un halo ancho y suave alrededor.
  const angulos = angulosGrietas(azar);
  const recorridos = angulos.map((a) => recorridoGrieta(azar, a, tramo.base + 2, arriba));
  const nucleo = new THREE.Mesh(
    mergeGeometries(recorridos.map((r) => tiraGrieta(r, 1, 0.03))),
    new THREE.MeshBasicMaterial({ color: 0xfff6dc, side: THREE.DoubleSide }),
  );
  nucleo.name = 'grietas-de-luz';
  const halo = new THREE.Mesh(
    mergeGeometries(recorridos.map((r) => tiraGrieta(r, 9, 0.02))),
    new THREE.MeshBasicMaterial({
      color: 0xffc977,
      alphaMap: texturaHalo(),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  halo.name = 'halo-de-las-grietas';
  grupo.add(nucleo, halo, crearRayos(azar, angulos, tramo.base, tramo.rellano));

  grupo.add(crearMusgo(azar, tramo, angulos));
  grupo.add(crearCristales(tramo, { cantidad: 70, color: 0x8f5a1a, emisivo: 0xff8a1e, intensidad: 0.9, semilla: 2027 }));
  grupo.add(crearEstalactitas(tramo, 0xb8a588, 4402));

  // El cielo, arriba del todo: por ahí se sale al aire libre (tramo 3).
  const cielo = new THREE.Mesh(
    new THREE.CircleGeometry(RADIO_PARED + 0.1, 48),
    new THREE.MeshBasicMaterial({ color: 0xd6ecff, fog: false }),
  );
  cielo.rotation.x = Math.PI / 2; // mirando hacia abajo
  cielo.position.y = arriba;
  cielo.name = 'cielo';
  grupo.add(cielo);

  return grupo;
}

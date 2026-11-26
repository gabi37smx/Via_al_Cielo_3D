/*
 * El equipo de escalada, hecho por código y enganchado a los HUESOS del
 * modelo de Kenney: así se mueve con la cabeza, el torso y las piernas en
 * todas las animaciones.
 *
 * - Casco de escalada: carcasa redondeada con cúpula, borde, ranuras de
 *   ventilación, banda con frontal y barbuquejo.
 * - Arnés: cinturón con hebilla, perneras, anillo central, mosquetones y
 *   bolsa de magnesio.
 *
 * Todas las piezas de un mismo hueso se FUNDEN en una sola malla, con el
 * color en los vértices: 4 mallas en total (cabeza, torso y dos piernas).
 * Con una malla por pieza eran 60 llamadas de dibujo más; ×4 escaladores en
 * la carrera no cabría en el presupuesto de 200.
 *
 * Las medidas están en las unidades del modelo SIN escalar (mide 0,66) y
 * relativas a cada hueso. Salen de medir los vértices de Kenney Mini
 * Characters, que comparten el mismo esqueleto: valen para todos.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLOR = {
  casco: 0x2b7de9,
  cinta: 0x1c2230,
  lente: 0xfff1b8,
  arnes: 0xf2c230,
  metal: 0xc9d1d9,
  anodizado: 0xff7a1a,
  anillo: 0xd7263d,
  magnesio: 0xf4f1ea,
} as const;

/** Junta piezas de colores y las funde en una malla al final. */
class Taller {
  private piezas: THREE.BufferGeometry[] = [];
  private readonly matriz = new THREE.Matrix4();
  private readonly giro = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();

  pieza(
    geometria: THREE.BufferGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    rotacion: [number, number, number] = [0, 0, 0],
    escala: [number, number, number] = [1, 1, 1],
  ) {
    const g = (geometria.index ? geometria.toNonIndexed() : geometria.clone());
    g.deleteAttribute('uv');
    this.giro.setFromEuler(this.euler.set(...rotacion));
    g.applyMatrix4(this.matriz.compose(new THREE.Vector3(x, y, z), this.giro, new THREE.Vector3(...escala)));
    const c = new THREE.Color(color);
    const n = g.getAttribute('position').count;
    const colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    this.piezas.push(g);
  }

  /** Anillo rectangular de cuatro tiras alrededor de (0, y, z). */
  anillo(color: number, y: number, z: number, medioX: number, medioZ: number, alto: number, grosor: number) {
    const ancho = medioX * 2 + grosor * 2;
    this.pieza(new THREE.BoxGeometry(ancho, alto, grosor), color, 0, y, z + medioZ + grosor / 2);
    this.pieza(new THREE.BoxGeometry(ancho, alto, grosor), color, 0, y, z - medioZ - grosor / 2);
    this.pieza(new THREE.BoxGeometry(grosor, alto, medioZ * 2), color, medioX + grosor / 2, y, z);
    this.pieza(new THREE.BoxGeometry(grosor, alto, medioZ * 2), color, -medioX - grosor / 2, y, z);
  }

  colgarDe(hueso: THREE.Object3D, material: THREE.Material, nombre: string) {
    const malla = new THREE.Mesh(mergeGeometries(this.piezas), material);
    malla.name = nombre;
    malla.castShadow = true;
    malla.frustumCulled = false; // va con el hueso: la caja de reposo no sirve
    hueso.add(malla);
  }
}

function casco(t: Taller) {
  // La cabeza (respecto a su hueso) ocupa x ±0,227, y −0,08…0,32 (más
  // estrecha arriba) y z −0,16…0,23: el centro en profundidad está en 0,035.
  const cz = 0.035;
  // Carcasa muy redondeada que baja hasta la frente, y una cúpula encima:
  // así parece un casco de escalada y no una caja.
  // (Sin canto oscuro abajo: sobresalía como el ala de un sombrero. Y con el
  // borde a y = 0,115 para que no tape los ojos.)
  t.pieza(new RoundedBoxGeometry(0.52, 0.26, 0.46, 5, 0.11), COLOR.casco, 0, 0.245, cz);
  t.pieza(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), COLOR.casco, 0, 0.35, cz, [0, 0, 0], [0.2, 0.065, 0.18]);
  // Ranuras de ventilación en la cúpula.
  for (const x of [-0.08, 0, 0.08]) t.pieza(new THREE.BoxGeometry(0.03, 0.02, 0.14), COLOR.cinta, x, 0.408, cz);
  // Banda del frontal alrededor del casco y el frontal delante.
  t.pieza(new RoundedBoxGeometry(0.526, 0.028, 0.466, 2, 0.012), COLOR.cinta, 0, 0.2, cz);
  t.pieza(new THREE.BoxGeometry(0.1, 0.065, 0.04), COLOR.cinta, 0, 0.2, cz + 0.245);
  t.pieza(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), COLOR.lente, 0, 0.2, cz + 0.27, [Math.PI / 2, 0, 0]);
  // Barbuquejo: cintas por los lados hasta debajo de la barbilla.
  for (const lado of [-1, 1]) {
    t.pieza(new THREE.BoxGeometry(0.012, 0.21, 0.022), COLOR.cinta, lado * 0.232, 0.02, cz + 0.08, [-0.35, 0, 0]);
  }
  t.pieza(new THREE.BoxGeometry(0.3, 0.014, 0.024), COLOR.cinta, 0, -0.085, cz + 0.115);
}

function arnes(t: Taller) {
  // El torso (respecto a su hueso) ocupa x ±0,126, z ±0,134 justo encima de la cadera.
  t.anillo(COLOR.arnes, 0.03, 0, 0.128, 0.136, 0.045, 0.02);
  t.pieza(new THREE.BoxGeometry(0.06, 0.04, 0.012), COLOR.metal, 0, 0.03, 0.163); // hebilla
  t.pieza(new THREE.TorusGeometry(0.03, 0.008, 6, 16), COLOR.anillo, 0, -0.012, 0.16); // anillo central
  // Mosquetones colgando de los lados.
  for (const [x, z, color] of [
    [0.15, 0.06, COLOR.anodizado],
    [0.15, -0.04, COLOR.metal],
    [-0.15, 0.06, COLOR.metal],
    [-0.15, -0.04, COLOR.anodizado],
  ] as const) {
    t.pieza(new THREE.TorusGeometry(0.022, 0.005, 6, 12), color, x, -0.01, z, [0, Math.PI / 2, 0], [1, 1.4, 1]);
  }
  // Bolsa de magnesio a la espalda.
  t.pieza(new THREE.CylinderGeometry(0.04, 0.035, 0.065, 12), COLOR.magnesio, 0, 0.01, -0.19);
}

function pernera(t: Taller) {
  t.anillo(COLOR.arnes, -0.04, 0.005, 0.068, 0.075, 0.03, 0.016);
}

/** Pone casco y arnés al modelo. Devuelve false si no encuentra los huesos. */
export function ponerEquipo(modelo: THREE.Object3D): boolean {
  const cabeza = modelo.getObjectByName('head');
  const torso = modelo.getObjectByName('torso');
  const piernas = ['leg-left', 'leg-right'].map((n) => modelo.getObjectByName(n));
  if (!cabeza || !torso || piernas.some((p) => !p)) return false;

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
  const tc = new Taller();
  casco(tc);
  tc.colgarDe(cabeza, material, 'casco');
  const ta = new Taller();
  arnes(ta);
  ta.colgarDe(torso, material, 'arnes');
  piernas.forEach((p, i) => {
    const tp = new Taller();
    pernera(tp);
    tp.colgarDe(p!, material, `pernera-${i}`);
  });
  return true;
}

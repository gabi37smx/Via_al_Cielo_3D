/*
 * Adornos de las cuevas (sesión 7, decisión 039, petición de Gabi: «que no
 * sea tan soso»). Como en el Vía al Cielo 2D:
 *
 * - Cueva oscura: fósiles de dinosaurio y esqueletos de persona metidos en la
 *   roca, cráneos sobre algunos salientes, cofres con monedas de oro en los
 *   descansillos, estalagmitas y charcos de petróleo en el suelo.
 * - Grieta: un fósil de dinosaurio, esqueletos, amonites (fósiles en espiral)
 *   y cráneos.
 *
 * Todo se construye con formas sencillas (cápsulas, bolas, anillos) y por
 * código: nada que descargar ni acreditar. SOLO SE VE: no se pisa ni choca
 * (lo que se pisa sale únicamente de reglas/torre.ts).
 *
 * Los fósiles se dibujan «planos», en el plano de la pared (x a lo largo de
 * la pared, y hacia arriba, z hacia el centro del pozo), y luego se DOBLAN
 * para seguir la curva de la pared: un dinosaurio de 7 m plano se metería
 * en la roca por los extremos. Todas las piezas del mismo material se juntan
 * en una sola malla: una llamada de dibujo por material.
 *
 * La posición depende de la torre (para no tapar salientes) y de una semilla
 * fija: todos los jugadores de una sala ven los mismos adornos.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearAzar, entre, type Azar } from '../reglas/azar.ts';
import { RADIO_PARED, puntoDeSalida, sobreSaliente, type Saliente, type Tramo } from '../reglas/torre.ts';

type Punto2 = [number, number];
type Piezas = THREE.BufferGeometry[];

/* ---------- Piezas básicas (en el plano de la pared) ---------- */

/** Hueso: una cápsula de `a` a `b`. */
function hueso(a: Punto2, b: Punto2, radio: number, z = 0): THREE.BufferGeometry {
  const largo = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]) - radio * 2, 0.01);
  const g = new THREE.CapsuleGeometry(radio, largo, 3, 6);
  g.rotateZ(-Math.atan2(b[0] - a[0], b[1] - a[1]));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
  return g;
}

/** Bola (aplastada si se quiere). */
function bola(x: number, y: number, radio: number, escala: [number, number, number] = [1, 1, 1], z = 0): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radio, 8, 6);
  g.scale(...escala);
  g.translate(x, y, z);
  return g;
}

/** Costilla: un arco que sale de `p` y se curva hacia abajo y hacia delante. */
function costilla(p: Punto2, radio: number, grosor: number, sentido = 1): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radio, grosor, 4, 10, Math.PI * 0.5);
  g.rotateZ(Math.PI); // de «derecha → arriba» a «izquierda → abajo»
  g.translate(p[0] + radio, p[1], 0);
  if (sentido < 0) g.scale(-1, 1, 1);
  return g;
}

/** Diente o garra: un cono que apunta hacia `angulo` (0 = abajo). */
function diente(x: number, y: number, largo: number, radio: number, angulo = 0): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(radio, largo, 5);
  g.rotateZ(Math.PI + angulo); // la punta hacia abajo
  g.translate(x, y - largo / 2, 0);
  return g;
}

/* ---------- Esqueletos y fósiles ---------- */

/** Dinosaurio de lado (tipo tiranosaurio), unos 7 m de la cola a la cabeza. */
function dinosaurio(cuencas: Piezas): Piezas {
  const p: Piezas = [];
  // Columna: de la punta de la cola (izquierda) al cuello (derecha).
  const columna = new THREE.CatmullRomCurve3(
    [[-3.6, 0.5], [-2.2, 0.9], [-0.6, 1.15], [0.8, 1.3], [1.8, 1.6], [2.4, 2.1]].map(([x, y]) => new THREE.Vector3(x, y, 0)),
  );
  const vertebras = 34;
  for (let i = 0; i <= vertebras; i++) {
    const t = i / vertebras;
    const v = columna.getPoint(t);
    p.push(bola(v.x, v.y, 0.05 + 0.1 * Math.min(t * 1.6, 1), [1, 1.2, 0.8]));
  }
  // Costillas bajo el tronco, más largas en el medio.
  for (let i = 0; i < 9; i++) {
    const t = 0.42 + i * 0.04;
    const v = columna.getPoint(t);
    p.push(costilla([v.x, v.y], 0.4 + 0.4 * Math.sin((Math.PI * (i + 1)) / 10), 0.06));
  }
  // Cráneo: cabeza alargada, mandíbula y dientes.
  p.push(bola(3.05, 2.2, 0.5, [1.6, 0.8, 0.5]));
  cuencas.push(bola(2.75, 2.3, 0.13, [1, 1.1, 0.5], 0.2)); // la cuenca del ojo
  cuencas.push(bola(3.55, 2.25, 0.06, [1.4, 1, 0.5], 0.2)); // el agujero de la nariz
  p.push(hueso([2.4, 1.85], [3.7, 1.7], 0.1));
  for (let i = 0; i < 7; i++) p.push(diente(2.75 + i * 0.15, 1.95, 0.2, 0.045));
  // Pelvis y patas de atrás (dos, una un poco más adelante).
  p.push(bola(-0.5, 0.95, 0.32, [1.2, 0.8, 0.5]));
  for (const dx of [0, 0.3]) {
    p.push(hueso([-0.5 + dx, 0.9], [-0.05 + dx, -0.25], 0.14));
    p.push(bola(-0.05 + dx, -0.25, 0.12));
    p.push(hueso([-0.05 + dx, -0.25], [-0.45 + dx, -1.25], 0.1));
    p.push(hueso([-0.45 + dx, -1.25], [0.15 + dx, -1.38], 0.06));
    p.push(diente(0.2 + dx, -1.3, 0.14, 0.04, -Math.PI / 2));
  }
  // Bracitos.
  p.push(hueso([1.35, 1.2], [1.6, 0.75], 0.045));
  p.push(hueso([1.6, 0.75], [1.82, 0.7], 0.035));
  return p;
}

/** Persona de frente, 1,75 m, con los brazos caídos (huesos algo gruesos para que se lean de lejos). */
function persona(cuencas: Piezas): Piezas {
  const p: Piezas = [];
  p.push(bola(0, 1.62, 0.13, [0.9, 1.1, 0.9])); // cráneo
  cuencas.push(...ojos(0, 1.64, 0.045, 0.05, 0.11));
  p.push(hueso([-0.06, 1.49], [0.06, 1.49], 0.04)); // mandíbula
  for (let i = 0; i < 9; i++) p.push(bola(0, 1.42 - i * 0.055, 0.04)); // columna
  for (let i = 0; i < 5; i++) {
    const y = 1.36 - i * 0.07;
    const largo = 0.17 - Math.abs(i - 1.5) * 0.015;
    for (const lado of [-1, 1]) p.push(hueso([0, y], [lado * largo, y - 0.09], 0.026));
  }
  p.push(bola(0, 0.9, 0.15, [1.3, 0.6, 0.6])); // pelvis
  for (const lado of [-1, 1]) {
    p.push(hueso([0, 1.42], [lado * 0.22, 1.4], 0.03)); // clavícula
    p.push(hueso([lado * 0.22, 1.4], [lado * 0.3, 1.1], 0.035));
    p.push(hueso([lado * 0.3, 1.1], [lado * 0.33, 0.85], 0.03));
    p.push(bola(lado * 0.34, 0.8, 0.05, [0.8, 1.3, 0.6])); // mano
    p.push(hueso([lado * 0.1, 0.88], [lado * 0.13, 0.48], 0.045));
    p.push(hueso([lado * 0.13, 0.48], [lado * 0.14, 0.08], 0.038));
    p.push(hueso([lado * 0.14, 0.06], [lado * 0.25, 0.04], 0.035)); // pie
  }
  return p;
}

/** Cuencas de los ojos (y la nariz): bolitas oscuras en la cara. `z` = cuánto asoman. */
function ojos(x: number, y: number, radio: number, separacion: number, z: number): Piezas {
  return [
    bola(x - separacion, y, radio, [1, 1.1, 0.5], z),
    bola(x + separacion, y, radio, [1, 1.1, 0.5], z),
    bola(x, y - radio * 1.6, radio * 0.5, [1, 1.3, 0.5], z),
  ];
}

/**
 * Amonite (fósil de concha en espiral), 1 m: un disco aplastado con la
 * espiral marcada encima y costillas que salen hacia fuera en la última vuelta.
 */
function amonite(): Piezas {
  const p: Piezas = [bola(0, 0, 0.5, [1, 1, 0.22])];
  const vueltas = 3;
  const radio = (t: number) => 0.5 * Math.exp(0.18 * (t - vueltas * Math.PI * 2));
  const puntos: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * vueltas * Math.PI * 2;
    puntos.push(new THREE.Vector3(Math.cos(t) * radio(t), Math.sin(t) * radio(t), 0.1));
  }
  p.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos), 80, 0.025, 5));
  // Costillas: de la penúltima vuelta a la última.
  for (let i = 0; i < 22; i++) {
    const t = vueltas * Math.PI * 2 - (i / 22) * Math.PI * 2;
    const dentro = radio(t - Math.PI * 2) + 0.02;
    const fuera = radio(t) - 0.02;
    p.push(hueso([Math.cos(t) * dentro, Math.sin(t) * dentro], [Math.cos(t) * fuera, Math.sin(t) * fuera], 0.016, 0.09));
  }
  return p;
}

/** Cráneo suelto de 25 cm (para dejarlo encima de un saliente), mirando hacia +z. */
function craneo(cuencas: Piezas): Piezas {
  cuencas.push(...ojos(0, 0.14, 0.035, 0.045, 0.115));
  return [bola(0, 0.13, 0.12, [1, 0.95, 1.1]), bola(0, 0.045, 0.075, [1.05, 0.7, 1.1], 0.05)];
}

/* ---------- Colocar en la pared ---------- */

/**
 * Pasa unas piezas del plano a la pared, doblándolas para que sigan la
 * curva: x (a lo largo) → ángulo, y → altura, z → hacia el centro.
 * `giro` las gira en el plano de la pared y `espejo` las pone mirando al otro lado.
 */
function aLaPared(piezas: Piezas, angulo: number, y: number, op: { escala?: number; giro?: number; espejo?: boolean; hundido?: number } = {}): Piezas {
  const escala = op.escala ?? 1;
  const cos = Math.cos(op.giro ?? 0);
  const sin = Math.sin(op.giro ?? 0);
  const fx = op.espejo ? -1 : 1;
  // Negativo = un poco por delante de la roca: los huesos finos asoman enteros.
  const hundido = op.hundido ?? -0.04;
  return piezas.map((g) => {
    const pos = g.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) * escala * fx;
      const ly = pos.getY(i) * escala;
      const x = lx * cos - ly * sin;
      const yy = lx * sin + ly * cos;
      const a = angulo + x / RADIO_PARED;
      const r = RADIO_PARED + hundido - pos.getZ(i) * escala;
      pos.setXYZ(i, Math.cos(a) * r, y + yy, Math.sin(a) * r);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Pone piezas sueltas en (x, y, z) del mundo, giradas `giro` en vertical. */
function enElMundo(piezas: Piezas, x: number, y: number, z: number, giro: number, escala = 1): Piezas {
  return piezas.map((g) => g.scale(escala, escala, escala).rotateY(giro).translate(x, y, z));
}

/** ¿Una caja de la pared (centrada en `angulo`, de `ancho` × `alto` m desde `y`) tapa algún saliente? */
function libre(tramo: Tramo, angulo: number, y: number, ancho: number, alto: number): boolean {
  if (y < tramo.base + 1 || y + alto > tramo.rellano - 2) return false;
  const p = new THREE.Vector3();
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 4; j++) {
      const a = angulo + ((i / 6 - 0.5) * ancho) / RADIO_PARED;
      p.set(Math.cos(a) * (RADIO_PARED - 0.5), y + (j / 4) * alto, Math.sin(a) * (RADIO_PARED - 0.5));
      const tapa = tramo.salientes.some((s) => p.y > s.y - s.grosor - 1.5 && p.y < s.y + 2.5 && sobreSaliente(s, p.x, p.z, 0.6));
      if (tapa) return false;
    }
  }
  return true;
}

/** Busca un hueco libre en la pared; null si no lo encuentra. */
function buscarHueco(azar: Azar, tramo: Tramo, ancho: number, alto: number, desde = tramo.base, hasta = tramo.rellano): { angulo: number; y: number } | null {
  for (let intento = 0; intento < 60; intento++) {
    const angulo = azar() * Math.PI * 2;
    const y = entre(azar, desde, hasta - alto);
    if (libre(tramo, angulo, y, ancho, alto)) return { angulo, y };
  }
  return null;
}

/** Punto encima de un saliente, junto a la pared y hacia un extremo (para cráneos y cofres). */
function rinconDe(s: Saliente, lado: number, separacion: number): { x: number; z: number; giro: number } {
  const radio = RADIO_PARED - separacion;
  const a = s.angulo + (lado * (s.ancho / 2 - 0.45)) / RADIO_PARED;
  // giro: mirando al centro del pozo.
  return { x: Math.cos(a) * radio, z: Math.sin(a) * radio, giro: -Math.PI / 2 - a };
}

/* ---------- Materiales y montaje ---------- */

export interface OpcionesAdornos {
  semilla: number;
  dinosaurios: number;
  personas: number;
  amonites: number;
  craneos: number;
  /** Solo en la cueva oscura: cofres en los descansillos, estalagmitas y petróleo en el suelo. */
  delSuelo: boolean;
  /** Color de los huesos (los de la grieta, más claros). */
  hueso: THREE.ColorRepresentation;
}

function malla(piezas: Piezas, material: THREE.Material, nombre: string): THREE.Mesh | null {
  if (piezas.length === 0) return null;
  const m = new THREE.Mesh(mergeGeometries(piezas), material);
  for (const g of piezas) g.dispose();
  m.name = nombre;
  m.receiveShadow = true;
  return m;
}

export function crearAdornos(tramo: Tramo, op: OpcionesAdornos): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = `adornos-${tramo.indice}`;
  const azar = crearAzar(op.semilla);
  const huesos: Piezas = [];
  const fosiles: Piezas = [];
  const oro: Piezas = [];
  const madera: Piezas = [];
  const roca: Piezas = [];
  const petroleo: Piezas = [];
  const cuencas: Piezas = [];

  // Fósiles grandes metidos en la pared.
  for (let i = 0; i < op.dinosaurios; i++) {
    const escala = entre(azar, 0.9, 1.25);
    const hueco = buscarHueco(azar, tramo, 7.6 * escala, 3.8 * escala, tramo.base + 10);
    if (hueco) {
      const ojosDino: Piezas = [];
      const forma = { escala, giro: entre(azar, -0.12, 0.12), espejo: azar() < 0.5 };
      huesos.push(...aLaPared(dinosaurio(ojosDino), hueco.angulo, hueco.y + 1.4 * escala, forma));
      cuencas.push(...aLaPared(ojosDino, hueco.angulo, hueco.y + 1.4 * escala, forma));
    }
  }
  for (let i = 0; i < op.personas; i++) {
    // Algunos tumbados o torcidos, como caídos en la roca. Se giran alrededor
    // de su centro, así caben en un hueco de 2,2 × 2,2 m en cualquier postura.
    const giro = azar() < 0.4 ? entre(azar, -1.6, 1.6) : entre(azar, -0.25, 0.25);
    const hueco = buscarHueco(azar, tramo, 2.2, 2.2);
    const ojosPersona: Piezas = [];
    const centrada = persona(ojosPersona).map((g) => g.translate(0, -0.87, 0));
    ojosPersona.forEach((g) => g.translate(0, -0.87, 0));
    if (hueco) {
      huesos.push(...aLaPared(centrada, hueco.angulo, hueco.y + 1.1, { giro }));
      cuencas.push(...aLaPared(ojosPersona, hueco.angulo, hueco.y + 1.1, { giro }));
    }
  }
  for (let i = 0; i < op.amonites; i++) {
    const escala = entre(azar, 0.6, 1.5);
    const hueco = buscarHueco(azar, tramo, 1.2 * escala, 1.2 * escala);
    if (hueco) fosiles.push(...aLaPared(amonite(), hueco.angulo, hueco.y + 0.6 * escala, { escala, giro: azar() * Math.PI * 2, espejo: azar() < 0.5 }));
  }

  // Cráneos sueltos encima de algunos salientes, junto a la pared.
  const candidatos = tramo.salientes.filter((s) => s.tipo !== 'descansillo' && s.ancho > 1.6);
  for (let i = 0; i < op.craneos && candidatos.length > 0; i++) {
    const s = candidatos.splice(Math.floor(azar() * candidatos.length), 1)[0]!;
    const r = rinconDe(s, azar() < 0.5 ? -1 : 1, 0.35);
    const ojosCraneo: Piezas = [];
    const giro = r.giro + entre(azar, -0.6, 0.6);
    const tam = entre(azar, 0.9, 1.3);
    huesos.push(...enElMundo(craneo(ojosCraneo), r.x, s.y, r.z, giro, tam));
    cuencas.push(...enElMundo(ojosCraneo, r.x, s.y, r.z, giro, tam));
  }

  if (op.delSuelo) {
    // Cofres con monedas de oro en algunos descansillos (en un extremo, contra la pared).
    for (const s of tramo.salientes.filter((x) => x.tipo === 'descansillo' && azar() < 0.6)) {
      const r = rinconDe(s, azar() < 0.5 ? -1 : 1, 0.45);
      const caja = new THREE.BoxGeometry(0.8, 0.45, 0.5);
      caja.translate(0, 0.225, 0);
      const tapa = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 10, 1, false, 0, Math.PI);
      tapa.rotateZ(Math.PI / 2);
      tapa.translate(0, 0.45, 0);
      madera.push(...enElMundo([caja, tapa], r.x, s.y, r.z, r.giro));
      // Herrajes dorados (dos flejes que abrazan caja y tapa) y la cerradura delante (+z).
      const dorado: Piezas = [];
      for (const x of [-0.27, 0.27]) {
        const fleje = new THREE.BoxGeometry(0.06, 0.46, 0.52);
        fleje.translate(x, 0.225, 0);
        const arco = new THREE.CylinderGeometry(0.265, 0.265, 0.06, 10, 1, true, 0, Math.PI);
        arco.rotateZ(Math.PI / 2);
        arco.translate(x, 0.45, 0);
        dorado.push(fleje, arco);
      }
      const cerradura = new THREE.BoxGeometry(0.12, 0.14, 0.04);
      cerradura.translate(0, 0.42, 0.26);
      dorado.push(cerradura);
      // Monedas por el suelo, delante del cofre (hacia el centro del pozo).
      for (let m = 0; m < 10; m++) {
        const moneda = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 10);
        moneda.rotateX(entre(azar, -0.3, 0.3));
        moneda.translate(entre(azar, -0.5, 0.5), 0.01 + m * 0.002, entre(azar, 0.3, 0.75));
        dorado.push(moneda);
      }
      oro.push(...enElMundo(dorado, r.x, s.y, r.z, r.giro));
    }

    // Estalagmitas en el suelo de la cueva, cerca de la pared, lejos de las salidas.
    const salidas = [0, 1, 2, 3].map((p) => puntoDeSalida(tramo, p));
    const primeros = tramo.salientes.slice(0, 3);
    for (let i = 0, puestas = 0; i < 200 && puestas < 34; i++) {
      const a = azar() * Math.PI * 2;
      const radio = RADIO_PARED - entre(azar, 0.3, 2.2);
      const x = Math.cos(a) * radio;
      const z = Math.sin(a) * radio;
      if (salidas.some((s) => Math.hypot(s.x - x, s.z - z) < 2.5)) continue;
      if (primeros.some((s) => sobreSaliente(s, x, z, 1))) continue;
      const alto = entre(azar, 0.4, 2.6);
      const cono = new THREE.ConeGeometry(entre(azar, 0.15, 0.4), alto, 6);
      cono.translate(x, alto / 2 - 0.05, z);
      roca.push(cono);
      puestas++;
    }

    // Charcos de petróleo: manchas negras y brillantes en el suelo.
    for (let i = 0; i < 6; i++) {
      const a = azar() * Math.PI * 2;
      const radio = entre(azar, 2, RADIO_PARED - 2.5);
      const charco = new THREE.CircleGeometry(1, 14);
      charco.rotateX(-Math.PI / 2);
      charco.scale(entre(azar, 0.6, 1.4), 1, entre(azar, 0.4, 0.9));
      charco.rotateY(azar() * Math.PI);
      charco.translate(Math.cos(a) * radio, 0.015 + i * 0.002, Math.sin(a) * radio);
      petroleo.push(charco);
    }
  }

  const materiales = {
    // Un pelo de brillo propio: en la cueva oscura, si no, casi no se ven.
    hueso: new THREE.MeshStandardMaterial({ color: op.hueso, roughness: 0.8, emissive: 0x2a241a, side: THREE.DoubleSide }),
    fosil: new THREE.MeshStandardMaterial({ color: 0xb79c78, roughness: 0.9, emissive: 0x1a140c, side: THREE.DoubleSide }),
    oro: new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.8, roughness: 0.3, emissive: 0x6b4d0a }),
    madera: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9, flatShading: true }),
    roca: new THREE.MeshStandardMaterial({ color: 0x9a8e7e, roughness: 1, flatShading: true }),
    cuencas: new THREE.MeshStandardMaterial({ color: 0x0d0a07, roughness: 1 }),
    petroleo: new THREE.MeshStandardMaterial({ color: 0x050403, metalness: 0.4, roughness: 0.05 }),
  };
  for (const m of [
    malla(huesos, materiales.hueso, 'huesos'),
    malla(cuencas, materiales.cuencas, 'cuencas'),
    malla(fosiles, materiales.fosil, 'amonites'),
    malla(oro, materiales.oro, 'oro'),
    malla(madera, materiales.madera, 'cofres'),
    malla(roca, materiales.roca, 'estalagmitas'),
    malla(petroleo, materiales.petroleo, 'petroleo'),
  ]) {
    if (m) grupo.add(m);
  }
  return grupo;
}

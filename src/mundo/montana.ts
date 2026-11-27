/*
 * El escenario del tramo 3 (440-660 m): EL AIRE LIBRE, la montaña nevada
 * (decisión 040). Dibuja lo que calcula reglas/ladera.ts:
 *
 * - El PASILLO que sale del pozo a 440 m (suelo, paredes y techo de roca,
 *   con unos farolillos que brillan) y la COLINA de roca que rodea el pozo.
 * - La EXPLANADA nevada, con pinos.
 * - La CARA de la montaña (roca gris) con los SALIENTES blancos de nieve en
 *   zigzag (las «presas» blancas del 2D) y, arriba, la CIMA con una bandera.
 * - El paisaje: cielo con degradado, nubes y montañas nevadas al fondo.
 *
 * Lo que se pisa sale solo de reglas/ladera.ts; esto solo dibuja. Casi todo
 * son mallas instanciadas o juntadas: pocas llamadas de dibujo.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearAzar, entre } from '../reglas/azar.ts';
import {
  ALTO_COLINA,
  D_CARA,
  FONDO_CIMA,
  RADIO_COLINA,
  RADIO_MUNDO,
  TUNEL,
  aLocal,
  aMundo,
  dCara,
  ejes,
  type Ladera,
} from '../reglas/ladera.ts';
import { RADIO_PARED } from '../reglas/torre.ts';
import { materialRoca, type TexturaRoca } from './texturas.ts';
import { crearForma } from './torre.ts';

export interface TexturasMontana {
  /** Roca de la colina, el pasillo y la cara de la montaña. */
  roca: TexturaRoca;
  /** Nieve (explanada, cima y lo de encima de los salientes). */
  nieve: TexturaRoca;
  /** Los salientes: roca muy clara, casi blanca. */
  piedra: TexturaRoca;
}

/** Ángulo de Three.js (CylinderGeometry/RingGeometry) para nuestro ángulo alrededor del pozo. */
const theta = (angulo: number) => Math.PI / 2 - angulo;

/** Coloca una geometría del marco (d hacia fuera, u de lado, y arriba) en el mundo. */
function enMarco(l: Ladera, g: THREE.BufferGeometry): THREE.BufferGeometry {
  // En el marco: x = u, z = d. Girar para que +z (local) apunte a N.
  const e = ejes(l);
  g.rotateY(Math.atan2(e.nx, e.nz));
  return g;
}

/* ---------- Pasillo y colina ---------- */

function crearPasillo(l: Ladera, tex: TexturasMontana): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'pasillo';
  const largo = RADIO_COLINA + 0.4 - (RADIO_PARED - 0.4);
  const centro = (RADIO_COLINA + 0.4 + RADIO_PARED - 0.4) / 2;
  const piezas: THREE.BufferGeometry[] = [];
  // Suelo (cara de arriba justo a 440 m), paredes y techo.
  const suelo = new THREE.BoxGeometry(TUNEL.ancho + 1, 0.5, largo);
  suelo.translate(0, l.base - 0.25, centro);
  piezas.push(suelo);
  for (const lado of [-1, 1]) {
    const pared = new THREE.BoxGeometry(0.6, TUNEL.alto + 0.5, largo);
    pared.translate(lado * (TUNEL.ancho / 2 + 0.3), l.base + TUNEL.alto / 2, centro);
    piezas.push(pared);
  }
  const techo = new THREE.BoxGeometry(TUNEL.ancho + 1.2, 0.6, largo);
  techo.translate(0, l.base + TUNEL.alto + 0.3, centro);
  piezas.push(techo);
  const roca = new THREE.Mesh(enMarco(l, mergeGeometries(piezas)), materialRoca(tex.roca, 2, 2, { color: 0x8a8580 }));
  roca.receiveShadow = true;
  grupo.add(roca);

  // Farolillos: brillan (sin luces de verdad) a lo largo del pasillo.
  const luces: THREE.BufferGeometry[] = [];
  for (let d = RADIO_PARED + 1.5; d < RADIO_COLINA; d += 3.5) {
    for (const lado of [-1, 1]) {
      const farol = new THREE.BoxGeometry(0.08, 0.2, 0.12);
      farol.translate(lado * (TUNEL.ancho / 2 - 0.04), l.base + 2.6, d);
      luces.push(farol);
    }
  }
  grupo.add(new THREE.Mesh(enMarco(l, mergeGeometries(luces)), new THREE.MeshBasicMaterial({ color: 0xff9a2e })));
  return grupo;
}

function crearColina(l: Ladera, tex: TexturasMontana): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'colina';
  const alto = ALTO_COLINA - (l.base - 1);
  // Por fuera, con un hueco donde sale el pasillo.
  const hueco = (TUNEL.ancho + 0.2) / RADIO_COLINA;
  const vueltas = Math.round((2 * Math.PI * RADIO_COLINA) / 5);
  const pared = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIO_COLINA, RADIO_COLINA + 1.5, alto, 72, 1, true, theta(l.angulo) + hueco / 2, Math.PI * 2 - hueco),
    materialRoca(tex.roca, vueltas, alto / 5, { color: 0xd2cec8 }),
  );
  pared.position.y = l.base - 1 + alto / 2;
  pared.receiveShadow = true;
  // Encima del pasillo, la parte de pared que falta (del techo del pasillo a lo alto).
  const dintelAlto = ALTO_COLINA - (l.base + TUNEL.alto);
  const dintel = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIO_COLINA, RADIO_COLINA, dintelAlto, 4, 1, true, theta(l.angulo) - hueco / 2, hueco),
    materialRoca(tex.roca, 1, dintelAlto / 5, { color: 0xd2cec8 }),
  );
  dintel.position.y = l.base + TUNEL.alto + dintelAlto / 2;
  // Lo alto de la colina: nieve alrededor del agujero del pozo.
  const cima = new THREE.Mesh(new THREE.RingGeometry(RADIO_PARED, RADIO_COLINA + 0.2, 72, 1), materialRoca(tex.nieve, 6, 6));
  cima.rotation.x = -Math.PI / 2;
  cima.position.y = ALTO_COLINA;
  cima.receiveShadow = true;
  grupo.add(pared, dintel, cima);
  return grupo;
}

/* ---------- Explanada, cara y cima ---------- */

function crearTerreno(l: Ladera, tex: TexturasMontana): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'terreno';

  // La explanada: un anillo de nieve alrededor de la colina (no entra en el pozo).
  const explanada = new THREE.Mesh(new THREE.RingGeometry(RADIO_COLINA - 0.1, RADIO_MUNDO + 200, 96, 1), materialRoca(tex.nieve, 60, 60));
  explanada.rotation.x = -Math.PI / 2;
  explanada.position.y = l.base;
  explanada.receiveShadow = true;
  grupo.add(explanada);

  // La cara de la montaña: una rejilla (u, y) con d = dCara(y). Un poco de
  // relieve, siempre HACIA DENTRO de la montaña (si saliera hacia fuera, el
  // escalador se metería en la roca al pegarse a ella).
  const azar = crearAzar(6601);
  const anchoU = 600;
  const [nu, ny] = [120, 44];
  const cara = new THREE.PlaneGeometry(anchoU, 1, nu, ny);
  const pos = cara.attributes.position!;
  const uv = cara.attributes.uv!;
  const ruido = Array.from({ length: (nu + 1) * (ny + 1) }, () => azar());
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const t = pos.getY(i) + 0.5; // 0 abajo, 1 arriba
    const y = l.base - 2 + t * (l.rellano + 2 - l.base);
    const d = dCara(Math.max(y, l.base)) + ruido[i]! * 0.6 + (y < l.base ? 0.5 : 0);
    pos.setXYZ(i, u, y, d);
    uv.setXY(i, u / 6, y / 6);
  }
  cara.computeVertexNormals();
  const malla = new THREE.Mesh(enMarco(l, cara), materialRoca(tex.roca, 1, 1, { color: 0xc4cad1, side: THREE.DoubleSide }));
  malla.receiveShadow = true;
  malla.name = 'cara';
  grupo.add(malla);

  // La cima: una explanada de nieve desde el borde de la cara hacia dentro.
  const fondoCima = 60;
  const cima = new THREE.Mesh(enMarco(l, new THREE.BoxGeometry(anchoU, 1, fondoCima).translate(0, l.rellano - 0.5, dCara(l.rellano) - FONDO_CIMA + fondoCima / 2)), materialRoca(tex.nieve, 40, 4));
  cima.receiveShadow = true;
  // El pico de verdad, detrás: un cono con nieve.
  const pico = new THREE.Mesh(new THREE.ConeGeometry(55, 110, 9, 4), materialRoca(tex.nieve, 8, 8, { flatShading: true }));
  const sitioPico = aMundo(l, dCara(l.rellano) + 55, 0);
  pico.position.set(sitioPico.x, l.rellano + 52, sitioPico.z);
  // La bandera de la cima, en el medio, un poco hacia dentro.
  const sitioBandera = aMundo(l, dCara(l.rellano) - FONDO_CIMA + 3, 0);
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.6, roughness: 0.4 }));
  mastil.position.set(sitioBandera.x, l.rellano + 2, sitioBandera.z);
  // La tela, de cara a quien sube (su plano mira hacia el pasillo), ondeando hacia un lado.
  const e = ejes(l);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0xe0362b, side: THREE.DoubleSide, roughness: 0.8 }));
  tela.position.set(sitioBandera.x + e.tx * 0.8, l.rellano + 3.4, sitioBandera.z + e.tz * 0.8);
  tela.rotation.y = Math.atan2(e.nx, e.nz);
  grupo.add(cima, pico, mastil, tela);
  return grupo;
}

/** Los salientes de la ladera: rocas claras con un manto de nieve encima. */
function crearSalientes(l: Ladera, tex: TexturasMontana): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'salientes-ladera';
  const FORMAS = 3;
  const porForma = Array.from({ length: FORMAS }, () => [] as number[]);
  l.salientes.forEach((_, i) => porForma[i % FORMAS]!.push(i));
  const e = ejes(l);
  const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(e.nx, e.nz));
  const matriz = new THREE.Matrix4();
  const posicion = new THREE.Vector3();
  const escala = new THREE.Vector3();
  const material = materialRoca(tex.piedra, 0.6, 0.6);
  const METIDO = 0.3; // un poco metido en la cara, para que no se vea la rendija

  porForma.forEach((indices, forma) => {
    const rocas = new THREE.InstancedMesh(crearForma(7 + forma * 101), material, indices.length);
    rocas.castShadow = rocas.receiveShadow = true;
    indices.forEach((n, i) => {
      const s = l.salientes[n]!;
      const p = aMundo(l, dCara(s.y) - s.fondo / 2 + METIDO / 2, s.u);
      posicion.set(p.x, s.y, p.z);
      escala.set(s.ancho, s.grosor, s.fondo + METIDO);
      rocas.setMatrixAt(i, matriz.compose(posicion, giro, escala));
    });
    rocas.instanceMatrix.needsUpdate = true;
    rocas.computeBoundingSphere();
    grupo.add(rocas);
  });

  // Nieve encima: una losa fina, del tamaño de lo que se pisa (los pies se hunden 4 cm).
  const nieve = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materialRoca(tex.nieve, 0.5, 0.5), l.salientes.length);
  l.salientes.forEach((s, i) => {
    const p = aMundo(l, dCara(s.y) - s.fondo / 2, s.u);
    posicion.set(p.x, s.y + 0.02, p.z);
    escala.set(s.ancho + 0.06, 0.08, s.fondo + 0.04);
    nieve.setMatrixAt(i, matriz.compose(posicion, giro, escala));
  });
  nieve.instanceMatrix.needsUpdate = true;
  nieve.computeBoundingSphere();
  nieve.receiveShadow = true;
  grupo.add(nieve);
  return grupo;
}

/* ---------- Paisaje ---------- */

/** Cielo: una esfera enorme por dentro con un degradado (horizonte claro, arriba azul). */
function crearCielo(): THREE.Mesh {
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(850, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: { arriba: { value: new THREE.Color(0x3f8fd8) }, horizonte: { value: new THREE.Color(0xdcecf8) } },
      vertexShader: /* glsl */ `
        varying float vAltura;
        void main() {
          vAltura = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 arriba;
        uniform vec3 horizonte;
        varying float vAltura;
        void main() {
          gl_FragColor = vec4(mix(horizonte, arriba, smoothstep(-0.05, 0.6, vAltura)), 1.0);
          // Los colores van en espacio lineal: pasarlos al de la pantalla (si no, salen oscurísimos).
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  cielo.name = 'cielo-exterior';
  cielo.renderOrder = -1;
  return cielo;
}

/** Montañas nevadas alrededor, lejos: conos con la punta blanca (color por vértice). */
function crearMontanasLejanas(l: Ladera): THREE.Mesh {
  const azar = crearAzar(6602);
  const piezas: THREE.BufferGeometry[] = [];
  const roca = new THREE.Color(0x6f7d8c);
  const nieve = new THREE.Color(0xf4f8fc);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + entre(azar, -0.15, 0.15);
    const distancia = entre(azar, 330, 560);
    const alto = entre(azar, 180, 360);
    const g = new THREE.ConeGeometry(entre(azar, 90, 150), alto, 7, 6);
    const pos = g.attributes.position!;
    const colores = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      // Un poco de relieve, y nieve de la mitad para arriba (con el borde irregular).
      const y = pos.getY(v);
      const t = y / alto + 0.5;
      if (t > 0.02 && t < 0.98) pos.setX(v, pos.getX(v) * entre(azar, 0.88, 1.12));
      c.copy(t > 0.52 + entre(azar, -0.08, 0.08) ? nieve : roca);
      colores.set([c.r, c.g, c.b], v * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    g.translate(Math.cos(a) * distancia, l.base - 60 + alto / 2, Math.sin(a) * distancia);
    piezas.push(g.toNonIndexed());
  }
  const m = new THREE.Mesh(mergeGeometries(piezas), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.name = 'montanas-lejanas';
  return m;
}

/** Pinos en la explanada (delante de la montaña, sin tapar el camino del pasillo a la cara). */
function crearPinos(l: Ladera): THREE.Group {
  const azar = crearAzar(6603);
  const CUANTOS = 70;
  const troncos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 1 }), CUANTOS);
  const copa = mergeGeometries([0, 1, 2].map((k) => new THREE.ConeGeometry(1.4 - k * 0.35, 1.8, 7).translate(0, 2 + k * 1.1, 0)));
  const copas = new THREE.InstancedMesh(copa, new THREE.MeshStandardMaterial({ color: 0x2f5a3c, roughness: 1, flatShading: true }), CUANTOS);
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const escala = new THREE.Vector3();
  let puestos = 0;
  for (let intento = 0; puestos < CUANTOS && intento < CUANTOS * 20; intento++) {
    const a = azar() * Math.PI * 2;
    const r = entre(azar, RADIO_COLINA + 3, 140);
    p.set(Math.cos(a) * r, l.base, Math.sin(a) * r);
    const { d, u } = aLocal(l, p.x, p.z);
    if (d > D_CARA - 2) continue; // dentro de la montaña
    if (d > 0 && Math.abs(u) < 7) continue; // el camino del pasillo a la cara
    giro.setFromAxisAngle(new THREE.Vector3(0, 1, 0), azar() * Math.PI);
    const t = entre(azar, 0.8, 1.8);
    escala.set(t, t * entre(azar, 0.9, 1.3), t);
    matriz.compose(p, giro, escala);
    troncos.setMatrixAt(puestos, matriz);
    copas.setMatrixAt(puestos++, matriz);
  }
  for (const m of [troncos, copas]) {
    m.count = puestos;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = true;
  }
  const grupo = new THREE.Group();
  grupo.name = 'pinos';
  grupo.add(troncos, copas);
  return grupo;
}

/** Nubes: grupos de bolas blancas aplastadas, lejos del camino y de la cámara. */
function crearNubes(l: Ladera): THREE.InstancedMesh {
  const azar = crearAzar(6604);
  const POR_NUBE = 6;
  const NUBES = 28;
  const nubes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9aa8b8, roughness: 1, flatShading: true }),
    NUBES * POR_NUBE,
  );
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const escala = new THREE.Vector3();
  let puestos = 0;
  for (let intento = 0; puestos < NUBES * POR_NUBE && intento < NUBES * 30; intento++) {
    const a = azar() * Math.PI * 2;
    const r = entre(azar, 70, 300);
    const centro = new THREE.Vector3(Math.cos(a) * r, entre(azar, l.base + 30, l.rellano + 90), Math.sin(a) * r);
    const { d, u } = aLocal(l, centro.x, centro.z);
    // Ni dentro de la montaña ni entre la cámara y la cara (por donde se sube).
    if (d > dCara(centro.y) - 5) continue;
    if (Math.abs(u) < 60 && d > -40) continue;
    const tam = entre(azar, 6, 14);
    for (let k = 0; k < POR_NUBE; k++) {
      p.set(centro.x + entre(azar, -1.6, 1.6) * tam, centro.y + entre(azar, -0.2, 0.3) * tam, centro.z + entre(azar, -1, 1) * tam);
      const t = tam * entre(azar, 0.5, 1);
      escala.set(t, t * 0.5, t * entre(azar, 0.7, 1));
      nubes.setMatrixAt(puestos++, matriz.compose(p, giro, escala));
    }
  }
  nubes.count = puestos;
  nubes.instanceMatrix.needsUpdate = true;
  nubes.computeBoundingSphere();
  nubes.name = 'nubes';
  return nubes;
}

export function crearMontana(l: Ladera, tex: TexturasMontana): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'montana';
  grupo.add(crearPasillo(l, tex), crearColina(l, tex), crearTerreno(l, tex), crearSalientes(l, tex));
  grupo.add(crearCielo(), crearMontanasLejanas(l), crearPinos(l), crearNubes(l));
  return grupo;
}

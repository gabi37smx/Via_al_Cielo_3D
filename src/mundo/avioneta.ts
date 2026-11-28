/*
 * La AVIONETA que lleva de la cima a Valencia (idea I9) y el AERÓDROMO de la
 * cima: una pista de nieve pisada con conos naranjas y una manga de viento.
 * Todo hecho por código con formas sencillas: nada que descargar ni acreditar.
 *
 * La avioneta es de ala alta (como las de las escuelas de vuelo): fuselaje
 * blanco con una franja naranja (el naranja de los salientes de Valencia en
 * el 2D), cabina con cristales, ala encima con sus dos tirantes, cola, tren
 * de aterrizaje y una hélice que gira. La puerta (lado derecho) se abre.
 *
 * Su origen está en el suelo, debajo del ala, y el morro mira hacia +z (así
 * `rotation.y = rumbo`, el mismo ángulo que la orientación del escalador).
 * Dónde está y cómo va inclinada lo dice reglas/vuelo.ts.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AERODROMO, AVIONETA, dPista, type PoseVuelo } from '../reglas/vuelo.ts';
import { aMundo, ejes, type Ladera } from '../reglas/ladera.ts';

const BLANCO = 0xf3f3ee;
const NARANJA = 0xf07f12;

/** Junta piezas (sin índices: así se pueden mezclar formas distintas). */
function juntar(piezas: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(piezas.map((g) => (g.index ? g.toNonIndexed() : g)));
}

/** Altura del eje del fuselaje sobre el suelo (m): lo que miden las ruedas y las patas. */
const EJE = 1.25;

/** El fuselaje: un huso alrededor del eje z (radio según dónde), algo más alto que ancho. */
function fuselaje(): THREE.BufferGeometry {
  const perfil: [number, number][] = [
    [0.02, -AVIONETA.cola],
    [0.16, -AVIONETA.cola + 0.1],
    [0.32, -3],
    [0.5, -1.4],
    [0.66, 0],
    [0.68, 1.4],
    [0.62, 2.6],
    [0.48, 3.4],
    [0.3, AVIONETA.morro - 0.05],
    [0.02, AVIONETA.morro],
  ];
  const g = new THREE.LatheGeometry(perfil.map(([r, z]) => new THREE.Vector2(r, z)), 20);
  g.rotateX(Math.PI / 2); // el eje del torno (y) pasa a ser z
  g.scale(1, 1.18, 1);
  g.translate(0, EJE, 0);
  return g;
}

export interface Avioneta {
  grupo: THREE.Group;
  /** La coloca según la escena del vuelo (`pose`) y hace girar la hélice. */
  colocar(pose: Pick<PoseVuelo, 'x' | 'y' | 'z' | 'rumbo' | 'cabeceo' | 'alabeo' | 'motor' | 'puerta'>, dt: number): void;
}

export function crearAvioneta(): Avioneta {
  const grupo = new THREE.Group();
  grupo.name = 'avioneta';
  // El cuerpo se inclina dentro del grupo (cabeceo y alabeo); el grupo, solo el rumbo.
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  const blanco = new THREE.MeshStandardMaterial({ color: BLANCO, roughness: 0.45, metalness: 0.1 });
  const naranja = new THREE.MeshStandardMaterial({ color: NARANJA, roughness: 0.5 });
  const cristal = new THREE.MeshStandardMaterial({ color: 0x1d2a38, roughness: 0.15, metalness: 0.5 });
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bdc2, roughness: 0.35, metalness: 0.7 });

  // 1 · Lo blanco: fuselaje, ala, tirantes, cola y las patas.
  const ALA_Y = 2.12;
  const ala = new THREE.BoxGeometry(AVIONETA.envergadura, 0.16, 1.55);
  ala.translate(0, ALA_Y, 0.55);
  const blancas: THREE.BufferGeometry[] = [fuselaje(), ala];
  // Encima de la cabina, el ala se apoya en un «lomo».
  blancas.push(new THREE.BoxGeometry(1.1, 0.4, 1.9).translate(0, ALA_Y - 0.25, 0.7));
  for (const lado of [-1, 1]) {
    // Tirante del ala: del bajo del fuselaje a media ala.
    const desde = new THREE.Vector3(lado * 0.62, EJE - 0.35, 0.7);
    const hasta = new THREE.Vector3(lado * 2.7, ALA_Y - 0.08, 0.7);
    const largo = desde.distanceTo(hasta);
    const tirante = new THREE.CylinderGeometry(0.045, 0.045, largo, 6);
    tirante.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), hasta.clone().sub(desde).normalize()));
    tirante.translate((desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, (desde.z + hasta.z) / 2);
    blancas.push(tirante);
    // Pata del tren principal (de lámina, abierta hacia fuera).
    const pata = new THREE.BoxGeometry(0.1, 1, 0.22);
    pata.rotateZ(lado * 0.75);
    pata.translate(lado * 0.78, 0.68, 0.15);
    blancas.push(pata);
  }
  // Estabilizador horizontal y deriva (la aleta de la cola), con el borde de delante inclinado.
  blancas.push(new THREE.BoxGeometry(3.6, 0.08, 0.85).translate(0, EJE + 0.12, -AVIONETA.cola + 0.55));
  const deriva = new THREE.BoxGeometry(0.08, 1.4, 1.3);
  const pd = deriva.attributes.position!;
  for (let i = 0; i < pd.count; i++) {
    // Arriba, más estrecha y echada hacia atrás.
    if (pd.getY(i) > 0) pd.setZ(i, pd.getZ(i) * 0.55 - 0.45);
  }
  deriva.computeVertexNormals();
  deriva.translate(0, EJE + 0.85, -AVIONETA.cola + 0.65);
  blancas.push(deriva);
  // Pata del morro.
  blancas.push(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6).translate(0, 0.62, 2.9));
  const mallaBlanca = new THREE.Mesh(juntar(blancas), blanco);

  // 2 · La franja naranja a los lados, la punta de la deriva y las puntas de las alas.
  const naranjas: THREE.BufferGeometry[] = [];
  for (const lado of [-1, 1]) {
    naranjas.push(new THREE.BoxGeometry(0.04, 0.16, 6.4).translate(lado * 0.69, EJE - 0.05, -0.6));
    naranjas.push(new THREE.BoxGeometry(0.5, 0.17, 1.56).translate((lado * (AVIONETA.envergadura - 0.5)) / 2, ALA_Y, 0.55));
  }
  naranjas.push(new THREE.BoxGeometry(0.09, 0.3, 0.75).translate(0, EJE + 1.45, -AVIONETA.cola + 0.2));
  const mallaNaranja = new THREE.Mesh(juntar(naranjas), naranja);

  // 3 · Cristales: el parabrisas (inclinado) y las ventanillas de los lados.
  const cristales: THREE.BufferGeometry[] = [];
  const parabrisas = new THREE.BoxGeometry(1.0, 0.55, 0.05);
  parabrisas.rotateX(-0.95);
  parabrisas.translate(0, EJE + 0.62, 1.78);
  cristales.push(parabrisas);
  // Ventanilla de atrás (en los dos lados; la de la puerta va en la puerta).
  cristales.push(new THREE.BoxGeometry(0.05, 0.42, 0.7).translate(0.67, EJE + 0.42, 0.25));
  cristales.push(new THREE.BoxGeometry(0.05, 0.42, 0.7).translate(-0.67, EJE + 0.42, 0.25));
  cristales.push(new THREE.BoxGeometry(0.05, 0.42, 0.75).translate(0.69, EJE + 0.45, 1.15));
  const mallaCristal = new THREE.Mesh(juntar(cristales), cristal);

  // 4 · Ruedas (negras) con su tapa.
  const ruedas: THREE.BufferGeometry[] = [];
  const rueda = (x: number, z: number, r: number) => ruedas.push(new THREE.CylinderGeometry(r, r, 0.18, 14).rotateZ(Math.PI / 2).translate(x, r, z));
  rueda(-1.15, 0.15, 0.3);
  rueda(1.15, 0.15, 0.3);
  rueda(0, 2.9, 0.22);
  const mallaRuedas = new THREE.Mesh(juntar(ruedas), oscuro);

  // 5 · La puerta (lado derecho = −x): gira hacia fuera por su borde de delante.
  const bisagra = new THREE.Group();
  bisagra.position.set(-0.69, EJE + 0.25, 1.55);
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.95).translate(0, 0, -0.475), blanco);
  const ventanilla = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.7).translate(-0.005, 0.2, -0.45), cristal);
  const franjaPuerta = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.95).translate(-0.005, -0.3, -0.475), naranja);
  bisagra.add(hoja, ventanilla, franjaPuerta);

  // 6 · Hélice: el cono del morro y dos palas, que giran alrededor de z.
  const helice = new THREE.Group();
  helice.position.set(0, EJE, AVIONETA.morro + 0.05);
  const cono = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 14).rotateX(Math.PI / 2).translate(0, 0, 0.16), metal);
  const palas = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.95, 0.04).translate(0, 0, 0.05), oscuro);
  helice.add(cono, palas);

  for (const m of [mallaBlanca, mallaNaranja, mallaCristal, mallaRuedas, hoja, palas]) m.castShadow = true;
  cuerpo.add(mallaBlanca, mallaNaranja, mallaCristal, mallaRuedas, bisagra, helice);

  let giroHelice = 0;
  return {
    grupo,
    colocar(p, dt) {
      grupo.position.set(p.x, p.y, p.z);
      grupo.rotation.y = p.rumbo;
      // Morro arriba = girar al revés en x (el morro mira a +z); alabeo a la derecha = +z.
      cuerpo.rotation.set(-p.cabeceo, 0, p.alabeo, 'YXZ');
      // Al levantar el morro, que no se meta la cola en el suelo: gira sobre las ruedas de atrás.
      cuerpo.position.set(0, Math.max(p.cabeceo, 0) * 0.2, 0);
      bisagra.rotation.y = -p.puerta * 1.25;
      // Con el motor a tope, ~25 vueltas por segundo (se ve borrosa igual que en la realidad).
      giroHelice += dt * p.motor * 160;
      helice.rotation.z = giroHelice;
    },
  };
}

/* ---------- El aeródromo de la cima ---------- */

/** La pista de la cima (nieve pisada, algo más gris), los conos y la manga de viento. */
export function crearAerodromo(l: Ladera): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'aerodromo';
  const e = ejes(l);
  const giro = Math.atan2(e.nx, e.nz); // +z local = hacia la montaña (como en montana.ts)
  const d0 = dPista(l);
  const ANCHO = 9;
  const desde = AERODROMO.u - 10;
  const hasta = AERODROMO.u + AERODROMO.largoPista;
  // Marco local de la pista: z = d y x = −u (girar +z hacia N deja +x hacia −T).
  const marco = new THREE.Group();
  marco.rotation.y = giro;
  grupo.add(marco);
  const pista = new THREE.Mesh(
    new THREE.PlaneGeometry(hasta - desde, ANCHO).rotateX(-Math.PI / 2).translate(-(desde + hasta) / 2, l.rellano + 0.1, d0),
    new THREE.MeshStandardMaterial({ color: 0xc5d2de, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  pista.receiveShadow = true;
  marco.add(pista);
  // Conos naranjas a los dos lados, cada 10 m.
  const n = Math.floor((hasta - desde) / 10) + 1;
  const conos = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.6, 8).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ color: NARANJA, roughness: 0.6 }), n * 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    for (const lado of [-1, 1]) {
      conos.setMatrixAt(i * 2 + (lado > 0 ? 1 : 0), m.makeTranslation(-(desde + i * 10), l.rellano + 0.1, d0 + (lado * ANCHO) / 2));
    }
  }
  conos.castShadow = true;
  conos.instanceMatrix.needsUpdate = true;
  conos.computeBoundingSphere();
  marco.add(conos);

  // La manga de viento: un mástil y un cono de franjas naranjas y blancas que apunta a favor del viento (a lo largo de la cara).
  // Detrás de la bandera (u < 0): así no se cruza con la cámara del despegue.
  const sitio = aMundo(l, d0 + 4.5, -14);
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6).translate(0, 2.25, 0), new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.5, roughness: 0.4 }));
  mastil.position.set(sitio.x, l.rellano, sitio.z);
  const manga = new THREE.Group();
  manga.position.set(sitio.x, l.rellano + 4.4, sitio.z);
  manga.rotation.y = Math.atan2(e.tx, e.tz);
  const franjas = [NARANJA, 0xffffff, NARANJA, 0xffffff, NARANJA].map((color, i) => {
    const r0 = 0.32 - i * 0.045;
    const trozo = new THREE.Mesh(
      new THREE.CylinderGeometry(r0 - 0.045, r0, 0.42, 12, 1, true).rotateX(Math.PI / 2).translate(0, -i * 0.04, 0.25 + i * 0.42),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }),
    );
    return trozo;
  });
  manga.add(...franjas);
  grupo.add(mastil, manga);
  return grupo;
}

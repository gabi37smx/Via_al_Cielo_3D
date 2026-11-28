/*
 * El escenario del tramo 4: VALENCIA, la Ciudad de las Artes y las Ciencias
 * (idea I9). Dibuja lo que calcula reglas/valencia.ts:
 *
 * - El JARDÍN DEL TURIA (césped y palmeras) con la PISTA donde aterriza la
 *   avioneta (asfalto con sus marcas).
 * - El PASEO entre dos ESTANQUES de agua turquesa con bordillo blanco; en el
 *   de la izquierda, el HEMISFÈRIC (el «ojo»: un párpado de cristal con
 *   costillas blancas).
 * - El MUSEU DE LES CIÈNCIES a la derecha (fachada de cristal con su fila de
 *   «árboles» blancos) y el UMBRACLE a la izquierda (arcos blancos y palmeras).
 * - La PLAZA con la SENYERA, y el PALAU DE LES ARTS agrandado hasta 220 m:
 *   el casco interior de cristal, las dos CÁSCARAS blancas de trencadís
 *   (azulejo roto) que lo envuelven y la PLUMA encima, que vuela por delante.
 * - Alrededor, la ciudad (bloques de colores cálidos), el mar detrás y un
 *   cielo mediterráneo.
 *
 * Todo hecho por código con formas sencillas: nada que descargar ni acreditar.
 * Inspirado en los edificios de verdad (de Santiago Calatrava), no copiado:
 * proporciones de juego. Lo que se pisa y lo que choca sale solo de
 * reglas/valencia.ts; esto solo dibuja. Pocas llamadas de dibujo.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearAzar, entre } from '../reglas/azar.ts';
import {
  BORDES_VALENCIA,
  CENTRO_VALENCIA,
  ESTANQUES,
  HEMISFERIC,
  MUSEU,
  PALAU,
  PISTA_VALENCIA,
  SENYERA,
  SUELO_VALENCIA,
  type Rectangulo,
} from '../reglas/valencia.ts';
import { crearTexturaRoca, materialRoca } from './texturas.ts';

function juntar(piezas: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(piezas.map((g) => (g.index ? g.toNonIndexed() : g)));
}

/** Un plano horizontal que cubre un rectángulo, a la altura `y`. */
function losa(r: Rectangulo, y: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0);
  g.rotateX(-Math.PI / 2);
  g.translate((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  // Que la textura no se estire: coordenadas de textura en metros / 8.
  const uv = g.attributes.uv!;
  const pos = g.attributes.position!;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 8, pos.getZ(i) / 8);
  return g;
}

/** Material que se pinta encima del suelo sin parpadear (sin «z-fighting»). */
function encima<T extends THREE.Material>(m: T, capa = 1): T {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -capa;
  m.polygonOffsetUnits = -capa;
  return m;
}

/* ---------- Texturas pintadas ---------- */

/** El trencadís: azulejo blanco roto en trozos irregulares, con las juntas grises. */
function texturaTrencadis(): THREE.CanvasTexture {
  const tam = 512;
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = tam;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#d3d8dc';
  ctx.fillRect(0, 0, tam, tam);
  const azar = crearAzar(4401);
  // Trozos: polígonos de 5-7 lados alrededor de una rejilla torcida.
  const CELDA = 32;
  for (let y = -1; y <= tam / CELDA; y++) {
    for (let x = -1; x <= tam / CELDA; x++) {
      const cx = (x + 0.5 + entre(azar, -0.25, 0.25)) * CELDA;
      const cy = (y + 0.5 + entre(azar, -0.25, 0.25)) * CELDA;
      const lados = 5 + Math.floor(azar() * 3);
      const tono = Math.floor(entre(azar, 236, 252));
      ctx.fillStyle = `rgb(${tono},${tono},${Math.min(tono + 3, 255)})`;
      ctx.beginPath();
      for (let k = 0; k < lados; k++) {
        const a = (k / lados) * Math.PI * 2 + entre(azar, -0.2, 0.2);
        const r = CELDA * entre(azar, 0.42, 0.62);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(lienzo);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Fachada con ventanas: 4 × 4 casillas (una ventana por planta), la pared
 * blanca (el color de cada edificio la tiñe) y ventanas distintas: cristal
 * con reflejo, persiana bajada, alguna con balcón. Cada casilla es 4 m de
 * ancho y 3,2 m de alto (una planta), así todas las ventanas miden lo mismo.
 */
const VENTANA = { ancho: 4, alto: 3.2, casillas: 4 } as const;
function texturaVentanas(): THREE.CanvasTexture {
  const C = 64;
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = C * VENTANA.casillas;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  const azar = crearAzar(4404);
  for (let fila = 0; fila < VENTANA.casillas; fila++) {
    for (let col = 0; col < VENTANA.casillas; col++) {
      const x = col * C + 14;
      const y = fila * C + 12;
      const w = C - 28;
      const h = C - 26;
      if (azar() < 0.22) {
        // Persiana bajada (de lamas, verde o crema).
        ctx.fillStyle = azar() < 0.5 ? '#7d9a6a' : '#d9c7a0';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let k = 3; k < h; k += 4) ctx.fillRect(x, y + k, w, 1);
      } else {
        // Cristal: oscuro abajo, con el cielo reflejado arriba, y el marco del medio.
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#8fb2cc');
        g.addColorStop(1, '#2c3f52');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(x + w / 2 - 1, y, 2, h);
      }
      // Alféizar, y a veces un balcón con barandilla.
      ctx.fillStyle = '#cfc9bf';
      ctx.fillRect(x - 3, y + h, w + 6, 3);
      if (azar() < 0.3) {
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(x - 5, y + h - 12, w + 10, 2);
        for (let k = x - 5; k <= x + w + 5; k += 4) ctx.fillRect(k, y + h - 12, 1, 12);
      }
    }
  }
  const t = new THREE.CanvasTexture(lienzo);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Cristal con su perfilería: paños con reflejo y los marcos claros (`columnas` × `filas` paños). */
function texturaCristal(columnas: number, filas: number, base: string, reflejo: string): THREE.CanvasTexture {
  const tam = 256;
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = tam;
  const ctx = lienzo.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, tam, tam);
  g.addColorStop(0, reflejo);
  g.addColorStop(0.55, base);
  g.addColorStop(1, reflejo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, tam, tam);
  ctx.fillStyle = '#eef1f3';
  for (let i = 0; i <= columnas; i++) ctx.fillRect((i * tam) / columnas - 2, 0, 4, tam);
  for (let i = 0; i <= filas; i++) ctx.fillRect(0, (i * tam) / filas - 2, tam, 4);
  const t = new THREE.CanvasTexture(lienzo);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** La senyera: cuatro barras rojas sobre amarillo y la franja azul con la corona junto al mástil. */
function texturaSenyera(): THREE.CanvasTexture {
  const lienzo = document.createElement('canvas');
  lienzo.width = 300;
  lienzo.height = 200;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#fcdd09';
  ctx.fillRect(0, 0, 300, 200);
  ctx.fillStyle = '#da121a';
  for (let i = 0; i < 4; i++) ctx.fillRect(0, (200 / 9) * (i * 2 + 1), 300, 200 / 9);
  ctx.fillStyle = '#0f47af';
  ctx.fillRect(0, 0, 70, 200);
  // La corona, sencilla: una base y tres puntas doradas.
  ctx.fillStyle = '#fcdd09';
  ctx.fillRect(18, 108, 34, 10);
  ctx.beginPath();
  ctx.moveTo(18, 108);
  ctx.lineTo(20, 84);
  ctx.lineTo(28, 98);
  ctx.lineTo(35, 80);
  ctx.lineTo(42, 98);
  ctx.lineTo(50, 84);
  ctx.lineTo(52, 108);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Suelo: jardín, pista, paseo y plaza ---------- */

/** Lo pavimentado queda un pelo por encima del césped (m). */
const ALTO_PAVIMENTO = 0.04;

function crearSuelo(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'suelo-valencia';
  // El césped, enorme (hasta donde empieza la ciudad).
  const cesped = crearTexturaRoca({ oscuro: '#5d8f3f', claro: '#94c062', semilla: 31, relieve: 1 });
  const jardin = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500).rotateX(-Math.PI / 2), materialRoca(cesped, 420, 420));
  jardin.receiveShadow = true;
  grupo.add(jardin);

  // Lo pavimentado (piedra clara): el paseo entre los estanques, la plaza del
  // Palau, la explanada donde se para la avioneta y un camino alrededor del Palau.
  // Unos centímetros por encima del césped: en el mismo plano, mirando
  // de lado, el césped se colaba por encima (no se nota en los pies).
  const piedra = crearTexturaRoca({ oscuro: '#ddd6c8', claro: '#f6f3ec', semilla: 37, relieve: 1 });
  const plaza = Math.max(...ESTANQUES.map((e) => e.x1));
  const pavimento = [
    losa({ x0: plaza - 2, x1: 40, z0: -95, z1: 95 }, ALTO_PAVIMENTO),
    losa({ x0: PISTA_VALENCIA.parada - 14, x1: plaza - 2, z0: -78, z1: 78 }, ALTO_PAVIMENTO),
  ];
  const suelo = new THREE.Mesh(juntar(pavimento), encima(materialRoca(piedra, 1, 1), 1));
  suelo.receiveShadow = true;
  grupo.add(suelo);

  // La pista: asfalto con la raya del centro, el umbral (franjas) y los números.
  const asfalto = crearTexturaRoca({ oscuro: '#4a4d52', claro: '#6e7277', semilla: 41, relieve: 1 });
  const P = PISTA_VALENCIA;
  const pista = new THREE.Mesh(losa({ x0: P.desde, x1: P.hasta, z0: -P.ancho / 2, z1: P.ancho / 2 }, ALTO_PAVIMENTO + 0.02), encima(materialRoca(asfalto, 1, 1), 2));
  pista.receiveShadow = true;
  const marcas: THREE.BufferGeometry[] = [];
  const yMarcas = ALTO_PAVIMENTO + 0.04;
  for (let x = P.desde + 40; x < P.parada - 12; x += 12) marcas.push(losa({ x0: x, x1: x + 6, z0: -0.2, z1: 0.2 }, yMarcas));
  for (let k = -2; k <= 2; k++) marcas.push(losa({ x0: P.desde + 6, x1: P.desde + 26, z0: k * 1.3 - 0.4, z1: k * 1.3 + 0.4 }, yMarcas));
  for (const lado of [-1, 1]) marcas.push(losa({ x0: P.desde, x1: P.hasta, z0: lado * (P.ancho / 2 - 0.5) - 0.15, z1: lado * (P.ancho / 2 - 0.5) + 0.15 }, yMarcas));
  const mallaMarcas = new THREE.Mesh(juntar(marcas), encima(new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 }), 3));
  grupo.add(pista, mallaMarcas);
  return grupo;
}

/* ---------- Estanques ---------- */

function crearEstanques(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'estanques';
  const BORDE = 0.7;
  const ALTO = 0.55;
  const bordillos: THREE.BufferGeometry[] = [];
  const aguas: THREE.BufferGeometry[] = [];
  for (const e of ESTANQUES) {
    const largo = e.x1 - e.x0;
    const ancho = e.z1 - e.z0;
    const cx = (e.x0 + e.x1) / 2;
    const cz = (e.z0 + e.z1) / 2;
    bordillos.push(new THREE.BoxGeometry(largo + BORDE, ALTO, BORDE).translate(cx, ALTO / 2, e.z0));
    bordillos.push(new THREE.BoxGeometry(largo + BORDE, ALTO, BORDE).translate(cx, ALTO / 2, e.z1));
    bordillos.push(new THREE.BoxGeometry(BORDE, ALTO, ancho).translate(e.x0, ALTO / 2, cz));
    bordillos.push(new THREE.BoxGeometry(BORDE, ALTO, ancho).translate(e.x1, ALTO / 2, cz));
    aguas.push(losa(e, 0.3));
  }
  const bordillo = new THREE.Mesh(juntar(bordillos), new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.6 }));
  bordillo.receiveShadow = true;
  bordillo.castShadow = true;
  // Agua turquesa, casi un espejo (refleja el sol), con un poco de luz propia para que no salga oscura.
  const agua = new THREE.Mesh(juntar(aguas), new THREE.MeshStandardMaterial({ color: 0x2fb3c6, emissive: 0x0b5866, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.15 }));
  agua.receiveShadow = true;
  grupo.add(bordillo, agua);
  return grupo;
}

/* ---------- El Hemisfèric ---------- */

/** El «ojo»: un párpado de cristal en forma de almendra con costillas blancas, sobre su estanque. */
function crearHemisferic(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'hemisferic';
  const H = HEMISFERIC;
  grupo.position.set(H.x, 0.3, H.z);
  // Media esfera estirada; las puntas se afinan (almendra) al apretar y-z hacia los extremos.
  const almendra = (escala: number) => {
    const g = new THREE.SphereGeometry(1, 48, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = g.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const f = Math.pow(Math.max(1 - x * x, 0), 0.35);
      p.setXYZ(i, (x * H.largo * escala) / 2, p.getY(i) * f * H.alto * escala, p.getZ(i) * f * (H.ancho * escala) / 2);
    }
    g.computeVertexNormals();
    return g;
  };
  const cristal = new THREE.Mesh(almendra(1), new THREE.MeshStandardMaterial({ color: 0x5f7f97, roughness: 0.12, metalness: 0.6 }));
  // Costillas: arcos blancos a lo largo, un pelo por fuera del cristal.
  const costillas: THREE.BufferGeometry[] = [];
  const N = 15;
  for (let i = 1; i < N; i++) {
    const t = (i / N) * 2 - 1; // −1..1 a lo largo
    const f = Math.pow(1 - t * t, 0.35);
    const arco = new THREE.TorusGeometry(1, 0.012, 4, 24, Math.PI);
    arco.rotateY(Math.PI / 2); // el arco en el plano y-z
    arco.scale(1, f * H.alto * 1.01, (f * H.ancho * 1.01) / 2);
    arco.translate((t * H.largo) / 2, 0, 0);
    costillas.push(arco);
  }
  // El borde de hormigón blanco alrededor (la «ceja»), a ras del agua.
  const ceja = new THREE.TorusGeometry(1, 0.03, 6, 48);
  ceja.rotateX(Math.PI / 2);
  ceja.scale(H.largo / 2 + 0.6, 6, H.ancho / 2 + 0.6);
  costillas.push(ceja);
  const blanco = new THREE.Mesh(juntar(costillas), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 }));
  grupo.add(cristal, blanco);
  return grupo;
}

/* ---------- El Museu de les Ciències y el Umbracle ---------- */

function crearMuseu(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'museu';
  const M = MUSEU;
  const largo = M.x1 - M.x0;
  const fondo = M.z1 - M.z0;
  const ALTO = 44;
  const cx = (M.x0 + M.x1) / 2;
  // El cuerpo blanco, más bajo por detrás, y la fachada de cristal (mira a la pista: −z).
  const blancas: THREE.BufferGeometry[] = [new THREE.BoxGeometry(largo, ALTO * 0.8, fondo * 0.6).translate(cx, ALTO * 0.4, M.z1 - fondo * 0.3)];
  // Cristal con su perfilería: paños de 3 × 4 m (la textura trae 4 × 4 paños).
  const vidrio = texturaCristal(4, 4, '#4f6b80', '#9cb9cc');
  vidrio.repeat.set((largo - 6) / 12, (ALTO - 4) / 16);
  const cristal = new THREE.Mesh(
    new THREE.BoxGeometry(largo - 6, ALTO - 4, 1).translate(cx, (ALTO - 4) / 2, M.z0 + 7),
    new THREE.MeshStandardMaterial({ map: vidrio, roughness: 0.15, metalness: 0.2 }),
  );
  // Los «árboles»: columnas blancas que se abren en Y al llegar arriba, delante del cristal.
  const SEPARACION = 12;
  for (let x = M.x0 + 6; x <= M.x1 - 6; x += SEPARACION) {
    const tronco = new THREE.CylinderGeometry(0.9, 1.6, ALTO - 12, 8).translate(x, (ALTO - 12) / 2, M.z0 + 3);
    blancas.push(tronco);
    for (const lado of [-1, 1]) {
      const rama = new THREE.CylinderGeometry(0.5, 0.9, 15, 6);
      rama.rotateZ(lado * 0.42);
      rama.translate(x - lado * 3, ALTO - 6, M.z0 + 3);
      blancas.push(rama);
    }
  }
  // El tejado: una viga blanca a lo largo y costillas que cruzan.
  blancas.push(new THREE.BoxGeometry(largo, 1.6, fondo).translate(cx, ALTO, (M.z0 + M.z1) / 2));
  for (let x = M.x0 + 3; x <= M.x1 - 3; x += 6) blancas.push(new THREE.BoxGeometry(1, 3, fondo + 2).translate(x, ALTO + 1.5, (M.z0 + M.z1) / 2));
  const blanco = new THREE.Mesh(juntar(blancas), new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.55 }));
  blanco.castShadow = true;
  grupo.add(cristal, blanco);
  return grupo;
}

/** El Umbracle: dos filas de arcos blancos altos (un paseo con sombra) a la izquierda de la pista. */
function crearUmbracle(): THREE.InstancedMesh {
  const arco = new THREE.TorusGeometry(7, 0.35, 6, 20, Math.PI);
  arco.rotateY(Math.PI / 2); // el arco cruza de lado (en z)
  arco.scale(1, 2.2, 1);
  const N = 32;
  const arcos = new THREE.InstancedMesh(arco, new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 }), N);
  const m = new THREE.Matrix4();
  for (let i = 0; i < N; i++) arcos.setMatrixAt(i, m.makeTranslation(PISTA_VALENCIA.desde + 30 + i * 8, 0, BORDES_VALENCIA.z0 + 9));
  arcos.instanceMatrix.needsUpdate = true;
  arcos.computeBoundingSphere();
  arcos.castShadow = true;
  arcos.name = 'umbracle';
  return arcos;
}

/* ---------- Palmeras ---------- */

function crearPalmeras(): THREE.Group {
  const azar = crearAzar(4402);
  const sitios: { x: number; z: number }[] = [];
  const P = PISTA_VALENCIA;
  // A los dos lados de la pista, bajo el Umbracle y en la plaza del Palau.
  for (let x = P.desde + 10; x < P.parada - 20; x += 22) {
    sitios.push({ x, z: -P.ancho / 2 - 9 }, { x: x + 11, z: P.ancho / 2 + 9 });
  }
  for (let x = P.desde + 34; x < P.desde + 34 + 31 * 8; x += 16) sitios.push({ x, z: BORDES_VALENCIA.z0 + 9 });
  for (const z of [-26, -40, -54, 26, 40, 54, 70, -70]) sitios.push({ x: -6, z });
  const N = sitios.length;
  // Tronco algo curvado (un cilindro torcido) y la copa: hojas largas que cuelgan.
  const tronco = new THREE.CylinderGeometry(0.22, 0.32, 9, 7, 6).translate(0, 4.5, 0);
  const pt = tronco.attributes.position!;
  for (let i = 0; i < pt.count; i++) pt.setX(i, pt.getX(i) + (pt.getY(i) / 9) ** 2 * 0.7);
  tronco.computeVertexNormals();
  const hojas: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) {
    const hoja = new THREE.ConeGeometry(0.45, 4.2, 4, 1);
    hoja.scale(1, 1, 0.25);
    hoja.translate(0, 2.1, 0);
    hoja.rotateX(1.9); // tumbada y cayendo
    hoja.rotateY((k / 9) * Math.PI * 2);
    hoja.translate(0.7, 9, 0);
    hojas.push(hoja);
  }
  const troncos = new THREE.InstancedMesh(tronco, new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 }), N);
  const copas = new THREE.InstancedMesh(juntar(hojas), new THREE.MeshStandardMaterial({ color: 0x4a8a3c, emissive: 0x1c3a16, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  sitios.forEach((sitio, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), azar() * Math.PI * 2);
    const t = entre(azar, 0.85, 1.25);
    s.set(t, t, t);
    m.compose(p.set(sitio.x, 0, sitio.z), q, s);
    troncos.setMatrixAt(i, m);
    copas.setMatrixAt(i, m);
  });
  const grupo = new THREE.Group();
  grupo.name = 'palmeras';
  for (const im of [troncos, copas]) {
    im.castShadow = true;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    grupo.add(im);
  }
  return grupo;
}

/* ---------- El Palau de les Arts ---------- */

/**
 * El Palau, agrandado hasta 220 m. Su frente (por donde se subirá) mira a la
 * pista (−X). Tres partes: el casco interior (cristal), dos cáscaras blancas
 * de trencadís (una a cada lado, abiertas por delante y por detrás) y la
 * pluma, una hoja blanca curva encima que vuela por delante del edificio.
 */
function crearPalau(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = 'palau';
  const P = PALAU;
  /** Centro de las elipses: por encima del suelo (así el pie es casi tan ancho como lo más ancho). */
  const CENTRO_Y = 30;
  /** Una elipse de alto `ry` (desde CENTRO_Y) que en el suelo mide (rx, rz): sus radios de verdad. */
  const radios = (rx: number, rz: number, ry: number) => {
    const k = Math.sqrt(1 - (CENTRO_Y / ry) ** 2);
    return { rx: rx / k, rz: rz / k, ry, k };
  };
  // El casco interior: un huevo de cristal azulado; su morro (en el suelo) es el frente.
  // Más bajo que las cáscaras: por fuera manda el blanco y el cristal asoma por delante.
  const rc = radios(P.casco.rx, P.casco.rz, 115);
  // Paños de unos 5 × 5 m: la esfera da la vuelta (u) y sube (v) con la textura repetida.
  const cascoCristal = texturaCristal(4, 4, '#b8d0de', '#e6f0f5');
  cascoCristal.repeat.set(70, 16);
  const casco = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24).scale(rc.rx, rc.ry, rc.rz).translate(P.x, CENTRO_Y, P.z),
    new THREE.MeshStandardMaterial({ map: cascoCristal, emissive: 0x2a4352, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0 }),
  );
  // Las cáscaras: trozos de una elipse mayor (arriba, a 220 m), una a cada
  // lado, abiertas por delante (desde `cascaras.desde`) y un poco por detrás.
  const rk = radios(P.cascaras.rx, P.cascaras.rz, P.alto - CENTRO_Y);
  const thetaSuelo = Math.acos(-CENTRO_Y / rk.ry);
  // En la esfera de Three.js x = −cos(φ)·sen(θ): el frente (−X) es φ pequeño.
  const phiDelante = Math.acos((P.x - P.cascaras.desde) / P.cascaras.rx);
  const phiDetras = 0.9 * Math.PI;
  const cascaras: THREE.BufferGeometry[] = [];
  for (const [desde, hasta] of [
    [phiDelante, phiDetras],
    [2 * Math.PI - phiDetras, 2 * Math.PI - phiDelante],
  ] as const) {
    const g = new THREE.SphereGeometry(1, 64, 32, desde, hasta - desde, 0, thetaSuelo);
    g.scale(rk.rx, rk.ry, rk.rz);
    g.translate(P.x, CENTRO_Y, P.z);
    cascaras.push(g);
  }
  const trencadis = texturaTrencadis();
  trencadis.repeat.set(26, 16);
  const cascara = new THREE.Mesh(juntar(cascaras), new THREE.MeshStandardMaterial({ map: trencadis, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }));
  cascara.castShadow = true;
  cascara.receiveShadow = true;

  // La pluma: una hoja curva (de perfil, en el plano x-y) de 7 m de grueso que
  // sale de lo alto de detrás, pasa por encima y vuela por delante del frente.
  const forma = new THREE.Shape();
  const atras = P.x + P.casco.rx * 0.55;
  const delante = P.x - P.casco.rx - 45;
  forma.moveTo(atras, P.alto - 22);
  forma.bezierCurveTo(atras - 60, P.alto + 24, P.x - 40, P.alto + 22, delante, P.alto - 8);
  forma.bezierCurveTo(P.x - 60, P.alto + 4, atras - 70, P.alto + 4, atras, P.alto - 22);
  // Algo girada (y más gruesa): de frente, que se vea como una hoja y no como una antena.
  const pluma = new THREE.Mesh(
    new THREE.ExtrudeGeometry(forma, { depth: 14, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 48 })
      .translate(-P.x, 0, P.z - 7)
      .rotateY(0.2)
      .translate(P.x, 0, 0),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.35, metalness: 0.15 }),
  );
  pluma.castShadow = true;

  // La base: un zócalo de piedra clara alrededor del pie.
  const zocalo = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1.2, 64).scale(P.casco.rx + 4, 1, P.cascaras.rz + 4).translate(P.x, 0.6, P.z),
    new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.8 }),
  );
  zocalo.receiveShadow = true;
  grupo.add(casco, cascara, pluma, zocalo);
  return grupo;
}

/* ---------- La senyera ---------- */

function crearSenyera(): { grupo: THREE.Group; ondear(t: number): void } {
  const grupo = new THREE.Group();
  grupo.name = 'senyera';
  grupo.position.set(SENYERA.x, 0, SENYERA.z);
  const ALTO = 14;
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, ALTO, 8).translate(0, ALTO / 2, 0), new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.6, roughness: 0.35 }));
  mastil.castShadow = true;
  const ANCHO = 4.5;
  const geo = new THREE.PlaneGeometry(ANCHO, 3, 16, 4).translate(ANCHO / 2, 0, 0);
  const base = Float32Array.from(geo.attributes.position!.array);
  const tela = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texturaSenyera(), side: THREE.DoubleSide, roughness: 0.8 }));
  tela.position.set(0.1, ALTO - 1.8, 0);
  // De cara a quien llega por el paseo (mira hacia −X): el plano en z = cte.
  tela.rotation.y = -Math.PI / 2;
  grupo.add(mastil, tela);
  return {
    grupo,
    ondear(t) {
      const p = geo.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3]!;
        p.setZ(i, Math.sin(x * 1.4 - t * 4) * 0.18 * (x / ANCHO));
      }
      p.needsUpdate = true;
    },
  };
}

/* ---------- La ciudad, el mar y el cielo ---------- */

/**
 * La ciudad alrededor: bloques de pisos de colores cálidos con VENTANAS por
 * plantas (las coordenadas de textura van en metros: cada ventana mide lo
 * mismo, sea el edificio alto o bajo) y algo en el tejado (la caseta de la
 * escalera, depósitos). Todos juntos en una sola malla: una llamada de dibujo.
 */
function crearCiudad(): THREE.Mesh {
  const azar = crearAzar(4403);
  const N = 320;
  const colores = [0xe6d2ad, 0xf2eee6, 0xd39a6f, 0xeedc9a, 0xe7c8b8, 0xc9b79c].map((c) => new THREE.Color(c));
  const piezas: THREE.BufferGeometry[] = [];
  const anchoTextura = VENTANA.ancho * VENTANA.casillas;
  const altoTextura = VENTANA.alto * VENTANA.casillas;
  /** Una caja con la textura en metros en los lados y lisa (pared) arriba y abajo. */
  const caja = (w: number, h: number, d: number, color: THREE.Color, conVentanas: boolean) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv!;
    // Caras de BoxGeometry, 4 vértices cada una: +x, −x, +y, −y, +z, −z.
    for (let cara = 0; cara < 6; cara++) {
      const ancho = cara < 2 ? d : w;
      for (let k = 0; k < 4; k++) {
        const i = cara * 4 + k;
        if (cara === 2 || cara === 3 || !conVentanas) uv.setXY(i, 0.01, 0.01); // la esquina de la casilla es pared
        else uv.setXY(i, (uv.getX(i) * ancho) / anchoTextura, (uv.getY(i) * h) / altoTextura);
      }
    }
    const c = new Float32Array(uv.count * 3);
    for (let i = 0; i < uv.count; i++) c.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eje = new THREE.Vector3(0, 1, 0);
  const uno = new THREE.Vector3(1, 1, 1);
  let puestos = 0;
  for (let intento = 0; puestos < N && intento < N * 10; intento++) {
    const x = entre(azar, -760, 760);
    const z = entre(azar, -760, 760);
    // Fuera del jardín (y del mar, que está detrás de la pista).
    if (x > BORDES_VALENCIA.x0 - 60 && x < BORDES_VALENCIA.x1 + 80 && z > BORDES_VALENCIA.z0 - 70 && z < BORDES_VALENCIA.z1 + 70) continue;
    if (x < -700) continue;
    // Medidas en ventanas y plantas enteras: las ventanas quedan alineadas con las esquinas.
    const w = VENTANA.ancho * Math.round(entre(azar, 4, 10));
    const d = VENTANA.ancho * Math.round(entre(azar, 4, 10));
    const h = VENTANA.alto * Math.round(entre(azar, 4, 20));
    const color = colores[Math.floor(azar() * colores.length)]!;
    const edificio = caja(w, h, d, color, true).translate(0, h / 2, 0);
    // En el tejado: la caseta de la escalera y a veces un depósito gris.
    const tejado = [caja(w * 0.25, 3, d * 0.2, color, false).translate(w * entre(azar, -0.25, 0.25), h + 1.5, d * entre(azar, -0.25, 0.25))];
    if (azar() < 0.5) tejado.push(caja(3, 2.4, 3, new THREE.Color(0x9a9ea3), false).translate(-w * 0.3, h + 1.2, d * 0.3));
    q.setFromAxisAngle(eje, Math.round(azar() * 3) * (Math.PI / 2) + entre(azar, -0.1, 0.1));
    m.compose(new THREE.Vector3(x, 0, z), q, uno);
    for (const g of [edificio, ...tejado]) piezas.push(g.applyMatrix4(m));
    puestos++;
  }
  const bloques = new THREE.Mesh(mergeGeometries(piezas), new THREE.MeshStandardMaterial({ map: texturaVentanas(), vertexColors: true, roughness: 0.85 }));
  bloques.name = 'ciudad';
  return bloques;
}

function crearMar(): THREE.Mesh {
  const mar = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 3000).rotateX(-Math.PI / 2).translate(-1300, -0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a7fb0, roughness: 0.2, metalness: 0.2 }),
  );
  mar.name = 'mar';
  return mar;
}

/** Cielo mediterráneo: azul intenso arriba y una bruma cálida en el horizonte. Va con la cámara. */
function crearCielo(): THREE.Mesh {
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(800, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: { arriba: { value: new THREE.Color(0x2f86d6) }, horizonte: { value: new THREE.Color(0xf4e7d2) } },
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
          gl_FragColor = vec4(mix(horizonte, arriba, smoothstep(-0.02, 0.5, vAltura)), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  cielo.name = 'cielo-valencia';
  cielo.renderOrder = -1;
  cielo.frustumCulled = false;
  return cielo;
}

/* ---------- Todo junto ---------- */

export interface EscenarioValencia {
  grupo: THREE.Group;
  /** En cada fotograma: el cielo va con la cámara y la senyera ondea. */
  actualizar(t: number, camara: THREE.Vector3): void;
}

export function crearValencia(): EscenarioValencia {
  const grupo = new THREE.Group();
  grupo.name = 'valencia';
  grupo.position.set(CENTRO_VALENCIA.x, SUELO_VALENCIA, CENTRO_VALENCIA.z);
  const cielo = crearCielo();
  const senyera = crearSenyera();
  grupo.add(cielo, crearSuelo(), crearEstanques(), crearHemisferic(), crearMuseu(), crearUmbracle(), crearPalmeras(), crearPalau(), senyera.grupo, crearCiudad(), crearMar());
  return {
    grupo,
    actualizar(t, camara) {
      if (!grupo.visible) return;
      cielo.position.set(camara.x - grupo.position.x, camara.y - grupo.position.y, camara.z - grupo.position.z);
      senyera.ondear(t);
    },
  };
}

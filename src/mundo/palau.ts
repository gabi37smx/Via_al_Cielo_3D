/*
 * La subida del Palau de les Arts (tramo 4) que se ve: los SALIENTES naranjas
 * de trencadís (como las presas naranjas de Valencia en el 2D) que salen de
 * la cáscara, y arriba el MIRADOR con su barandilla y una senyera.
 * Lo que se pisa y lo que choca sale solo de reglas/palau.ts; esto solo
 * dibuja. Va dentro del grupo de Valencia (marco de Valencia, y = 0 el suelo).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MIRADOR, PALAU, SUELO_PALAU, Z_MIRADOR, zCara, zInterior, type Palau } from '../reglas/palau.ts';
import { crearTexturaTrencadis } from './texturas.ts';
import { crearSenyera } from './valencia.ts';

/** Una caja con las coordenadas de textura en metros (/4): los trozos de azulejo miden lo mismo en todas. */
function caja(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv!;
  for (let cara = 0; cara < 6; cara++) {
    const [a, b] = cara < 2 ? [d, h] : cara < 4 ? [w, d] : [w, h];
    for (let k = 0; k < 4; k++) {
      const i = cara * 4 + k;
      uv.setXY(i, (uv.getX(i) * a) / 4, (uv.getY(i) * b) / 4);
    }
  }
  return g.toNonIndexed();
}

export function crearSubidaPalau(p: Palau): { grupo: THREE.Group; ondear(t: number): void } {
  const grupo = new THREE.Group();
  grupo.name = 'subida-palau';
  const naranja = crearTexturaTrencadis({ junta: '#b85e10', oscuro: '#f07a00', claro: '#ffa53a', semilla: 4410 });
  const claro = crearTexturaTrencadis({ junta: '#d98a3a', oscuro: '#ffad4d', claro: '#ffd08a', semilla: 4411 });

  // Los salientes: el cuerpo naranja y, encima, una capa más clara (lo que se pisa, que se vea de un vistazo).
  const cuerpos: THREE.BufferGeometry[] = [];
  const caras: THREE.BufferGeometry[] = [];
  for (const s of p.salientes) {
    const h = s.y - SUELO_PALAU;
    const dentro = zInterior(s);
    // Se mete medio metro en la cáscara (en las puntas la cáscara se curva y quedaría una rendija).
    const metido = 0.5 + Math.max(zCara(s.u, h) - Math.min(zCara(s.u - s.ancho / 2, h), zCara(s.u + s.ancho / 2, h)), 0);
    const fondo = s.fondo + metido;
    const centroZ = dentro - s.fondo + fondo / 2;
    cuerpos.push(caja(s.ancho, s.grosor, fondo).translate(s.u, h - 0.06 - s.grosor / 2, centroZ));
    caras.push(caja(s.ancho, 0.06, s.fondo).translate(s.u, h - 0.03, dentro - s.fondo / 2));
  }
  const mallaCuerpos = new THREE.Mesh(mergeGeometries(cuerpos), new THREE.MeshStandardMaterial({ map: naranja, roughness: 0.45 }));
  const mallaCaras = new THREE.Mesh(mergeGeometries(caras), new THREE.MeshStandardMaterial({ map: claro, roughness: 0.5 }));
  for (const m of [mallaCuerpos, mallaCaras]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  grupo.add(mallaCuerpos, mallaCaras);

  // El mirador: una losa blanca con el borde naranja, sobre lo alto de las cáscaras.
  const H = PALAU.alto;
  const largo = MIRADOR.largo;
  const ancho = Z_MIRADOR * 2;
  const blanco = crearTexturaTrencadis({ junta: '#cfd4d8', oscuro: '#eeeeef', claro: '#fdfdff', semilla: 4412 });
  const losa = new THREE.Mesh(caja(largo, 1.6, ancho).translate(PALAU.x, H - 0.8 + 0.02, 0), new THREE.MeshStandardMaterial({ map: blanco, roughness: 0.5 }));
  losa.receiveShadow = true;
  const bordes = mergeGeometries([
    caja(largo + 0.4, 0.5, 0.6).translate(PALAU.x, H - 0.25 + 0.03, -Z_MIRADOR + 0.3),
    caja(largo + 0.4, 0.5, 0.6).translate(PALAU.x, H - 0.25 + 0.03, Z_MIRADOR - 0.3),
  ]);
  const borde = new THREE.Mesh(bordes, new THREE.MeshStandardMaterial({ map: naranja, roughness: 0.45 }));
  // La barandilla (blanca, metálica): por el lado de +z y en las dos puntas; por el de la subida, abierta.
  const barras: THREE.BufferGeometry[] = [];
  const ALTO_BARANDILLA = 1.1;
  const poste = (x: number, z: number) => barras.push(new THREE.CylinderGeometry(0.05, 0.05, ALTO_BARANDILLA, 6).toNonIndexed().translate(x, H + ALTO_BARANDILLA / 2, z));
  const tramo = (x0: number, z0: number, x1: number, z1: number) => {
    const largoTramo = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.CylinderGeometry(0.045, 0.045, largoTramo, 6).toNonIndexed();
    g.rotateZ(Math.PI / 2);
    g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    g.translate((x0 + x1) / 2, H + ALTO_BARANDILLA, (z0 + z1) / 2);
    barras.push(g);
    const n = Math.max(Math.round(largoTramo / 2), 1);
    for (let i = 0; i <= n; i++) poste(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
  };
  const xa = PALAU.x - largo / 2 + 0.2;
  const xb = PALAU.x + largo / 2 - 0.2;
  const zb = Z_MIRADOR - 0.2;
  tramo(xa, zb, xb, zb);
  tramo(xa, -zb, xa, zb);
  tramo(xb, -zb, xb, zb);
  const barandilla = new THREE.Mesh(mergeGeometries(barras), new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.5, roughness: 0.35 }));
  barandilla.castShadow = true;
  // Una senyera en el mirador, junto a la barandilla del fondo.
  const senyera = crearSenyera(PALAU.x, H, Z_MIRADOR - 1.5);
  grupo.add(losa, borde, barandilla, senyera.grupo);
  return { grupo, ondear: senyera.ondear };
}

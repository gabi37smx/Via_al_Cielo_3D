/*
 * Lo que hay por la torre: fragmentos de código y murciélagos. Solo DIBUJA:
 * dónde están y qué pasa al tocarlos lo deciden reglas/partida.ts.
 */
import * as THREE from 'three';
import { posicionMurcielago, type Fragmento, type Murcielago } from '../reglas/partida.ts';

/* ---------- Fragmentos de código ---------- */

function texturaCodigo(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b2a1a';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#3dff8f';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 116, 116);
  ctx.fillStyle = '#3dff8f';
  ctx.font = 'bold 64px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('{ }', 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crearFragmentos(fragmentos: Fragmento[]) {
  const textura = texturaCodigo();
  const material = new THREE.MeshStandardMaterial({
    map: textura,
    emissiveMap: textura,
    emissive: 0xffffff,
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });
  const geometria = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const grupo = new THREE.Group();
  grupo.name = 'fragmentos';
  const mallas = new Map<number, THREE.Mesh>();
  for (const f of fragmentos) {
    const m = new THREE.Mesh(geometria, material);
    m.position.set(f.x, f.y, f.z);
    m.castShadow = true;
    grupo.add(m);
    mallas.set(f.id, m);
  }

  return {
    grupo,
    /** Giran y flotan. */
    animar(tiempo: number) {
      for (const [id, m] of mallas) {
        const f = fragmentos.find((x) => x.id === id)!;
        m.rotation.set(0.4, tiempo * 1.8 + id, 0);
        m.position.y = f.y + Math.sin(tiempo * 2.5 + id) * 0.12;
      }
    },
    ocultar(id: number) {
      const m = mallas.get(id);
      if (m) m.visible = false;
    },
    mostrarTodos() {
      for (const m of mallas.values()) m.visible = true;
    },
  };
}

/* ---------- Murciélagos ---------- */

/** Ala izquierda: sale hacia +x desde el cuerpo, con el borde festoneado. */
function geometriaAla(): THREE.BufferGeometry {
  const forma = new THREE.Shape();
  forma.moveTo(0, 0.08);
  forma.lineTo(0.55, 0.14);
  forma.lineTo(0.46, -0.04);
  forma.lineTo(0.33, 0.02);
  forma.lineTo(0.2, -0.07);
  forma.lineTo(0.06, -0.02);
  forma.lineTo(0, -0.06);
  const g = new THREE.ShapeGeometry(forma);
  g.rotateX(-Math.PI / 2); // del plano XY al plano horizontal
  return g;
}

/*
 * 25 murciélagos × (cuerpo + 2 alas + 2 ojos) serían 125 mallas. Con
 * instancing son 3 mallas instanciadas: 3 llamadas de dibujo.
 */
export function crearMurcielagos(murcielagos: Murcielago[]) {
  const n = murcielagos.length;
  const piel = new THREE.MeshStandardMaterial({ color: 0x4a3f55, roughness: 0.8, side: THREE.DoubleSide });
  const cuerpos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 10, 8), piel, n);
  const alas = new THREE.InstancedMesh(geometriaAla(), piel, n * 2);
  // Ojos rojos que brillan: en la oscuridad de la cueva es lo que se ve primero.
  const ojos = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.035, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    n * 2,
  );
  for (const m of [cuerpos, alas, ojos]) {
    m.frustumCulled = false; // se mueven: la caja calculada al crearlos no sirve
    m.castShadow = m !== ojos;
  }
  const grupo = new THREE.Group();
  grupo.name = 'murcielagos';
  grupo.add(cuerpos, alas, ojos);

  const base = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const ejeY = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  // Más grande que un murciélago real: a 7 m de cámara y en la oscuridad,
  // a tamaño real (1,3 m de alas) no se veía venir.
  const tamano = new THREE.Vector3(1.5, 1.5, 1.5);
  const espejo = new THREE.Matrix4().makeScale(-1, 1, 1);
  const cuerpoForma = new THREE.Matrix4().makeScale(1, 0.8, 1.3);

  return {
    grupo,
    actualizar(tiempo: number) {
      murcielagos.forEach((m, i) => {
        const p = posicionMurcielago(m, tiempo);
        // Mira hacia donde vuela (la tangente de su vuelta).
        const a = m.fase + m.velocidad * tiempo;
        const s = Math.sign(m.velocidad) || 1;
        giro.setFromAxisAngle(ejeY, Math.atan2(-Math.sin(a) * s, Math.cos(a) * s));
        base.compose(pos.set(p.x, p.y, p.z), giro, tamano);

        cuerpos.setMatrixAt(i, tmp.multiplyMatrices(base, cuerpoForma));

        const aleteo = Math.sin(tiempo * 18 + m.fase) * 0.7;
        local.makeRotationZ(aleteo).setPosition(0.12, 0, 0);
        alas.setMatrixAt(i * 2, tmp.multiplyMatrices(base, local));
        alas.setMatrixAt(i * 2 + 1, tmp.multiplyMatrices(base, espejo).multiply(local));

        local.makeTranslation(0.07, 0.06, 0.2);
        ojos.setMatrixAt(i * 2, tmp.multiplyMatrices(base, local));
        local.makeTranslation(-0.07, 0.06, 0.2);
        ojos.setMatrixAt(i * 2 + 1, tmp.multiplyMatrices(base, local));
      });
      cuerpos.instanceMatrix.needsUpdate = true;
      alas.instanceMatrix.needsUpdate = true;
      ojos.instanceMatrix.needsUpdate = true;
    },
  };
}

/*
 * Lo que se ve del aire libre (decisión 042): las ÁGUILAS, los COPOS de nieve
 * y las RAYAS del viento en las ráfagas. Solo dibuja: dónde están las águilas
 * y cuándo sopla lo dice reglas/aire.ts.
 *
 * Todo con mallas instanciadas o puntos: 7 llamadas de dibujo en total.
 */
import * as THREE from 'three';
import { posicionAguila, type Aguila } from '../reglas/aire.ts';

/* ---------- Las águilas ---------- */

/** Un ala (la derecha) en el plano x-z: de la raíz (x = 0) a la punta (x = 1,15), con las plumas de la punta abiertas. */
function geometriaAla(): THREE.BufferGeometry {
  const forma = new THREE.Shape();
  forma.moveTo(0, -0.2);
  forma.lineTo(0.55, -0.24);
  forma.lineTo(0.95, -0.16);
  forma.lineTo(1.15, -0.05);
  forma.lineTo(1.1, 0.02);
  forma.lineTo(1.12, 0.08);
  forma.lineTo(1.0, 0.1);
  forma.lineTo(1.02, 0.16);
  forma.lineTo(0.85, 0.17);
  forma.lineTo(0.4, 0.24);
  forma.lineTo(0, 0.2);
  const g = new THREE.ShapeGeometry(forma);
  g.rotateX(Math.PI / 2); // del plano x-y al x-z (z hacia delante)
  return g;
}

export function crearAguilas(aguilas: Aguila[]) {
  const n = aguilas.length;
  const plumas = new THREE.MeshStandardMaterial({ color: 0x5a3a1f, roughness: 0.85, side: THREE.DoubleSide });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 });
  const amarillo = new THREE.MeshStandardMaterial({ color: 0xf2b21b, roughness: 0.6 });
  const cuerpos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), plumas, n);
  const cabezas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), blanco, n);
  const picos = new THREE.InstancedMesh(new THREE.ConeGeometry(0.045, 0.14, 6).rotateX(Math.PI / 2), amarillo, n);
  const colas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.025, 0.3), blanco, n);
  const alas = new THREE.InstancedMesh(geometriaAla(), plumas, n * 2);
  const partes = [cuerpos, cabezas, picos, colas, alas];
  for (const m of partes) {
    m.frustumCulled = false; // se mueven: la caja calculada al crearlas no sirve
    m.castShadow = true;
  }
  const grupo = new THREE.Group();
  grupo.name = 'aguilas';
  grupo.add(...partes);

  const base = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const ejeY = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  // Algo más grandes que de verdad (2,9 m de alas): a 8 m de la cámara se ven venir.
  const tamano = new THREE.Vector3(1.3, 1.3, 1.3);
  const espejo = new THREE.Matrix4().makeScale(-1, 1, 1);
  const cuerpoForma = new THREE.Matrix4().makeScale(1, 0.85, 2.1);
  const cabeza = new THREE.Matrix4().makeTranslation(0, 0.08, 0.48);
  const pico = new THREE.Matrix4().makeTranslation(0, 0.05, 0.62);
  const cola = new THREE.Matrix4().makeTranslation(0, 0.02, -0.55);

  return {
    grupo,
    actualizar(tiempo: number) {
      aguilas.forEach((a, i) => {
        const p = posicionAguila(a, tiempo);
        // Mira hacia donde vuela: a lo largo de la cara (T = (−sen, cos) del ángulo del pasillo).
        const dx = -Math.sin(a.angulo) * p.sentido;
        const dz = Math.cos(a.angulo) * p.sentido;
        giro.setFromAxisAngle(ejeY, Math.atan2(dx, dz));
        base.compose(pos.set(p.x, p.y, p.z), giro, tamano);

        cuerpos.setMatrixAt(i, tmp.multiplyMatrices(base, cuerpoForma));
        cabezas.setMatrixAt(i, tmp.multiplyMatrices(base, cabeza));
        picos.setMatrixAt(i, tmp.multiplyMatrices(base, pico));
        colas.setMatrixAt(i, tmp.multiplyMatrices(base, cola));

        // Aletea despacio y a ratos planea (las alas casi quietas, un poco hacia arriba).
        const ganas = 0.5 + 0.5 * Math.sin(tiempo * 0.7 + a.fase * 9);
        const aleteo = 0.12 + Math.sin(tiempo * 6 + a.fase * 20) * 0.55 * ganas;
        local.makeRotationZ(aleteo).setPosition(0.12, 0.04, 0);
        alas.setMatrixAt(i * 2, tmp.multiplyMatrices(base, local));
        alas.setMatrixAt(i * 2 + 1, tmp.multiplyMatrices(base, espejo).multiply(local));
      });
      for (const m of partes) m.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ---------- La nieve y el viento ---------- */

/** Un copo: un punto redondo y difuminado (una textura pequeña dibujada a mano). */
function texturaCopo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Lleva `v` a la caja de lado `lado` centrada en `centro` (dando la vuelta por el otro lado). */
const envolver = (v: number, centro: number, lado: number) => centro + ((((v - centro + lado / 2) % lado) + lado) % lado) - lado / 2;

/**
 * Copos de nieve alrededor de la cámara (caen, se mecen y las ráfagas se los
 * llevan de lado) y unas rayas blancas que cruzan en las ráfagas. Siempre en
 * una caja alrededor de la cámara: los que salen por un lado entran por el otro.
 */
export function crearNieve() {
  const COPOS = 2600;
  const CAJA = { ancho: 44, alto: 26 };
  const posiciones = new Float32Array(COPOS * 3);
  const fases = new Float32Array(COPOS);
  let semilla = 12345;
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) >>> 0) / 0xffffffff);
  for (let i = 0; i < COPOS; i++) {
    posiciones[i * 3] = (azar() - 0.5) * CAJA.ancho;
    posiciones[i * 3 + 1] = (azar() - 0.5) * CAJA.alto;
    posiciones[i * 3 + 2] = (azar() - 0.5) * CAJA.ancho;
    fases[i] = azar() * Math.PI * 2;
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
  const material = new THREE.PointsMaterial({
    map: texturaCopo(),
    size: 0.24,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  const copos = new THREE.Points(geometria, material);
  copos.frustumCulled = false;
  copos.name = 'copos';

  // Las rayas del viento: barritas largas y finas que cruzan deprisa (una
  // línea de verdad mide 1 píxel y no se veía).
  // Más cerca de la cámara que los copos (en una caja más pequeña): si no, casi ninguna cae a la vista.
  const RAYAS = 140;
  const CAJA_RAYAS = { ancho: 26, alto: 12 };
  const centros = Array.from({ length: RAYAS }, () => new THREE.Vector3((azar() - 0.5) * CAJA_RAYAS.ancho, (azar() - 0.5) * CAJA_RAYAS.alto, (azar() - 0.5) * CAJA_RAYAS.ancho));
  const largos = Array.from({ length: RAYAS }, () => 1.6 + azar() * 2.4);
  const matRayas = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const lineas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 1), matRayas, RAYAS);
  lineas.frustumCulled = false;
  lineas.name = 'rayas-viento';
  const matriz = new THREE.Matrix4();
  const giroRaya = new THREE.Quaternion();
  const ejeY = new THREE.Vector3(0, 1, 0);
  const escalaRaya = new THREE.Vector3();

  const grupo = new THREE.Group();
  grupo.name = 'nieve';
  grupo.add(copos, lineas);
  let reloj = 0;

  return {
    grupo,
    /**
     * `centro`: la cámara. `viento`: velocidad del aire (m/s, ya con su
     * fuerza). `rafaga`: 0-1, cuánto sopla. `fuera`: 0-1, cuánto se está al
     * aire libre (dentro no se ve nada).
     */
    actualizar(dt: number, centro: THREE.Vector3, viento: { x: number; z: number }, rafaga: number, fuera: number) {
      grupo.visible = fuera > 0.01;
      if (!grupo.visible) return;
      reloj += dt;
      material.opacity = 0.9 * fuera;
      // Los copos van con el aire: un poco más deprisa que el viento de verdad, para que se note.
      const vx = 0.4 + viento.x * 2.2;
      const vz = 0.2 + viento.z * 2.2;
      for (let i = 0; i < COPOS; i++) {
        const k = i * 3;
        const mecerse = Math.sin(reloj * 1.3 + fases[i]!) * 0.35;
        posiciones[k] = envolver(posiciones[k]! + (vx + mecerse) * dt, centro.x, CAJA.ancho);
        posiciones[k + 1] = envolver(posiciones[k + 1]! - (1.1 + 0.4 * Math.sin(fases[i]!)) * dt, centro.y, CAJA.alto);
        posiciones[k + 2] = envolver(posiciones[k + 2]! + (vz + mecerse * 0.5) * dt, centro.z, CAJA.ancho);
      }
      geometria.attributes.position!.needsUpdate = true;

      // Las rayas: solo en las ráfagas, cruzando a 6 veces lo que sopla.
      matRayas.opacity = 0.6 * rafaga * fuera;
      lineas.visible = matRayas.opacity > 0.01;
      if (!lineas.visible) return;
      // Alineadas con el viento (la caja mide 1 de largo en z: se estira).
      giroRaya.setFromAxisAngle(ejeY, Math.atan2(viento.x, viento.z));
      centros.forEach((c, i) => {
        c.x = envolver(c.x + viento.x * 6 * dt, centro.x, CAJA_RAYAS.ancho);
        c.y = envolver(c.y, centro.y, CAJA_RAYAS.alto);
        c.z = envolver(c.z + viento.z * 6 * dt, centro.z, CAJA_RAYAS.ancho);
        lineas.setMatrixAt(i, matriz.compose(c, giroRaya, escalaRaya.set(1, 1, largos[i]!)));
      });
      lineas.instanceMatrix.needsUpdate = true;
    },
  };
}

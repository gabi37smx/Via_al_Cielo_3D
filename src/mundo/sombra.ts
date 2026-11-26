/*
 * Sombra redonda justo debajo del escalador, siempre visible. En 3D cuesta
 * calcular a qué distancia está el suelo; esta mancha dice DÓNDE vas a caer.
 * (La sombra del sol cae inclinada y no sirve para eso.)
 * Cuanto más alto está el escalador, más pequeña y clara.
 */
import * as THREE from 'three';

export function crearSombra() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const degradado = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  degradado.addColorStop(0, 'rgba(0,0,0,1)');
  degradado.addColorStop(0.6, 'rgba(0,0,0,0.6)');
  degradado.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, 64, 64);

  const material = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false, // no tapa nada: solo oscurece
    opacity: 0.9,
  });
  const mancha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mancha.rotation.x = -Math.PI / 2;
  mancha.renderOrder = 1;
  mancha.name = 'sombra-redonda';

  return {
    mancha,
    /** `ySuelo`: altura del suelo bajo el escalador; `y`: altura de sus pies. */
    colocar(x: number, ySuelo: number, z: number, y: number) {
      const h = Math.max(y - ySuelo, 0);
      mancha.visible = Number.isFinite(ySuelo);
      mancha.position.set(x, ySuelo + 0.02, z);
      // El suelo de la cueva es oscuro: la mancha tiene que ser casi negra
      // para notarse, y no aclararse demasiado con la altura.
      const t = Math.min(h / 15, 1);
      mancha.scale.setScalar(1.4 * (1 - t * 0.4));
      material.opacity = 0.9 * (1 - t * 0.4);
    },
  };
}

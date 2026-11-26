import * as THREE from 'three';

/** 1 unidad de Three.js = 1 metro (ver docs/diseno.md). */
export interface Escena {
  renderer: THREE.WebGLRenderer;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  /** Ajusta el tamaño del dibujo y la proporción de la cámara a la ventana. */
  redimensionar(): void;
  /** Pinta. `foco`: dónde está el escalador (las luces le siguen). */
  pintar(foco: THREE.Vector3Like): void;
}

export function crearEscena(lienzo: HTMLCanvasElement): Escena {
  // 1 · Renderer: dibuja en el <canvas>, con sombras.
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap ya no existe en three 0.187
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const escena = new THREE.Scene();

  // 2 · Cámara en perspectiva (la mueve mundo/camara.ts).
  const camara = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

  // 3 · Luz de relleno, baja: en una cueva casi todo es sombra. Si es muy
  //     fuerte, tapa las sombras del sol (tropiezo de la sesión 2 del curso).
  escena.add(new THREE.HemisphereLight(0x8fa3c8, 0x3a2e22, 0.9));

  // 4 · «Sol»: la luz que entra por la grieta de arriba. Proyecta sombras,
  //     pero solo en una caja de 28 m alrededor del escalador: la torre mide
  //     220 m y una sombra que la cubriera entera saldría borrosa. Por eso el
  //     sol le SIGUE al subir.
  const sol = new THREE.DirectionalLight(0xdfe8ff, 3.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = sol.shadow.camera.bottom = -14;
  sol.shadow.camera.right = sol.shadow.camera.top = 14;
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far = 70;
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.03;
  escena.add(sol, sol.target);

  // 5 · La linterna del casco: luz puntual cálida que va con el escalador.
  //     Sin sombras: las puntuales con sombra cuestan 6 pasadas.
  const linterna = new THREE.PointLight(0xffb36b, 40, 18, 2);
  escena.add(linterna);

  function colocarLuces(f: THREE.Vector3Like) {
    // Inclinado ~45°: si cae vertical solo ilumina las caras de arriba.
    sol.position.set(f.x + 16, f.y + 24, f.z + 12);
    sol.target.position.set(f.x, f.y, f.z);
    // Por encima y hacia la cámara, para que ilumine lo que se ve. Justo
    // encima de la cabeza la dejaba quemada de luz.
    linterna.position.set(
      f.x + (camara.position.x - f.x) * 0.4,
      f.y + 3,
      f.z + (camara.position.z - f.z) * 0.4,
    );
  }

  function redimensionar() {
    const ancho = lienzo.clientWidth;
    const alto = lienzo.clientHeight;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto; // sin esto la imagen se estira al cambiar la ventana
    camara.updateProjectionMatrix();
  }

  function pintar(foco: THREE.Vector3Like) {
    colocarLuces(foco);
    renderer.render(escena, camara);
  }

  redimensionar();
  return { renderer, escena, camara, redimensionar, pintar };
}

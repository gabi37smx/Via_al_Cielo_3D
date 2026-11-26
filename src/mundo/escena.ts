import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RADIO_CUEVA } from './cueva.ts';

/** 1 unidad de Three.js = 1 metro (ver docs/diseno.md). */
export interface Escena {
  renderer: THREE.WebGLRenderer;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  controles: OrbitControls;
  /** Altura (m) a la que mira la cámara. */
  readonly altura: number;
  /** Sube o baja la cámara y lo que mira, sin girarla. */
  moverVista(dy: number): void;
  /** Ajusta el tamaño del dibujo y la proporción de la cámara a la ventana. */
  redimensionar(): void;
  pintar(): void;
}

export function crearEscena(lienzo: HTMLCanvasElement, alturaInicial = 1.5): Escena {
  // 1 · Renderer: dibuja en el <canvas>, con sombras.
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap ya no existe en three 0.187
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const escena = new THREE.Scene();

  // 2 · Cámara en perspectiva, fuera de la columna y mirando a su eje.
  const camara = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camara.position.set(10, alturaInicial + 4, 7);

  const controles = new OrbitControls(camara, lienzo);
  controles.target.set(0, alturaInicial, 0);
  controles.enableDamping = true;
  controles.enablePan = false;
  controles.minDistance = 6;
  controles.maxDistance = RADIO_CUEVA - 4; // que no atraviese las paredes
  controles.update();

  // 3 · Luz de relleno, muy baja: en una cueva casi todo es sombra. Si es
  //     fuerte, tapa las sombras del sol (tropiezo de la sesión 2 del curso).
  escena.add(new THREE.HemisphereLight(0x8fa3c8, 0x3a2e22, 0.9));

  // 4 · «Sol»: la luz que entra por la grieta de arriba. Proyecta sombras,
  //     pero solo en una caja de 28 m alrededor de la cámara: la torre mide
  //     220 m y una sombra que la cubriera entera saldría borrosa. Por eso el
  //     sol SIGUE a la cámara al subir.
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

  // 5 · Farol: luz puntual cálida cerca de lo que se mira (más adelante la
  //     llevará el escalador). Sin sombras: las puntuales con sombra cuestan 6 pasadas.
  const farol = new THREE.PointLight(0xffb36b, 40, 18, 2);
  escena.add(farol);

  function colocarLuces() {
    const t = controles.target;
    // Inclinado ~45°: si cae vertical solo ilumina las caras de arriba.
    sol.position.set(t.x + 16, t.y + 24, t.z + 12);
    sol.target.position.copy(t);
    farol.position.set(camara.position.x * 0.5, t.y + 2, camara.position.z * 0.5);
  }

  function moverVista(dy: number) {
    const nueva = Math.max(controles.target.y + dy, 1.5); // no bajar del suelo
    const real = nueva - controles.target.y;
    controles.target.y += real;
    camara.position.y += real;
  }

  function redimensionar() {
    const ancho = lienzo.clientWidth;
    const alto = lienzo.clientHeight;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto; // sin esto la imagen se estira al cambiar la ventana
    camara.updateProjectionMatrix();
  }

  function pintar() {
    controles.update();
    colocarLuces();
    renderer.render(escena, camara);
  }

  redimensionar();
  return {
    renderer,
    escena,
    camara,
    controles,
    get altura() {
      return controles.target.y;
    },
    moverVista,
    redimensionar,
    pintar,
  };
}

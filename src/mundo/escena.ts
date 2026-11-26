import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** 1 unidad de Three.js = 1 metro (ver docs/diseno.md). */
export interface Escena {
  renderer: THREE.WebGLRenderer;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  controles: OrbitControls;
  cubo: THREE.Mesh;
  /** Ajusta el tamaño del dibujo y la proporción de la cámara a la ventana. */
  redimensionar(): void;
  pintar(): void;
}

export function crearEscena(lienzo: HTMLCanvasElement): Escena {
  // 1 · Renderer: dibuja en el <canvas>, con sombras.
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap ya no existe en three 0.187

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x0d1117);

  // 2 · Cámara en perspectiva, algo por encima y mirando al centro.
  const camara = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  camara.position.set(4, 3.5, 6);

  const controles = new OrbitControls(camara, lienzo);
  controles.target.set(0, 0.5, 0);
  controles.enableDamping = true;
  controles.update();

  // 3 · Luz de relleno: que las caras en sombra no queden negras.
  escena.add(new THREE.HemisphereLight(0xbcd7ff, 0x2a2018, 0.8));

  // 4 · Sol direccional que proyecta sombras.
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(5, 10, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = -8;
  sol.shadow.camera.right = 8;
  sol.shadow.camera.top = 8;
  sol.shadow.camera.bottom = -8;
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far = 30;
  escena.add(sol);

  // Suelo que recibe la sombra + rejilla de 1 m para ver la escala.
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x1f2933, roughness: 1 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);

  const rejilla = new THREE.GridHelper(20, 20, 0x5b6b7a, 0x33404c);
  rejilla.position.y = 0.001; // un pelo por encima para que no parpadee con el suelo
  escena.add(rejilla);

  // El cubo de prueba: 1 m de lado, apoyado sobre el suelo.
  const cubo = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xf2a541, roughness: 0.5 }),
  );
  cubo.position.y = 0.5;
  cubo.castShadow = true;
  escena.add(cubo);

  function redimensionar() {
    const ancho = lienzo.clientWidth;
    const alto = lienzo.clientHeight;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto; // sin esto la imagen se estira al cambiar la ventana
    camara.updateProjectionMatrix();
  }

  function pintar() {
    controles.update();
    renderer.render(escena, camara);
  }

  redimensionar();
  return { renderer, escena, camara, controles, cubo, redimensionar, pintar };
}

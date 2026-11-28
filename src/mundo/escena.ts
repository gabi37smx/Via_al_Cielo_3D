import * as THREE from 'three';

/**
 * Cómo se ve cada escenario: fondo y niebla, luz de relleno, «sol» y la
 * linterna del casco. Al subir de un tramo a otro se mezclan poco a poco.
 */
interface Ambiente {
  fondo: number;
  niebla: number;
  cielo: number;
  sueloLuz: number;
  relleno: number;
  sol: number;
  intensidadSol: number;
  linterna: number;
}

export const AMBIENTES = {
  /** Cueva oscura: casi todo sombra, se ve poco y la linterna manda. */
  cueva: { fondo: 0x101724, niebla: 0.028, cielo: 0x8fa3c8, sueloLuz: 0x3a2e22, relleno: 0.9, sol: 0xdfe8ff, intensidadSol: 3.2, linterna: 40 },
  /** Grieta (cueva clara): luz cálida que entra por las rendijas, se ve más lejos. */
  grieta: { fondo: 0x7a6f62, niebla: 0.017, cielo: 0xf4ece0, sueloLuz: 0x6a5b4a, relleno: 1.9, sol: 0xfff2e0, intensidadSol: 3.3, linterna: 12 },
  /** Aire libre: cielo azul, nieve que refleja luz, niebla muy fina (se ve muy lejos), sin linterna. */
  exterior: { fondo: 0xcfe3f2, niebla: 0.0032, cielo: 0xcfe8ff, sueloLuz: 0xe6edf4, relleno: 1.5, sol: 0xfff8ec, intensidadSol: 3.4, linterna: 0 },
  /** Valencia: sol mediterráneo más cálido, el suelo devuelve luz verde y crema, y se ve lejos. */
  valencia: { fondo: 0xe9e4d8, niebla: 0.0016, cielo: 0xd4e8fb, sueloLuz: 0xbdb48e, relleno: 1.35, sol: 0xfff0d6, intensidadSol: 3.6, linterna: 0 },
} as const satisfies Record<string, Ambiente>;

/** Metros por debajo y por encima del rellano de los 220 m en los que la cueva se convierte en grieta. */
export const TRANSICION = 12;

/**
 * Cuánto de grieta hay a la altura `y`: 0 en la cueva, 1 en la grieta y una
 * curva suave alrededor del rellano de los 220 m (no un cambio de golpe).
 */
export function mezclaEscenario(y: number, rellano = 220): number {
  const t = Math.min(Math.max((y - (rellano - TRANSICION)) / (2 * TRANSICION), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Cuánto de aire libre hay: 0 en el pozo, 1 fuera. Cambia a lo largo del
 * pasillo de la ladera (`d` = distancia hacia fuera desde el eje del pozo),
 * solo a la altura de la ladera (`y` ≥ `base` − 2).
 */
export function mezclaExterior(d: number, y: number, base: number, desde = 14, hasta = 24): number {
  if (y < base - 2) return 0;
  const t = Math.min(Math.max((d - desde) / (hasta - desde), 0), 1);
  return t * t * (3 - 2 * t);
}

/** 1 unidad de Three.js = 1 metro (ver docs/diseno.md). */
export interface Escena {
  renderer: THREE.WebGLRenderer;
  escena: THREE.Scene;
  camara: THREE.PerspectiveCamera;
  /** Ajusta el tamaño del dibujo y la proporción de la cámara a la ventana. */
  redimensionar(): void;
  /** Pinta. `foco`: dónde está el escalador (las luces le siguen). */
  pintar(foco: THREE.Vector3Like): void;
  /**
   * Mezcla la cueva (0) con la grieta (1), encima con el aire libre
   * (`exterior`, 0-1) y encima con Valencia (`ciudad`, 0-1): fondo, niebla y luces.
   */
  ambientar(mezcla: number, exterior?: number, ciudad?: number): void;
  /** Fuera, el sol viene desde detrás de quien mira a la montaña: (nx, nz) = hacia la montaña. */
  orientarSol(nx: number, nz: number): void;
}

export function crearEscena(lienzo: HTMLCanvasElement): Escena {
  // 1 · Renderer: dibuja en el <canvas>, con sombras.
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap ya no existe en three 0.187
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const escena = new THREE.Scene();
  // Niebla del color del fondo: lo lejano se funde con él, da profundidad y
  // oculta dónde acaba el pozo. El color y la densidad los pone `ambientar`.
  const fondo = new THREE.Color();
  const niebla = new THREE.FogExp2(0x000000, 0.02);
  escena.background = fondo;
  escena.fog = niebla;

  // 2 · Cámara en perspectiva (la mueve mundo/camara.ts).
  // Hasta 1000 m: fuera se ven las montañas del fondo (en las cuevas, la niebla tapa todo antes).
  const camara = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

  // 3 · Luz de relleno, baja: en una cueva casi todo es sombra. Si es muy
  //     fuerte, tapa las sombras del sol (tropiezo de la sesión 2 del curso).
  const relleno = new THREE.HemisphereLight(0x8fa3c8, 0x3a2e22, 0.9);
  escena.add(relleno);

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

  /** De dónde viene el sol respecto al escalador: en el pozo, fijo; fuera, desde detrás de la cámara. */
  const solPozo = new THREE.Vector3(16, 24, 12);
  const solFuera = new THREE.Vector3(16, 24, 12);
  const solAhora = new THREE.Vector3(16, 24, 12);
  let exteriorAhora = 0;
  function colocarLuces(f: THREE.Vector3Like) {
    // Inclinado ~45°: si cae vertical solo ilumina las caras de arriba.
    solAhora.lerpVectors(solPozo, solFuera, exteriorAhora);
    sol.position.set(f.x + solAhora.x, f.y + solAhora.y, f.z + solAhora.z);
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

  const a = new THREE.Color();
  const b = new THREE.Color();
  const mezclar = (desde: number, hasta: number, t: number) => desde + (hasta - desde) * t;
  let ultima = '';
  /** Mezcla los ambientes en fila: cueva → grieta → exterior → Valencia. */
  function ambientar(mezcla: number, exterior = 0, ciudad = 0) {
    const t = Math.min(Math.max(mezcla, 0), 1);
    const x = Math.min(Math.max(exterior, 0), 1);
    const v = Math.min(Math.max(ciudad, 0), 1);
    const clave = `${t}|${x}|${v}`;
    if (clave === ultima) return;
    ultima = clave;
    exteriorAhora = Math.max(x, v);
    const [c, g, f, val] = [AMBIENTES.cueva, AMBIENTES.grieta, AMBIENTES.exterior, AMBIENTES.valencia];
    const color = (prop: 'fondo' | 'cielo' | 'sueloLuz' | 'sol', destino: THREE.Color) =>
      destino.lerpColors(a.setHex(c[prop]), b.setHex(g[prop]), t).lerp(b.setHex(f[prop]), x).lerp(b.setHex(val[prop]), v);
    const numero = (prop: 'niebla' | 'relleno' | 'intensidadSol' | 'linterna') => mezclar(mezclar(mezclar(c[prop], g[prop], t), f[prop], x), val[prop], v);
    color('fondo', fondo);
    niebla.color.copy(fondo);
    niebla.density = numero('niebla');
    color('cielo', relleno.color);
    color('sueloLuz', relleno.groundColor);
    relleno.intensity = numero('relleno');
    color('sol', sol.color);
    sol.intensity = numero('intensidadSol');
    linterna.intensity = numero('linterna');
  }

  function orientarSol(nx: number, nz: number) {
    // Desde detrás de la cámara (−N), un poco de lado y alto: la cara de la montaña queda iluminada.
    solFuera.set(-nx * 14 - nz * 9, 26, -nz * 14 + nx * 9);
  }

  redimensionar();
  ambientar(0);
  return { renderer, escena, camara, redimensionar, pintar, ambientar, orientarSol };
}

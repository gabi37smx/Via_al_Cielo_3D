/*
 * Texturas de roca pintadas en un <canvas>: nada que descargar ni que
 * acreditar. De un mismo «mapa de alturas» (ruido) salen tres capas:
 *
 *  - color:      el aspecto de la roca (dos tonos según la altura del ruido)
 *  - normales:   relieve falso; la luz «ve» grietas y bultos que no existen
 *                en la geometría (cero triángulos de más)
 *  - rugosidad:  las partes hundidas brillan menos que las salientes
 *
 * El ruido es PERIÓDICO: el borde derecho continúa en el izquierdo, así la
 * textura se repite sobre la pared sin costuras.
 */
import * as THREE from 'three';
import { crearAzar } from '../reglas/azar.ts';

export interface TexturaRoca {
  mapa: THREE.CanvasTexture;
  normales: THREE.CanvasTexture;
  rugosidad: THREE.CanvasTexture;
}

export interface OpcionesRoca {
  /** Tono de las zonas hundidas. */
  oscuro: string;
  /** Tono de las zonas salientes. */
  claro: string;
  /** Cambia el dibujo de la roca (no tiene que ver con la semilla de la torre). */
  semilla?: number;
  /** Lado de la textura en píxeles (presupuesto: ≤ 1024). */
  tam?: number;
  /** Fuerza del relieve. */
  relieve?: number;
}

/** Ruido de valor periódico: rejilla de `celdas`×`celdas` puntos al azar, suavizada. */
function ruidoPeriodico(tam: number, celdas: number, azar: () => number): Float32Array {
  const rejilla = Float32Array.from({ length: celdas * celdas }, () => azar());
  const v = (i: number, j: number) => rejilla[((j + celdas) % celdas) * celdas + ((i + celdas) % celdas)]!;
  const suave = (t: number) => t * t * (3 - 2 * t);
  const salida = new Float32Array(tam * tam);
  for (let y = 0; y < tam; y++) {
    const gy = (y / tam) * celdas;
    const j = Math.floor(gy);
    const ty = suave(gy - j);
    for (let x = 0; x < tam; x++) {
      const gx = (x / tam) * celdas;
      const i = Math.floor(gx);
      const tx = suave(gx - i);
      const arriba = v(i, j) + (v(i + 1, j) - v(i, j)) * tx;
      const abajo = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * tx;
      salida[y * tam + x] = arriba + (abajo - arriba) * ty;
    }
  }
  return salida;
}

/** Mapa de alturas 0-1: varias capas de ruido, de grande a pequeño. */
function mapaDeAlturas(tam: number, semilla: number): Float32Array {
  const azar = crearAzar(semilla);
  const alturas = new Float32Array(tam * tam);
  let peso = 0.5;
  let total = 0;
  for (const celdas of [4, 8, 16, 32, 64]) {
    const capa = ruidoPeriodico(tam, celdas, azar);
    for (let k = 0; k < alturas.length; k++) alturas[k]! += capa[k]! * peso;
    total += peso;
    peso *= 0.5;
  }
  for (let k = 0; k < alturas.length; k++) alturas[k]! /= total;
  return alturas;
}

function lienzo(tam: number): [HTMLCanvasElement, CanvasRenderingContext2D, ImageData] {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const ctx = c.getContext('2d')!;
  return [c, ctx, ctx.createImageData(tam, tam)];
}

function textura(c: HTMLCanvasElement, color: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  // Solo el color va en sRGB; normales y rugosidad son datos, no colores.
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crearTexturaRoca(op: OpcionesRoca): TexturaRoca {
  const tam = op.tam ?? 512;
  const relieve = op.relieve ?? 6;
  const h = mapaDeAlturas(tam, op.semilla ?? 1);
  const alto = (x: number, y: number) => h[((y + tam) % tam) * tam + ((x + tam) % tam)]!;

  const oscuro = new THREE.Color(op.oscuro);
  const claro = new THREE.Color(op.claro);
  const mezcla = new THREE.Color();

  const [cColor, ctxColor, dColor] = lienzo(tam);
  const [cNormal, ctxNormal, dNormal] = lienzo(tam);
  const [cRugoso, ctxRugoso, dRugoso] = lienzo(tam);

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const k = (y * tam + x) * 4;
      const v = alto(x, y);

      // Color: contraste reforzado para que las vetas se noten.
      const t = Math.min(Math.max((v - 0.3) * 2.5, 0), 1);
      mezcla.copy(oscuro).lerp(claro, t);
      dColor.data[k] = mezcla.r * 255;
      dColor.data[k + 1] = mezcla.g * 255;
      dColor.data[k + 2] = mezcla.b * 255;
      dColor.data[k + 3] = 255;

      // Normales: la pendiente del mapa de alturas en x y en y.
      const nx = (alto(x - 1, y) - alto(x + 1, y)) * relieve;
      const ny = (alto(x, y + 1) - alto(x, y - 1)) * relieve;
      const largo = Math.hypot(nx, ny, 1);
      dNormal.data[k] = (nx / largo * 0.5 + 0.5) * 255;
      dNormal.data[k + 1] = (ny / largo * 0.5 + 0.5) * 255;
      dNormal.data[k + 2] = (1 / largo * 0.5 + 0.5) * 255;
      dNormal.data[k + 3] = 255;

      // Rugosidad: lo hundido, más mate (1); lo saliente, algo más brillante.
      const r = (0.95 - v * 0.35) * 255;
      dRugoso.data[k] = dRugoso.data[k + 1] = dRugoso.data[k + 2] = r;
      dRugoso.data[k + 3] = 255;
    }
  }

  ctxColor.putImageData(dColor, 0, 0);
  ctxNormal.putImageData(dNormal, 0, 0);
  ctxRugoso.putImageData(dRugoso, 0, 0);

  return { mapa: textura(cColor, true), normales: textura(cNormal, false), rugosidad: textura(cRugoso, false) };
}

/** Material de roca con las tres capas, repetidas `rx`×`ry` veces. */
export function materialRoca(tex: TexturaRoca, rx: number, ry: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  // clone() comparte la imagen (no ocupa más memoria) pero permite otra repetición.
  const capa = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(rx, ry);
    return c;
  };
  return new THREE.MeshStandardMaterial({
    map: capa(tex.mapa),
    normalMap: capa(tex.normales),
    roughnessMap: capa(tex.rugosidad),
    roughness: 1,
    ...extra,
  });
}

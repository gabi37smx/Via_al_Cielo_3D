/*
 * Panel de datos (F3): lo que hace falta para vigilar el presupuesto
 * (< 200 llamadas de dibujo, ~300 000 triángulos) y saber qué torre se ve.
 * Se lee después de pintar: `renderer.info` se pone a cero en cada render().
 */
import type * as THREE from 'three';

export interface DatosPanel {
  semilla: number;
  altura: number;
  postura: string;
}

export function crearPanel(elemento: HTMLElement, renderer: THREE.WebGLRenderer, visible = false) {
  elemento.hidden = !visible;
  let espera = 0;

  return {
    alternar() {
      elemento.hidden = !elemento.hidden;
    },
    /** Llamar después de pintar. Se refresca 4 veces por segundo. */
    actualizar(dt: number, datos: DatosPanel) {
      espera -= dt;
      if (elemento.hidden || espera > 0) return;
      espera = 0.25;
      const { calls, triangles } = renderer.info.render;
      elemento.textContent = [
        `llamadas   ${calls} / 200`,
        `triángulos ${triangles.toLocaleString('es-ES')}`,
        `semilla    ${datos.semilla}`,
        `altura     ${datos.altura.toFixed(1)} m`,
        `postura    ${datos.postura}`,
      ].join('\n');
    },
  };
}

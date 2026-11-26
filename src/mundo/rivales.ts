/*
 * Los otros escaladores de la sala: un personaje por rival, con su nombre
 * encima, colocado donde dice su interpolador. Solo dibuja.
 */
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { crearPersonaje, type Personaje } from '../jugador/personaje.ts';
import { Interpolador } from '../red/interpolacion.ts';
import type { Aspecto, EstadoRed, Miembro } from '../red/protocolo.ts';

/** Colores de los nombres por orden de llegada a la sala. */
export const COLORES_JUGADOR = ['#f5c518', '#4fc3f7', '#ff7a8a', '#9ccc65'] as const;

function etiqueta(texto: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ancho = Math.min(ctx.measureText(texto).width + 28, 250);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect((256 - ancho) / 2, 6, ancho, 52, 26);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(texto, 128, 33);
  const textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1);
  s.position.y = 2.2;
  return s;
}

interface Rival {
  miembro: Miembro;
  personaje: Personaje;
  interpolador: Interpolador;
  ultimo: EstadoRed | null;
}

export function crearRivales(escena: THREE.Scene, modelos: Record<Aspecto, GLTF>) {
  const rivales = new Map<string, Rival>();

  return {
    /** Ajusta los rivales a la lista de la sala (entra alguien, se va alguien). */
    sincronizar(miembros: Miembro[], yo: string) {
      const presentes = new Set(miembros.map((m) => m.id));
      for (const [id, r] of rivales) {
        if (!presentes.has(id)) {
          escena.remove(r.personaje.raiz);
          rivales.delete(id);
        }
      }
      miembros.forEach((m, i) => {
        if (m.id === yo || rivales.has(m.id)) return;
        // Cada rival con el aspecto que eligió (va en su presencia).
        const personaje = crearPersonaje(modelos[m.aspecto]);
        personaje.raiz.add(etiqueta(m.nombre, COLORES_JUGADOR[i % COLORES_JUGADOR.length]!));
        personaje.raiz.visible = false; // hasta que llegue su primer estado
        escena.add(personaje.raiz);
        rivales.set(m.id, { miembro: m, personaje, interpolador: new Interpolador(), ultimo: null });
      });
    },
    recibir(id: string, e: EstadoRed, ahora: number) {
      rivales.get(id)?.interpolador.anadir(e, ahora);
    },
    /** Coloca y anima a todos para el instante local `ahora` (ms). */
    pintar(ahora: number, dt: number) {
      for (const r of rivales.values()) {
        const e = r.interpolador.muestrear(ahora);
        if (!e) continue;
        r.ultimo = e;
        r.personaje.raiz.visible = true;
        r.personaje.colocar(e.x, e.y, e.z, e.orientacion);
        r.personaje.animar(e.postura, e.rapidez, e.voltereta, dt);
      }
    },
    /** Altura de cada rival (para la lista de la sala). */
    alturas(): Map<string, number> {
      return new Map([...rivales].map(([id, r]) => [id, r.ultimo?.y ?? 0]));
    },
    /** Dónde se ve a cada rival ahora mismo (para la consola y las pruebas de red). */
    vistos() {
      return [...rivales.values()].map((r) => ({
        nombre: r.miembro.nombre,
        aspecto: r.miembro.aspecto,
        visible: r.personaje.raiz.visible,
        x: r.ultimo?.x ?? NaN,
        y: r.ultimo?.y ?? NaN,
        z: r.ultimo?.z ?? NaN,
        postura: r.ultimo?.postura ?? null,
      }));
    },
  };
}

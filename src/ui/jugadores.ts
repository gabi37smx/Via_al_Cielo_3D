/*
 * Lista de la sala (abajo a la izquierda): código, quién está, quién es el
 * anfitrión (★) y a qué altura va cada uno, del más alto al más bajo.
 */
import type { Miembro } from '../red/protocolo.ts';
import { MAX_JUGADORES } from '../red/protocolo.ts';
import { COLORES_JUGADOR } from '../mundo/rivales.ts';

export function crearListaJugadores(raiz: HTMLElement, codigo: string) {
  raiz.hidden = false;
  let ultimo = '';

  return {
    actualizar(miembros: Miembro[], yo: string, anfitrion: string | undefined, alturas: Map<string, number>) {
      const filas = miembros
        .map((m, i) => ({ m, color: COLORES_JUGADOR[i % COLORES_JUGADOR.length]!, altura: alturas.get(m.id) ?? 0 }))
        .sort((a, b) => b.altura - a.altura);
      const clave = codigo + filas.map((f) => `${f.m.id}${Math.floor(f.altura)}`).join('|') + anfitrion;
      if (clave === ultimo) return;
      ultimo = clave;

      raiz.replaceChildren();
      const titulo = document.createElement('div');
      titulo.className = 'sala-titulo';
      titulo.textContent = `Sala ${codigo} · ${miembros.length}/${MAX_JUGADORES}`;
      raiz.append(titulo);
      for (const f of filas) {
        const fila = document.createElement('div');
        fila.className = 'sala-fila';
        const nombre = document.createElement('span');
        nombre.style.color = f.color;
        // textContent: un nombre como «<img onerror=…>» se ve como texto, no se ejecuta.
        nombre.textContent = `${f.m.id === anfitrion ? '★ ' : ''}${f.m.nombre}${f.m.id === yo ? ' (tú)' : ''}`;
        const altura = document.createElement('b');
        altura.textContent = `${Math.floor(f.altura)} m`;
        fila.append(nombre, altura);
        raiz.append(fila);
      }
    },
  };
}

/*
 * Marcador (HUD): HTML encima del lienzo. Vida, altura, récord, fragmentos y
 * tramo; avisos que aparecen y se van; destello rojo al recibir un golpe.
 * Solo toca el DOM cuando cambia algo.
 */
import { REGLAS } from '../reglas/partida.ts';

export interface DatosHud {
  vida: number;
  altura: number;
  record: number;
  fragmentos: number;
  tramo: string;
}

export function crearHud(raiz: HTMLElement) {
  raiz.innerHTML = `
    <div class="hud-vida"><span>Vida</span><div class="barra"><div class="relleno"></div></div><b class="valor"></b></div>
    <div class="hud-linea"><span>Altura</span><b class="altura"></b></div>
    <div class="hud-linea"><span>Récord</span><b class="record"></b></div>
    <div class="hud-linea"><span>Fragmentos</span><b class="fragmentos"></b></div>
    <div class="hud-tramo"></div>`;
  const $ = <T extends HTMLElement>(sel: string) => raiz.querySelector<T>(sel)!;
  const relleno = $('.relleno');
  const valor = $('.valor');
  const altura = $('.altura');
  const record = $('.record');
  const fragmentos = $('.fragmentos');
  const tramo = $('.hud-tramo');
  const avisos = document.querySelector<HTMLElement>('#avisos')!;
  const destello = document.querySelector<HTMLElement>('#destello')!;
  let ultimo = '';

  return {
    actualizar(d: DatosHud) {
      const clave = `${d.vida}|${Math.floor(d.altura)}|${Math.floor(d.record)}|${d.fragmentos}|${d.tramo}`;
      if (clave === ultimo) return;
      ultimo = clave;
      relleno.style.width = `${d.vida}%`;
      relleno.dataset.nivel = d.vida > 60 ? 'alta' : d.vida > 30 ? 'media' : 'baja';
      valor.textContent = `${d.vida} %`;
      altura.textContent = `${Math.floor(d.altura)} m`;
      record.textContent = `${Math.floor(d.record)} m`;
      const n = REGLAS.fragmentosPorTramo;
      fragmentos.textContent = '◆'.repeat(d.fragmentos) + '◇'.repeat(Math.max(n - d.fragmentos, 0));
      tramo.textContent = d.tramo;
    },
    /** Aviso en el centro que sube y desaparece. */
    avisar(texto: string, tipo: 'bueno' | 'malo' | 'info' = 'info') {
      const el = document.createElement('div');
      el.className = `aviso aviso-${tipo}`;
      el.textContent = texto;
      avisos.append(el);
      el.addEventListener('animationend', () => el.remove());
    },
    destello() {
      destello.classList.remove('activo');
      void destello.offsetWidth; // reinicia la animación CSS
      destello.classList.add('activo');
    },
  };
}

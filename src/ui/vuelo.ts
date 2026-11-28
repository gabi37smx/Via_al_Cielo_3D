/*
 * Lo que se ve encima del juego durante el vuelo a Valencia (idea I9): dos
 * bandas negras de cine, «Rumbo a Valencia», cómo saltarlo y el blanco de
 * las nubes al cambiar de sitio. Solo toca el DOM cuando cambia algo.
 */
export function crearPantallaVuelo(raiz: HTMLElement) {
  raiz.innerHTML = `
    <div class="vuelo-banda vuelo-arriba"><span>✈ Rumbo a Valencia</span></div>
    <div class="vuelo-banda vuelo-abajo"><span>Espacio o Enter: saltar el vuelo</span></div>
    <div class="vuelo-blanco"></div>`;
  const blanco = raiz.querySelector<HTMLElement>('.vuelo-blanco')!;
  let ultimo = -1;
  return {
    mostrar(si: boolean) {
      if (raiz.hidden === !si) return;
      raiz.hidden = !si;
      // Las bandas entran deslizándose (clase con transición).
      requestAnimationFrame(() => raiz.classList.toggle('abierto', si));
    },
    /** El blanco de las nubes (0-1). */
    blanco(cuanto: number) {
      const v = Math.round(cuanto * 100) / 100;
      if (v === ultimo) return;
      ultimo = v;
      blanco.style.opacity = String(v);
    },
  };
}

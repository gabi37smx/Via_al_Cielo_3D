/** Contador de fotogramas por segundo (mide el DIBUJO, no la lógica). */
export function crearContadorFps(elemento: HTMLElement) {
  let fotogramas = 0;
  let tiempo = 0;

  return {
    /** Llamar una vez por fotograma pintado, con lo que ha durado (s). */
    contar(dt: number) {
      fotogramas++;
      tiempo += dt;
      if (tiempo >= 0.5) {
        elemento.textContent = `${Math.round(fotogramas / tiempo)} fps`;
        fotogramas = 0;
        tiempo = 0;
      }
    },
  };
}

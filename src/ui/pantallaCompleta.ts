/*
 * Pantalla completa: botón abajo a la derecha y tecla F. Esc (del navegador)
 * sale. El juego es muy oscuro y la luz de las barras del navegador molesta.
 *
 * Funciona en el menú y durante la partida. Si el navegador no la permite
 * (p. ej. Safari en iPhone), el botón no aparece.
 */
export function crearPantallaCompleta(boton: HTMLButtonElement) {
  const raiz = document.documentElement;
  if (!document.fullscreenEnabled || !raiz.requestFullscreen) {
    boton.hidden = true;
    return { alternar() {} };
  }

  const alternar = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void raiz.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  };

  const pintar = () => {
    const dentro = document.fullscreenElement !== null;
    boton.textContent = dentro ? '🗗' : '⛶';
    boton.title = dentro ? 'Salir de pantalla completa (F o Esc)' : 'Pantalla completa (F)';
    boton.setAttribute('aria-label', boton.title);
    boton.setAttribute('aria-pressed', String(dentro));
  };

  boton.hidden = false;
  boton.addEventListener('click', () => {
    alternar();
    boton.blur(); // que la barra espaciadora no lo vuelva a pulsar al saltar
  });
  document.addEventListener('fullscreenchange', pintar);
  // La F funciona siempre, salvo escribiendo (el nombre o el código de sala).
  window.addEventListener('keydown', (e) => {
    const escribiendo = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.code === 'KeyF' && !e.repeat && !escribiendo) alternar();
  });
  pintar();
  return { alternar };
}

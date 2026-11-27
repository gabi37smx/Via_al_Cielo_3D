/*
 * Botón de sonido (abajo a la derecha, junto a la pantalla completa) y tecla
 * M para silenciar. Se recuerda en el navegador.
 */
import type { Audio } from '../sonido/audio.ts';

export function crearBotonSonido(boton: HTMLButtonElement, audio: Audio) {
  const pintar = () => {
    const callado = audio.silenciado();
    boton.textContent = callado ? '🔇' : '🔊';
    boton.title = callado ? 'Activar el sonido (M)' : 'Silenciar (M)';
    boton.setAttribute('aria-label', boton.title);
    boton.setAttribute('aria-pressed', String(callado));
  };
  const alternar = () => audio.silenciar(!audio.silenciado());

  boton.hidden = false;
  boton.addEventListener('click', () => {
    alternar();
    boton.blur(); // que la barra espaciadora no lo vuelva a pulsar al saltar
  });
  window.addEventListener('keydown', (e) => {
    const escribiendo = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.code === 'KeyM' && !e.repeat && !escribiendo) alternar();
  });
  audio.alCambiarSilencio(pintar);
  pintar();
}

/*
 * Menú de pausa (sesión 7, petición de Gabi): la tecla P lo abre y lo cierra.
 * Esc sigue sirviendo para soltar el ratón, como en cualquier juego de
 * navegador.
 *
 * - Jugando solo es una PAUSA de verdad: el juego se para hasta Continuar.
 * - En una carrera no se puede parar a los demás: el menú se abre igual (tu
 *   escalador se queda quieto mientras está abierto), pero la carrera sigue.
 *
 * Trae también la ayuda con los controles. Solo dibuja y avisa: quién se para
 * y cómo se sale lo decide main.ts.
 */

export interface OpcionesPausa {
  /** true en una sala: no se para el juego y «Salir» saca de la sala. */
  enCarrera: boolean;
  alAbrir(): void;
  alCerrar(): void;
  alSalir(): void;
}

const CONTROLES = (enCarrera: boolean): [string, string][] => [
  ['WASD / flechas', 'moverse'],
  ['Espacio', 'saltar (otra vez en el aire: doble salto)'],
  ['Ratón / Q y E', 'girar la cámara (clic para capturar el ratón)'],
  ['Esc', 'soltar el ratón'],
  ['F', 'pantalla completa'],
  ['P', enCarrera ? 'menú (la carrera no se para)' : 'pausa'],
];

export function crearMenuPausa(raiz: HTMLElement, op: OpcionesPausa) {
  raiz.hidden = true;
  const caja = document.createElement('div');
  caja.className = 'pausa-caja';
  const titulo = document.createElement('h1');
  titulo.textContent = op.enCarrera ? 'Menú' : 'Pausa';
  caja.append(titulo);
  if (op.enCarrera) {
    const aviso = document.createElement('p');
    aviso.className = 'pausa-aviso';
    aviso.textContent = 'La carrera sigue: los demás continúan subiendo.';
    caja.append(aviso);
  }
  const continuar = document.createElement('button');
  continuar.type = 'button';
  continuar.className = 'pausa-continuar';
  continuar.textContent = 'Continuar';
  const salir = document.createElement('button');
  salir.type = 'button';
  salir.textContent = op.enCarrera ? 'Salir de la sala' : 'Salir al menú';
  const ayuda = document.createElement('dl');
  ayuda.className = 'pausa-ayuda';
  for (const [tecla, que] of CONTROLES(op.enCarrera)) {
    const dt = document.createElement('dt');
    dt.textContent = tecla;
    const dd = document.createElement('dd');
    dd.textContent = que;
    ayuda.append(dt, dd);
  }
  caja.append(continuar, salir, ayuda);
  raiz.replaceChildren(caja);

  let bloqueado = false;
  const abierto = () => !raiz.hidden;

  function abrir() {
    if (abierto() || bloqueado) return;
    raiz.hidden = false;
    // Soltar el ratón para poder pulsar los botones.
    if (document.pointerLockElement) document.exitPointerLock();
    continuar.focus();
    op.alAbrir();
  }
  function cerrar() {
    if (!abierto()) return;
    raiz.hidden = true;
    op.alCerrar();
  }

  continuar.addEventListener('click', cerrar);
  salir.addEventListener('click', () => {
    salir.disabled = true;
    op.alSalir();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat) return;
    if (abierto()) cerrar();
    else abrir();
  });

  return {
    abierto,
    /** Con otra pantalla delante (p. ej. el fin de la partida), P no hace nada. */
    bloquear(si: boolean) {
      bloqueado = si;
      if (si) cerrar();
    },
  };
}

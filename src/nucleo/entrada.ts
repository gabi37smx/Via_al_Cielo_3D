/*
 * Entrada: teclado, ratón y mando acaban en la MISMA estructura (`Mando`),
 * así el resto del juego no sabe ni le importa con qué se juega.
 *
 * La lógica la lee una vez por paso fijo con `leer()`. Las pulsaciones
 * (saltar) solo valen en el paso en que se leen: si se pulsa entre dos pasos,
 * se guarda hasta el siguiente y luego se borra.
 */
export interface Mando {
  /** −1 (izquierda) a 1 (derecha). */
  moverX: number;
  /** −1 (atrás) a 1 (adelante). */
  moverY: number;
  /** Giro de cámara analógico (Q/E, stick derecho), de −1 a 1. */
  girarX: number;
  girarY: number;
  /** Píxeles que se ha movido el ratón (capturado) desde la última lectura. */
  ratonX: number;
  ratonY: number;
  saltar: boolean;
}

export interface Entrada {
  leer(): Mando;
  /** Llama a `accion` una vez cada vez que se pulsa la tecla (p. ej. F3). */
  alPulsar(codigo: string, accion: () => void): void;
}

const ZONA_MUERTA = 0.15;
const muerta = (v: number) => (Math.abs(v) < ZONA_MUERTA ? 0 : v);
const limitar = (v: number) => Math.max(-1, Math.min(1, v));

export function crearEntrada(lienzo: HTMLCanvasElement): Entrada {
  const pulsadas = new Set<string>();
  const acciones = new Map<string, () => void>();
  let saltoPendiente = false;
  let ratonX = 0;
  let ratonY = 0;
  let botonSaltoAntes = false;

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) {
      acciones.get(e.code)?.();
      if (e.code === 'Space') saltoPendiente = true;
    }
    pulsadas.add(e.code);
    if (acciones.has(e.code) || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => pulsadas.delete(e.code));
  // Al cambiar de ventana no llega el keyup: se sueltan todas.
  window.addEventListener('blur', () => pulsadas.clear());

  // Ratón: clic en el juego para capturarlo (Esc lo suelta).
  lienzo.addEventListener('click', () => {
    if (document.pointerLockElement !== lienzo) lienzo.requestPointerLock?.();
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== lienzo) return;
    ratonX += e.movementX;
    ratonY += e.movementY;
  });

  const tecla = (...codigos: string[]) => (codigos.some((c) => pulsadas.has(c)) ? 1 : 0);

  return {
    leer() {
      let moverX = tecla('KeyD', 'ArrowRight') - tecla('KeyA', 'ArrowLeft');
      let moverY = tecla('KeyW', 'ArrowUp') - tecla('KeyS', 'ArrowDown');
      let girarX = tecla('KeyE') - tecla('KeyQ');
      let girarY = 0;
      let saltar = saltoPendiente;

      // Mando (mapeo estándar): stick izquierdo mueve, derecho gira, A salta.
      for (const m of navigator.getGamepads?.() ?? []) {
        if (!m) continue;
        moverX += muerta(m.axes[0] ?? 0);
        moverY -= muerta(m.axes[1] ?? 0);
        girarX += muerta(m.axes[2] ?? 0);
        girarY += muerta(m.axes[3] ?? 0);
        const boton = m.buttons[0]?.pressed ?? false;
        if (boton && !botonSaltoAntes) saltar = true;
        botonSaltoAntes = boton;
      }

      const mando: Mando = {
        moverX: limitar(moverX),
        moverY: limitar(moverY),
        girarX: limitar(girarX),
        girarY: limitar(girarY),
        ratonX,
        ratonY,
        saltar,
      };
      saltoPendiente = false;
      ratonX = ratonY = 0;
      return mando;
    },
    alPulsar: (codigo, accion) => acciones.set(codigo, accion),
  };
}

/*
 * Teclado: qué teclas están pulsadas AHORA. La lógica las consulta en cada
 * paso fijo (no reacciona a los eventos sueltos), así se mueve lo mismo
 * vaya el juego a los fps que vaya.
 */
export interface Entrada {
  pulsada(codigo: string): boolean;
  /** Llama a `accion` una vez cada vez que se pulsa la tecla (p. ej. F3). */
  alPulsar(codigo: string, accion: () => void): void;
}

export function crearEntrada(objetivo: Window = window): Entrada {
  const pulsadas = new Set<string>();
  const acciones = new Map<string, () => void>();

  objetivo.addEventListener('keydown', (e) => {
    if (!e.repeat) acciones.get(e.code)?.();
    pulsadas.add(e.code);
    if (acciones.has(e.code)) e.preventDefault();
  });
  objetivo.addEventListener('keyup', (e) => pulsadas.delete(e.code));
  // Al cambiar de ventana no llega el keyup: se sueltan todas.
  objetivo.addEventListener('blur', () => pulsadas.clear());

  return {
    pulsada: (codigo) => pulsadas.has(codigo),
    alPulsar: (codigo, accion) => acciones.set(codigo, accion),
  };
}

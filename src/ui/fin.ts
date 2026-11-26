/*
 * Pantalla de fin de partida: resumen, récord y volver a jugar.
 * El récord se guarda en el navegador (localStorage). El ranking mundial
 * (API de Vía al Cielo) llega en la versión 1.0.
 */
const CLAVE_RECORD = 'via-al-cielo-3d:record';

export function leerRecord(): number {
  try {
    return Number(localStorage.getItem(CLAVE_RECORD)) || 0;
  } catch {
    return 0; // navegación privada o almacenamiento bloqueado
  }
}

/** Guarda la altura si mejora el récord. Devuelve true si es récord nuevo. */
export function guardarRecord(altura: number): boolean {
  if (altura <= leerRecord()) return false;
  try {
    localStorage.setItem(CLAVE_RECORD, String(Math.floor(altura)));
  } catch {
    /* sin almacenamiento: el récord dura lo que la pestaña */
  }
  return true;
}

export interface Resumen {
  altura: number;
  fragmentos: number;
  segundos: number;
  record: number;
  recordNuevo: boolean;
}

export function crearPantallaFin(raiz: HTMLElement, alVolver: () => void) {
  raiz.hidden = true;
  const volver = () => {
    if (raiz.hidden) return;
    raiz.hidden = true;
    alVolver();
  };
  raiz.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) volver();
  });
  window.addEventListener('keydown', (e) => {
    if (!raiz.hidden && (e.code === 'Enter' || e.code === 'KeyR')) volver();
  });

  return {
    get visible() {
      return !raiz.hidden;
    },
    mostrar(r: Resumen) {
      document.exitPointerLock?.();
      const min = Math.floor(r.segundos / 60);
      const seg = String(Math.floor(r.segundos % 60)).padStart(2, '0');
      raiz.innerHTML = `
        <div class="fin-caja">
          <h1>Fin de la partida</h1>
          ${r.recordNuevo ? '<p class="fin-record">¡Récord nuevo!</p>' : ''}
          <dl>
            <dt>Altura máxima</dt><dd>${Math.floor(r.altura)} m</dd>
            <dt>Fragmentos</dt><dd>${r.fragmentos}</dd>
            <dt>Tiempo</dt><dd>${min}:${seg}</dd>
            <dt>Récord</dt><dd>${Math.floor(r.record)} m</dd>
          </dl>
          <button type="button">Volver a jugar</button>
          <p class="fin-ayuda">o pulsa Enter</p>
        </div>`;
      raiz.hidden = false;
      raiz.querySelector('button')?.focus();
    },
  };
}

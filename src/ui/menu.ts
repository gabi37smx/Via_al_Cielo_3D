/*
 * Menú de inicio: jugar solo, crear una sala o unirse con un código.
 * Devuelve lo que ha elegido el jugador; no sabe nada de la red.
 */
import { limpiarNombre, normalizarCodigo } from '../red/protocolo.ts';

export type Eleccion =
  | { modo: 'solo' }
  | { modo: 'crear'; nombre: string }
  | { modo: 'unirse'; nombre: string; codigo: string };

const CLAVE_NOMBRE = 'via-al-cielo-3d:nombre';

function nombreGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? '';
  } catch {
    return '';
  }
}

function guardarNombre(n: string) {
  try {
    localStorage.setItem(CLAVE_NOMBRE, n);
  } catch {
    /* sin almacenamiento: se pedirá otra vez */
  }
}

/** Muestra el menú y espera a que el jugador elija. `error` se enseña arriba (p. ej. sala llena). */
export function mostrarMenu(raiz: HTMLElement, hayRed: boolean, error = ''): Promise<Eleccion> {
  raiz.innerHTML = `
    <div class="menu-caja">
      <h1>Vía al Cielo <span>3D</span></h1>
      ${error ? `<p class="menu-error" role="alert"></p>` : ''}
      <button type="button" class="menu-solo">Jugar solo</button>
      <div class="menu-carrera">
        <h2>Carrera (2-4 jugadores)</h2>
        <label>Tu nombre <input class="menu-nombre" maxlength="12" autocomplete="nickname" /></label>
        <button type="button" class="menu-crear">Crear sala</button>
        <div class="menu-unirse">
          <input class="menu-codigo" maxlength="5" placeholder="CÓDIGO" aria-label="Código de la sala" autocapitalize="characters" />
          <button type="button" class="menu-entrar">Unirse</button>
        </div>
        ${hayRed ? '' : '<p class="menu-aviso">Carrera no disponible: falta configurar Supabase (.env)</p>'}
      </div>
    </div>`;
  raiz.hidden = false;
  const $ = <T extends HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  if (error) $('.menu-error').textContent = error; // textContent: el texto no se interpreta como HTML
  const nombre = $<HTMLInputElement>('.menu-nombre');
  const codigo = $<HTMLInputElement>('.menu-codigo');
  nombre.value = nombreGuardado();
  for (const sel of ['.menu-crear', '.menu-entrar']) $<HTMLButtonElement>(sel).disabled = !hayRed;
  $<HTMLButtonElement>('.menu-solo').focus();

  return new Promise((resolver) => {
    const terminar = (e: Eleccion) => {
      raiz.hidden = true;
      resolver(e);
    };
    const leerNombre = () => {
      const n = limpiarNombre(nombre.value);
      guardarNombre(n);
      return n;
    };
    $('.menu-solo').addEventListener('click', () => terminar({ modo: 'solo' }));
    $('.menu-crear').addEventListener('click', () => terminar({ modo: 'crear', nombre: leerNombre() }));
    const unirse = () => {
      const c = normalizarCodigo(codigo.value);
      if (!c) {
        codigo.setCustomValidity('El código tiene 4 letras');
        codigo.reportValidity();
        return;
      }
      terminar({ modo: 'unirse', nombre: leerNombre(), codigo: c });
    };
    codigo.addEventListener('input', () => codigo.setCustomValidity(''));
    codigo.addEventListener('keydown', (e) => e.key === 'Enter' && unirse());
    $('.menu-entrar').addEventListener('click', unirse);
  });
}

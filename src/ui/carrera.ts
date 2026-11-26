/*
 * Lo que se ve de la carrera (sesión 6). Solo DIBUJA: qué fase es, quién va
 * primero y cuándo se acaba lo deciden reglas/carrera.ts y modos/carrera.ts.
 *
 * - Sala de espera: el anfitrión elige si rellenar con rivales del ordenador
 *   y pulsa «Empezar carrera» (o Intro); los demás esperan.
 * - Cuenta atrás grande en el centro: 3, 2, 1, ¡YA!
 * - Reloj de carrera arriba y aviso de «Reapareces en…».
 * - Resultados: puesto, nombre y tiempo (o altura, si no ha llegado);
 *   el anfitrión puede empezar otra carrera.
 */
import { formatearTiempo, type FilaClasificacion } from '../reglas/carrera.ts';

export interface OpcionesPantallaCarrera {
  /** El anfitrión pulsa «Empezar carrera» u «Otra carrera». */
  alEmpezar(conOrdenador: boolean): void;
}

function crear<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(etiqueta);
  el.className = clase;
  el.textContent = texto; // textContent: los nombres se ven como texto, nunca como HTML
  return el;
}

export function crearPantallaCarrera(raiz: HTMLElement, op: OpcionesPantallaCarrera) {
  raiz.hidden = false;
  raiz.replaceChildren();
  const reloj = crear('div', 'carrera-reloj');
  const grande = crear('div', 'carrera-grande');
  const caja = crear('div', 'carrera-caja');
  raiz.append(reloj, grande, caja);
  reloj.hidden = true;
  caja.hidden = true;

  let conOrdenador = true;
  /** Lo que hay ahora en la caja (para no rehacerla en cada fotograma). */
  let clave = '';
  let puedeEmpezar = false;

  const empezar = () => {
    if (!puedeEmpezar) return;
    puedeEmpezar = false;
    op.alEmpezar(conOrdenador);
  };
  window.addEventListener('keydown', (e) => {
    // Intro sobre un botón (p. ej. «Continuar» del menú de pausa) es ese botón, no empezar.
    if (e.key === 'Enter' && puedeEmpezar && !(e.target instanceof HTMLButtonElement)) empezar();
  });

  function botonEmpezar(texto: string): HTMLElement {
    const pie = crear('div', 'carrera-pie');
    const marca = crear('label', 'carrera-ordenador');
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.checked = conOrdenador;
    casilla.addEventListener('change', () => (conOrdenador = casilla.checked));
    marca.append(casilla, ' Rellenar con rivales del ordenador');
    const boton = crear('button', 'carrera-empezar', texto);
    boton.type = 'button';
    boton.addEventListener('click', empezar);
    pie.append(marca, boton, crear('p', 'carrera-ayuda', 'o pulsa Intro'));
    return pie;
  }

  return {
    /** Sala de espera antes de la primera carrera. */
    esperando(esAnfitrion: boolean, nombreAnfitrion: string, personas: number) {
      const k = `esperando|${esAnfitrion}|${nombreAnfitrion}|${personas}`;
      if (k === clave) return;
      clave = k;
      puedeEmpezar = esAnfitrion;
      caja.hidden = false;
      caja.replaceChildren(crear('h2', '', 'Carrera hasta los 220 m'));
      if (esAnfitrion) {
        const texto = personas > 1 ? `Sois ${personas}. Cuando estéis todos, empieza.` : 'No hay nadie más en la sala: corre contra el ordenador o espera a los demás.';
        caja.append(crear('p', '', texto), botonEmpezar('Empezar carrera'));
      } else {
        caja.append(crear('p', '', `Esperando a que ★ ${nombreAnfitrion} empiece la carrera…`));
      }
    },
    /** Quita la caja (al empezar la cuenta atrás). */
    cerrarCaja() {
      clave = '';
      puedeEmpezar = false;
      caja.hidden = true;
    },
    /** 3, 2, 1 o «¡YA!» en grande, un momento (se desvanece solo con CSS). */
    numero(texto: string) {
      grande.classList.remove('carrera-fijo', 'carrera-sale');
      grande.textContent = texto;
      void grande.offsetWidth; // reinicia la animación
      grande.classList.add('carrera-sale');
    },
    /** Aviso fijo en el centro (p. ej. «Reapareces en 2»); null lo quita. */
    aviso(texto: string | null) {
      if (texto !== null) {
        grande.classList.remove('carrera-sale');
        grande.classList.add('carrera-fijo');
        if (grande.textContent !== texto) grande.textContent = texto;
      } else if (grande.classList.contains('carrera-fijo')) {
        grande.classList.remove('carrera-fijo');
        grande.textContent = '';
      }
    },
    /** Reloj de carrera (null lo esconde). */
    reloj(segundos: number | null) {
      reloj.hidden = segundos === null;
      if (segundos !== null) reloj.textContent = formatearTiempo(segundos);
    },
    /**
     * Resultados (provisionales mientras quedan corredores; `final` cuando
     * el anfitrión la da por acabada).
     */
    resultados(filas: FilaClasificacion[], final: boolean, esAnfitrion: boolean, yo: string) {
      const k = `res|${final}|${esAnfitrion}|${filas.map((f) => `${f.id}:${f.tiempo ?? Math.floor(f.altura)}`).join(',')}`;
      if (k === clave) return;
      clave = k;
      puedeEmpezar = final && esAnfitrion;
      caja.hidden = false;
      caja.replaceChildren(crear('h2', '', final ? 'Resultados' : 'Llegadas (aún hay gente subiendo)'));
      const tabla = crear('ol', 'carrera-tabla');
      for (const f of filas) {
        const li = crear('li', f.id === yo ? 'carrera-yo' : '');
        li.append(
          crear('span', 'carrera-puesto', `${f.puesto}º`),
          crear('span', 'carrera-nombre', `${f.nombre}${f.persona ? '' : ' (CPU)'}${f.id === yo ? ' (tú)' : ''}`),
          crear('b', '', f.tiempo !== null ? formatearTiempo(f.tiempo) : `${Math.floor(f.altura)} m`),
        );
        tabla.append(li);
      }
      caja.append(tabla);
      if (final) caja.append(esAnfitrion ? botonEmpezar('Otra carrera') : crear('p', '', 'Esperando a que el anfitrión empiece otra…'));
    },
  };
}

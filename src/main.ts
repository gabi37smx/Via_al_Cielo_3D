import './estilo.css';
import { crearBucle } from './nucleo/bucle.ts';
import { crearEntrada } from './nucleo/entrada.ts';
import { generarTramo } from './reglas/torre.ts';
import { crearCueva } from './mundo/cueva.ts';
import { crearEscena } from './mundo/escena.ts';
import { crearTexturaRoca } from './mundo/texturas.ts';
import { crearTorre } from './mundo/torre.ts';
import { crearContadorFps } from './ui/fps.ts';
import { crearPanel } from './ui/panel.ts';

/*
 * Parámetros de la dirección (útiles para probar y para la captura):
 *   ?semilla=1234   torre concreta (sin ella, una al azar)
 *   ?altura=60      altura inicial de la cámara (m)
 *   ?panel=1        abre el panel de datos (también con F3)
 */
const parametros = new URLSearchParams(location.search);
const semilla = Number(parametros.get('semilla')) || Math.floor(Math.random() * 1e9);
const alturaInicial = Number(parametros.get('altura')) || 1.5;

const lienzo = document.querySelector<HTMLCanvasElement>('#lienzo')!;
const mundo = crearEscena(lienzo, alturaInicial);
const entrada = crearEntrada();
const fps = crearContadorFps(document.querySelector<HTMLElement>('#fps')!);
const panel = crearPanel(document.querySelector<HTMLElement>('#panel')!, mundo.renderer, parametros.has('panel'));
entrada.alPulsar('F3', panel.alternar);
window.addEventListener('resize', mundo.redimensionar);

// El mundo: la cueva y el primer tramo de la torre (220 m).
const roca = crearTexturaRoca({ oscuro: '#2b2620', claro: '#8c7f6c' });
const piedra = crearTexturaRoca({ oscuro: '#6b6356', claro: '#d9cdb4', semilla: 7, relieve: 4 });
mundo.escena.add(crearCueva(mundo.escena, roca));
mundo.escena.add(crearTorre(generarTramo(semilla, 0), roca, piedra));

// Vista libre (hasta que llegue el escalador en la sesión 3): W/S o flechas
// arriba/abajo suben y bajan la cámara; el ratón gira y la rueda acerca.
const VELOCIDAD_VISTA = 12; // m/s
let fotogramasPintados = 0;

const bucle = crearBucle({
  actualizar(paso) {
    const sube = entrada.pulsada('KeyW') || entrada.pulsada('ArrowUp');
    const baja = entrada.pulsada('KeyS') || entrada.pulsada('ArrowDown');
    if (sube !== baja) mundo.moverVista((sube ? 1 : -1) * VELOCIDAD_VISTA * paso);
  },
  pintar(_alfa, dtReal) {
    mundo.pintar();
    fps.contar(dtReal);
    panel.actualizar(dtReal, { semilla, altura: mundo.altura });

    // Aviso para herramientas/captura.mjs: la escena ya se ha pintado varias veces.
    if (++fotogramasPintados === 10) document.body.dataset.listo = 'si';
  },
});

bucle.arrancar();

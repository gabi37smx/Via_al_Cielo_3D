import './estilo.css';
import { crearBucle } from './nucleo/bucle.ts';
import { crearEscena } from './mundo/escena.ts';
import { crearContadorFps } from './ui/fps.ts';

const lienzo = document.querySelector<HTMLCanvasElement>('#lienzo')!;
const marcadorFps = document.querySelector<HTMLElement>('#fps')!;

const mundo = crearEscena(lienzo);
const fps = crearContadorFps(marcadorFps);
window.addEventListener('resize', mundo.redimensionar);

// Estado de la lógica: el ángulo del cubo, ahora y en el paso anterior.
const VUELTAS_POR_SEGUNDO = 0.25;
let angulo = 0;
let anguloAnterior = 0;
let fotogramasPintados = 0;

const bucle = crearBucle({
  actualizar(paso) {
    anguloAnterior = angulo;
    angulo += VUELTAS_POR_SEGUNDO * Math.PI * 2 * paso;
  },
  pintar(alfa, dtReal) {
    // Mezcla el paso anterior y el actual: giro suave a cualquier frecuencia de pantalla.
    mundo.cubo.rotation.y = anguloAnterior + (angulo - anguloAnterior) * alfa;
    mundo.pintar();
    fps.contar(dtReal);

    // Aviso para herramientas/captura.mjs: la escena ya se ha pintado varias veces.
    if (++fotogramasPintados === 10) document.body.dataset.listo = 'si';
  },
});

bucle.arrancar();

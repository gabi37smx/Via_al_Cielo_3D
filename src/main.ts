import './estilo.css';
import { CONFIG } from './config.ts';
import { crearEscalador, pasoEscalador } from './jugador/control.ts';
import { crearPersonaje } from './jugador/personaje.ts';
import { crearBucle } from './nucleo/bucle.ts';
import { crearEntrada } from './nucleo/entrada.ts';
import { RADIO_SALIENTES, alturaSuelo, generarTramo, posicionSaliente } from './reglas/torre.ts';
import { crearCamaraTerceraPersona } from './mundo/camara.ts';
import { crearCueva } from './mundo/cueva.ts';
import { crearEscena } from './mundo/escena.ts';
import { crearSombra } from './mundo/sombra.ts';
import { crearTexturaRoca } from './mundo/texturas.ts';
import { crearTorre } from './mundo/torre.ts';
import { crearContadorFps } from './ui/fps.ts';
import { crearPanel } from './ui/panel.ts';

/*
 * Parámetros de la dirección (útiles para probar y para la captura):
 *   ?semilla=1234   torre concreta (sin ella, una al azar)
 *   ?altura=60      empieza en el primer saliente a partir de esa altura (m)
 *   ?panel=1        abre el panel de datos (también con F3)
 */
const parametros = new URLSearchParams(location.search);
const semilla = Number(parametros.get('semilla')) || Math.floor(Math.random() * 1e9);
const alturaInicial = Number(parametros.get('altura')) || 0;

const lienzo = document.querySelector<HTMLCanvasElement>('#lienzo')!;
const mundo = crearEscena(lienzo);
const entrada = crearEntrada(lienzo);
const fps = crearContadorFps(document.querySelector<HTMLElement>('#fps')!);
const panel = crearPanel(document.querySelector<HTMLElement>('#panel')!, mundo.renderer, parametros.has('panel'));
entrada.alPulsar('F3', panel.alternar);
window.addEventListener('resize', mundo.redimensionar);

// El mundo: la cueva y el primer tramo de la torre (220 m).
const tramo = generarTramo(semilla, 0);
const suelo = (x: number, z: number, techo: number) => alturaSuelo(tramo, x, z, techo);
const roca = crearTexturaRoca({ oscuro: '#2b2620', claro: '#8c7f6c' });
const piedra = crearTexturaRoca({ oscuro: '#6b6356', claro: '#d9cdb4', semilla: 7, relieve: 4 });
mundo.escena.add(crearCueva(mundo.escena, roca));
mundo.escena.add(crearTorre(tramo, roca, piedra));

// El escalador: en el suelo, junto al primer saliente, o en el saliente pedido con ?altura.
const inicio = tramo.salientes.find((s) => s.y >= alturaInicial) ?? tramo.salientes[0]!;
const anguloInicio = alturaInicial > 0 ? inicio.angulo : inicio.angulo - 0.7;
const salida = alturaInicial > 0
  ? { ...posicionSaliente(inicio), y: inicio.y }
  : { x: Math.cos(anguloInicio) * (RADIO_SALIENTES + 2), z: Math.sin(anguloInicio) * (RADIO_SALIENTES + 2), y: 0 };
const escalador = crearEscalador(salida.x, salida.y, salida.z);
escalador.orientacion = Math.atan2(-Math.cos(anguloInicio), -Math.sin(anguloInicio)); // mirando a la columna
const anterior = { x: salida.x, y: salida.y, z: salida.z };

const personaje = crearPersonaje();
const sombra = crearSombra();
mundo.escena.add(personaje.raiz, sombra.mancha);

// La cámara empieza fuera de la torre, mirando hacia la columna.
const camara = crearCamaraTerceraPersona(mundo.camara, Math.PI / 2 - anguloInicio);
const CC = CONFIG.camara;
let fotogramasPintados = 0;
const pintado = { x: 0, y: 0, z: 0 };

const bucle = crearBucle({
  actualizar(paso) {
    const m = entrada.leer();
    camara.girar(
      -m.ratonX * CC.sensibilidadRaton - m.girarX * CC.velocidadGiro * paso,
      m.ratonY * CC.sensibilidadRaton + m.girarY * CC.velocidadGiro * paso,
    );

    anterior.x = escalador.x;
    anterior.y = escalador.y;
    anterior.z = escalador.z;
    const sucesos = pasoEscalador(
      escalador,
      { moverX: m.moverX, moverY: m.moverY, saltar: m.saltar, giroCamara: camara.giro },
      suelo,
      paso,
    );
    if (sucesos.aterrizaje > 0.5) personaje.aterrizar(sucesos.aterrizaje / 6);
  },
  pintar(alfa, dtReal) {
    // Posición mezclada entre el paso anterior y el actual (movimiento suave).
    pintado.x = anterior.x + (escalador.x - anterior.x) * alfa;
    pintado.y = anterior.y + (escalador.y - anterior.y) * alfa;
    pintado.z = anterior.z + (escalador.z - anterior.z) * alfa;

    personaje.colocar(pintado.x, pintado.y, pintado.z, escalador.orientacion);
    personaje.animar(
      escalador.postura,
      Math.hypot(escalador.vx, escalador.vz),
      1 - escalador.voltereta / CONFIG.escalador.voltereta,
      dtReal,
    );
    sombra.colocar(pintado.x, suelo(pintado.x, pintado.z, pintado.y + 0.05), pintado.z, pintado.y);
    camara.seguir(pintado.x, pintado.y, pintado.z, dtReal);

    mundo.pintar(pintado);
    fps.contar(dtReal);
    panel.actualizar(dtReal, { semilla, altura: escalador.y, postura: escalador.postura });

    // Aviso para herramientas/captura.mjs: la escena ya se ha pintado varias veces.
    if (++fotogramasPintados === 10) document.body.dataset.listo = 'si';
  },
});

bucle.arrancar();

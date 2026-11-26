import './estilo.css';
import { CONFIG } from './config.ts';
import { crearEscalador, pasoEscalador, type Escalador, type Ordenes } from './jugador/control.ts';
import { cargarPersonaje } from './jugador/personaje.ts';
import { crearBucle } from './nucleo/bucle.ts';
import { crearEntrada } from './nucleo/entrada.ts';
import {
  REGLAS,
  crearPartida,
  generarFragmentos,
  generarMurcielagos,
  pasoPartida,
  type Jugada,
  type Partida,
} from './reglas/partida.ts';
import { RADIO_SALIENTES, alturaSuelo, generarTramo, posicionSaliente } from './reglas/torre.ts';
import { crearCamaraTerceraPersona } from './mundo/camara.ts';
import { crearCueva } from './mundo/cueva.ts';
import { crearEscena } from './mundo/escena.ts';
import { crearFragmentos, crearMurcielagos } from './mundo/objetos.ts';
import { crearSombra } from './mundo/sombra.ts';
import { crearTexturaRoca } from './mundo/texturas.ts';
import { crearTorre } from './mundo/torre.ts';
import { crearPantallaFin, guardarRecord, leerRecord } from './ui/fin.ts';
import { crearContadorFps } from './ui/fps.ts';
import { crearHud } from './ui/hud.ts';
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
const hud = crearHud(document.querySelector<HTMLElement>('#hud')!);
const fin = crearPantallaFin(document.querySelector<HTMLElement>('#fin')!, reiniciar);
entrada.alPulsar('F3', panel.alternar);
window.addEventListener('resize', mundo.redimensionar);

// El mundo: la cueva y el primer tramo de la torre (220 m), con sus objetos.
const tramo = generarTramo(semilla, 0);
const suelo = (x: number, z: number, techo: number) => alturaSuelo(tramo, x, z, techo);
const peligros = {
  fragmentos: generarFragmentos(semilla, tramo),
  murcielagos: generarMurcielagos(semilla, tramo, REGLAS.murcielagosCueva),
};
const roca = crearTexturaRoca({ oscuro: '#2b2620', claro: '#8c7f6c' });
const piedra = crearTexturaRoca({ oscuro: '#6b6356', claro: '#d9cdb4', semilla: 7, relieve: 4 });
const fragmentos = crearFragmentos(peligros.fragmentos);
const murcielagos = crearMurcielagos(peligros.murcielagos);
mundo.escena.add(crearCueva(mundo.escena, roca), crearTorre(tramo, roca, piedra), fragmentos.grupo, murcielagos.grupo);

// Dónde empieza: en el suelo junto al primer saliente, o en el saliente pedido con ?altura.
const inicio = tramo.salientes.find((s) => s.y >= alturaInicial) ?? tramo.salientes[0]!;
const anguloInicio = alturaInicial > 0 ? inicio.angulo : inicio.angulo - 0.7;
const salida = alturaInicial > 0
  ? { ...posicionSaliente(inicio), y: inicio.y }
  : { x: Math.cos(anguloInicio) * (RADIO_SALIENTES + 2), z: Math.sin(anguloInicio) * (RADIO_SALIENTES + 2), y: 0 };

// El modelo del escalador se descarga (~270 kB): el juego arranca cuando llega.
const personaje = await cargarPersonaje();
const sombra = crearSombra();
mundo.escena.add(personaje.raiz, sombra.mancha);
const camara = crearCamaraTerceraPersona(mundo.camara, Math.PI / 2 - anguloInicio);

let escalador: Escalador;
let partida: Partida;
const anterior = { x: 0, y: 0, z: 0 };

function reiniciar() {
  escalador = crearEscalador(salida.x, salida.y, salida.z);
  escalador.orientacion = Math.atan2(-Math.cos(anguloInicio), -Math.sin(anguloInicio)); // mirando a la columna
  Object.assign(anterior, salida);
  partida = crearPartida();
  partida.alturaMaxima = salida.y;
  fragmentos.mostrarTodos();
}
reiniciar();

/** Lo que se ve y se oye reacciona a las jugadas de las reglas. */
function atender(j: Jugada) {
  switch (j.tipo) {
    case 'fragmento':
      fragmentos.ocultar(j.id);
      hud.avisar(`Fragmento ${j.enTramo}/${REGLAS.fragmentosPorTramo}`, 'bueno');
      break;
    case 'vidaExtra':
      hud.avisar(j.cantidad > 0 ? `+${j.cantidad} % de vida` : 'Vida al máximo', 'bueno');
      break;
    case 'golpe':
      hud.avisar(`Murciélago: −${j.danio}`, 'malo');
      hud.destello();
      break;
    case 'caida':
      hud.avisar(`Caída de ${Math.round(j.metros)} m: −${j.danio}`, 'malo');
      hud.destello();
      break;
    case 'fin': {
      const recordNuevo = guardarRecord(partida.alturaMaxima);
      fin.mostrar({
        altura: partida.alturaMaxima,
        fragmentos: partida.recogidos.length,
        segundos: partida.tiempo,
        record: leerRecord(),
        recordNuevo,
      });
      break;
    }
  }
}

const QUIETO: Ordenes = { moverX: 0, moverY: 0, saltar: false, giroCamara: 0 };
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
    // Con la partida acabada ya no obedece, pero sigue cayendo si estaba en el aire.
    const ordenes = partida.terminada
      ? { ...QUIETO, giroCamara: camara.giro }
      : { moverX: m.moverX, moverY: m.moverY, saltar: m.saltar, giroCamara: camara.giro };
    const sucesos = pasoEscalador(escalador, ordenes, suelo, paso);
    if (sucesos.aterrizaje > 0.5) personaje.aterrizar(sucesos.aterrizaje / 6);

    const situacion = { x: escalador.x, y: escalador.y, z: escalador.z, aterrizaje: sucesos.aterrizaje };
    for (const j of pasoPartida(partida, situacion, peligros, paso)) atender(j);
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
    // Parpadea mientras es invulnerable.
    personaje.raiz.visible = partida.invulnerable === 0 || Math.floor(partida.invulnerable * 12) % 2 === 0;
    sombra.colocar(pintado.x, suelo(pintado.x, pintado.z, pintado.y + 0.05), pintado.z, pintado.y);
    camara.seguir(pintado.x, pintado.y, pintado.z, dtReal);

    const t = partida.tiempo + alfa * (1 / 60);
    fragmentos.animar(t);
    murcielagos.actualizar(t);

    mundo.pintar(pintado);
    fps.contar(dtReal);
    panel.actualizar(dtReal, { semilla, altura: escalador.y, postura: escalador.postura });
    hud.actualizar({
      vida: partida.vida,
      altura: escalador.y,
      record: Math.max(leerRecord(), partida.alturaMaxima),
      fragmentos: partida.recogidos.length,
      tramo: 'Tramo 1 · La cueva',
    });

    // Aviso para herramientas/captura.mjs: la escena ya se ha pintado varias veces.
    if (++fotogramasPintados === 10) document.body.dataset.listo = 'si';
  },
});

bucle.arrancar();

// Para probar desde la consola del navegador (y desde la captura con --js):
//   juego.danar(50)   quita vida      juego.partida   el estado de las reglas
Object.assign(window, {
  juego: {
    get partida() {
      return partida;
    },
    get escalador() {
      return escalador;
    },
    danar(n: number) {
      partida.vida = Math.max(partida.vida - n, 1);
    },
  },
});

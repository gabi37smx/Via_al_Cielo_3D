import './estilo.css';
import { CONFIG } from './config.ts';
import { crearEscalador, pasoEscalador, type Escalador, type Ordenes } from './jugador/control.ts';
import { cargarModeloEscalador, crearPersonaje } from './jugador/personaje.ts';
import { ENVIOS_POR_SEGUNDO, generarCodigo, limpiarNombre, normalizarCodigo } from './red/protocolo.ts';
import { ErrorSala, configuracionRed, unirseASala, type Sala } from './red/sala.ts';
import { crearRivales } from './mundo/rivales.ts';
import { crearListaJugadores } from './ui/jugadores.ts';
import { mostrarMenu, type Eleccion } from './ui/menu.ts';
import { crearPantallaCompleta } from './ui/pantallaCompleta.ts';
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
import { alturaSuelo, generarTramo, posicionSaliente, puntoDeSalida } from './reglas/torre.ts';
import { crearCamaraTerceraPersona, giroHaciaPared } from './mundo/camara.ts';
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
 *   ?semilla=1234   torre concreta (sin ella, una al azar) → modo solo sin menú
 *   ?altura=60      empieza en el primer saliente a partir de esa altura (m)
 *   ?panel=1        abre el panel de datos (también con F3)
 *   ?solo=1         modo solo sin pasar por el menú
 *   ?sala=ABCD&nombre=Ana   entra directamente en esa sala (la crea si está vacía)
 */
const parametros = new URLSearchParams(location.search);
const alturaInicial = Number(parametros.get('altura')) || 0;
const semillaPropia = Number(parametros.get('semilla')) || Math.floor(Math.random() * 1e9);
const configRed = configuracionRed();
const menu = document.querySelector<HTMLElement>('#menu')!;
// Pantalla completa (botón y tecla F): disponible ya en el menú.
crearPantallaCompleta(document.querySelector<HTMLButtonElement>('#pantalla-completa')!);

// 1 · ¿Solo o en una sala?
let eleccion: Eleccion;
const codigoUrl = normalizarCodigo(parametros.get('sala') ?? '');
if (codigoUrl) eleccion = { modo: 'unirse', codigo: codigoUrl, nombre: limpiarNombre(parametros.get('nombre') ?? '') };
else if (['semilla', 'altura', 'solo'].some((p) => parametros.has(p))) eleccion = { modo: 'solo' };
else eleccion = await mostrarMenu(menu, configRed !== null);

let sala: Sala | null = null;
while (eleccion.modo !== 'solo') {
  const codigo = eleccion.modo === 'crear' ? generarCodigo() : eleccion.codigo;
  try {
    menu.hidden = false;
    menu.innerHTML = `<div class="menu-caja"><p>Conectando con la sala ${codigo}…</p></div>`;
    if (!configRed) throw new ErrorSala('Falta configurar Supabase (.env)');
    sala = await unirseASala(configRed, codigo, eleccion.nombre, semillaPropia);
    menu.hidden = true;
    break;
  } catch (e) {
    eleccion = await mostrarMenu(menu, configRed !== null, e instanceof Error ? e.message : String(e));
  }
}
// En una sala, la torre es la del anfitrión.
const semilla = sala?.semilla ?? semillaPropia;
/** Puesto en la sala (0 = anfitrión): cada uno sale desde un sitio distinto. */
const puesto = sala ? Math.max(sala.miembros().findIndex((m) => m.id === sala.yo.id), 0) : 0;

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
mundo.escena.add(crearCueva(mundo.escena, roca, tramo), crearTorre(tramo, piedra), fragmentos.grupo, murcielagos.grupo);

// Dónde empieza: en el suelo antes del primer saliente, o en el saliente pedido con ?altura.
const inicio = tramo.salientes.find((s) => s.y >= alturaInicial) ?? tramo.salientes[0]!;
const enSuelo = puntoDeSalida(tramo, puesto);
const anguloInicio = alturaInicial > 0 ? inicio.angulo : enSuelo.angulo;
const salida = alturaInicial > 0 ? { ...posicionSaliente(inicio), y: inicio.y } : { x: enSuelo.x, z: enSuelo.z, y: 0 };

// El modelo del escalador se descarga (~270 kB): el juego arranca cuando llega.
const modelo = await cargarModeloEscalador();
const personaje = crearPersonaje(modelo);
const sombra = crearSombra();
mundo.escena.add(personaje.raiz, sombra.mancha);
// La cámara empieza entre el escalador y el centro del pozo, mirando a la pared.
const camara = crearCamaraTerceraPersona(mundo.camara, giroHaciaPared(salida.x, salida.z));

// 2 · Los rivales de la sala: aparecen y desaparecen según la presencia de Supabase.
const rivales = crearRivales(mundo.escena, modelo);
const lista = sala ? crearListaJugadores(document.querySelector<HTMLElement>('#sala')!, sala.codigo) : null;
if (sala) {
  const s = sala;
  rivales.sincronizar(s.miembros(), s.yo.id);
  s.alCambiarMiembros((m) => rivales.sincronizar(m, s.yo.id));
  s.alRecibirEstado((id, e) => rivales.recibir(id, e, performance.now()));
  window.addEventListener('pagehide', () => void s.salir());
}
/** Cada cuántos pasos de lógica se envía el estado (60/10 = cada 6). */
const PASOS_POR_ENVIO = Math.round(60 / ENVIOS_POR_SEGUNDO);
let pasosDesdeEnvio = 0;

let escalador: Escalador;
let partida: Partida;
const anterior = { x: 0, y: 0, z: 0 };

function reiniciar() {
  escalador = crearEscalador(salida.x, salida.y, salida.z);
  escalador.orientacion = Math.atan2(Math.cos(anguloInicio), Math.sin(anguloInicio)); // mirando a la pared
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
    camara.recolocar(escalador.x, escalador.z, paso);

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

    // 10 veces por segundo, contar a la sala dónde estoy.
    if (sala && ++pasosDesdeEnvio >= PASOS_POR_ENVIO) {
      pasosDesdeEnvio = 0;
      sala.enviarEstado({
        t: performance.now(),
        x: escalador.x,
        y: escalador.y,
        z: escalador.z,
        orientacion: escalador.orientacion,
        postura: escalador.postura,
        rapidez: Math.hypot(escalador.vx, escalador.vz),
        voltereta: 1 - escalador.voltereta / CONFIG.escalador.voltereta,
      });
    }
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
    rivales.pintar(performance.now(), dtReal);
    if (sala && lista) {
      const alturas = rivales.alturas().set(sala.yo.id, escalador.y);
      lista.actualizar(sala.miembros(), sala.yo.id, sala.anfitrion()?.id, alturas);
    }

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
    /** Estado de la red: sala, quién está, quién es el anfitrión y dónde se ve a cada rival. */
    get red() {
      if (!sala) return null;
      return {
        codigo: sala.codigo,
        semilla,
        yo: sala.yo.nombre,
        anfitrion: sala.anfitrion()?.nombre,
        miembros: sala.miembros().map((m) => m.nombre),
        rivales: rivales.vistos(),
      };
    },
  },
});

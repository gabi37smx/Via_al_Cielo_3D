import './estilo.css';
import { CONFIG } from './config.ts';
import { progresoPostura, type Ordenes } from './jugador/control.ts';
import { cargarModelos, crearPersonaje } from './jugador/personaje.ts';
import { ENVIOS_POR_SEGUNDO, generarCodigo, leerAspecto, limpiarNombre, normalizarCodigo } from './red/protocolo.ts';
import { ErrorSala, configuracionRed, unirseASala, type Sala } from './red/sala.ts';
import { crearRivales } from './mundo/rivales.ts';
import { crearListaJugadores } from './ui/jugadores.ts';
import { aspectoGuardado, mostrarMenu, type Eleccion } from './ui/menu.ts';
import { crearPantallaCompleta } from './ui/pantallaCompleta.ts';
import { crearBotonSonido } from './ui/botonSonido.ts';
import { crearAudio } from './sonido/audio.ts';
import { crearOido, sonidosDelPaso } from './sonido/sucesos.ts';
import { crearBucle } from './nucleo/bucle.ts';
import { crearEntrada } from './nucleo/entrada.ts';
import { REGLAS, generarFragmentos, generarMurcielagos, murcielagosDelTramo, type Jugada } from './reglas/partida.ts';
import { crearCorredor, pasoCorredor, type Corredor } from './reglas/carrera.ts';
import { crearCarreraEnSala } from './modos/carrera.ts';
import { crearPantallaCarrera } from './ui/carrera.ts';
import { crearMenuPausa } from './ui/pausa.ts';
import { ESCENARIOS, alturaSueloTorre, generarTramo, posicionSaliente, puntoDeSalida, tramoEnAltura } from './reglas/torre.ts';
import { crearCamaraTerceraPersona, giroHaciaPared } from './mundo/camara.ts';
import { crearCueva } from './mundo/cueva.ts';
import { crearEscena, mezclaEscenario } from './mundo/escena.ts';
import { crearEstalactitas, crearGrieta } from './mundo/grieta.ts';
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
 *   ?aspecto=escaladora     sube la escaladora (sin él, el último elegido en el menú)
 */
const parametros = new URLSearchParams(location.search);
const alturaInicial = Number(parametros.get('altura')) || 0;
const semillaPropia = Number(parametros.get('semilla')) || Math.floor(Math.random() * 1e9);
const configRed = configuracionRed();
const menu = document.querySelector<HTMLElement>('#menu')!;
// Pantalla completa (botón y tecla F): disponible ya en el menú.
crearPantallaCompleta(document.querySelector<HTMLButtonElement>('#pantalla-completa')!);
// Sonido (botón y tecla M): también en el menú, para que el primer clic ya lo active.
const audio = crearAudio();
crearBotonSonido(document.querySelector<HTMLButtonElement>('#sonido')!, audio);

// 1 · ¿Solo o en una sala?
let eleccion: Eleccion;
const codigoUrl = normalizarCodigo(parametros.get('sala') ?? '');
if (codigoUrl) eleccion = { modo: 'unirse', codigo: codigoUrl, nombre: limpiarNombre(parametros.get('nombre') ?? '') };
else if (['semilla', 'altura', 'solo'].some((p) => parametros.has(p))) eleccion = { modo: 'solo' };
else eleccion = await mostrarMenu(menu, configRed !== null);

/** Escalador o escaladora: el de la dirección (?aspecto=) o el último elegido en el menú. */
function elegirAspecto() {
  return parametros.has('aspecto') ? leerAspecto(parametros.get('aspecto')) : aspectoGuardado();
}

let sala: Sala | null = null;
while (eleccion.modo !== 'solo') {
  const codigo = eleccion.modo === 'crear' ? generarCodigo() : eleccion.codigo;
  try {
    menu.hidden = false;
    menu.innerHTML = `<div class="menu-caja"><p>Conectando con la sala ${codigo}…</p></div>`;
    if (!configRed) throw new ErrorSala('Falta configurar Supabase (.env)');
    sala = await unirseASala(configRed, codigo, eleccion.nombre, semillaPropia, elegirAspecto());
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
const fin = crearPantallaFin(document.querySelector<HTMLElement>('#fin')!, () => {
  pausa.bloquear(false);
  reiniciar();
});
entrada.alPulsar('F3', panel.alternar);
window.addEventListener('resize', mundo.redimensionar);

// El mundo: la cueva (0-220 m) y la grieta (220-440 m), con sus objetos.
// La carrera acaba en el rellano de la cueva (`tramo`); jugando solo se sigue.
const tramos = ESCENARIOS.map((_, i) => generarTramo(semilla, i));
const tramo = tramos[0]!;
const suelo = (x: number, z: number, techo: number) => alturaSueloTorre(tramos, x, z, techo);
const peligros = {
  fragmentos: tramos.flatMap((t) => generarFragmentos(semilla, t)),
  murcielagos: tramos.flatMap((t) => generarMurcielagos(semilla, t, murcielagosDelTramo(t.indice))),
};
// Lo que se pisa siempre es más claro que la pared, para verlo de un vistazo.
const roca = crearTexturaRoca({ oscuro: '#2b2620', claro: '#8c7f6c' });
const piedra = crearTexturaRoca({ oscuro: '#6b6356', claro: '#d9cdb4', semilla: 7, relieve: 4 });
const rocaGrieta = crearTexturaRoca({ oscuro: '#8c7b66', claro: '#cdbda5', semilla: 11 });
const piedraGrieta = crearTexturaRoca({ oscuro: '#7d7a72', claro: '#efebe2', semilla: 13, relieve: 4 });
const fragmentos = crearFragmentos(peligros.fragmentos);
const murcielagos = crearMurcielagos(peligros.murcielagos);
mundo.escena.add(
  crearCueva(roca, tramo),
  crearTorre(tramo, piedra),
  crearEstalactitas(tramo, 0x5a5146, 2201), // el techo de la cueva
  crearGrieta(rocaGrieta, tramos[1]!),
  crearTorre(tramos[1]!, piedraGrieta),
  fragmentos.grupo,
  murcielagos.grupo,
);

// Dónde empieza: en el suelo antes del primer saliente, o en el saliente pedido con ?altura.
const todos = tramos.flatMap((t) => t.salientes);
const inicio = todos.find((s) => s.y >= alturaInicial) ?? todos[0]!;
const enSuelo = puntoDeSalida(tramo, puesto);
const salida = alturaInicial > 0 ? { ...posicionSaliente(inicio), y: inicio.y } : { x: enSuelo.x, z: enSuelo.z, y: 0 };

// El modelo del escalador se descarga (~270 kB): el juego arranca cuando llega.
// Se cargan los dos: el tuyo y el de los rivales, que pueden ser de otro aspecto.
const modelos = await cargarModelos();
const aspecto = elegirAspecto();
const personaje = crearPersonaje(modelos[aspecto]);
const sombra = crearSombra();
mundo.escena.add(personaje.raiz, sombra.mancha);
// La cámara empieza entre el escalador y el centro del pozo, mirando a la pared.
const camara = crearCamaraTerceraPersona(mundo.camara, giroHaciaPared(salida.x, salida.z));

// 2 · Los rivales de la sala: aparecen y desaparecen según la presencia de Supabase.
const rivales = crearRivales(mundo.escena, modelos);
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

/*
 * El jugador es un «corredor» (reglas/carrera.ts): su escalador, su partida
 * y, en la carrera, su reaparición y su llegada. Al reaparecer se le cambia
 * el escalador, así que siempre se lee como `jugador.escalador`.
 */
let jugador: Corredor;
/** Lo que recuerda el sonido de un paso al siguiente (los pasos al correr). */
let oido = crearOido();
/** El tramo más alto al que ha llegado (para avisar al entrar en uno nuevo). */
let tramoAlcanzado = 0;
const anterior = { x: 0, y: 0, z: 0 };

/** Al principio, al «volver a jugar» (solo) y en cada salida de carrera (con su puesto). */
function reiniciar(puestoCarrera?: number) {
  jugador = crearCorredor(tramo, puestoCarrera ?? puesto);
  const e = jugador.escalador;
  if (puestoCarrera === undefined) Object.assign(e, salida);
  const angulo = Math.atan2(e.z, e.x);
  e.orientacion = Math.atan2(Math.cos(angulo), Math.sin(angulo)); // mirando a la pared
  Object.assign(anterior, { x: e.x, y: e.y, z: e.z });
  jugador.partida.alturaMaxima = e.y;
  tramoAlcanzado = tramoEnAltura(e.y);
  oido = crearOido();
  fragmentos.mostrarTodos();
}
reiniciar();

// 3 · La carrera (solo en una sala): sala de espera, cuenta atrás, meta y resultados.
const carrera = sala
  ? crearCarreraEnSala({
      sala,
      semilla,
      tramo,
      peligros,
      rivales,
      pantalla: crearPantallaCarrera(document.querySelector<HTMLElement>('#carrera')!, {
        alEmpezar: (conOrdenador) => carrera?.alEmpezar(conOrdenador),
      }),
      alReiniciar: (p) => reiniciar(p),
      sonar: audio.sonar,
    })
  : null;

// 4 · Menú de pausa (P). Solo: para el juego. Carrera: el juego sigue (los
//     demás siguen subiendo), pero tu escalador se queda quieto.
const pausa = crearMenuPausa(document.querySelector<HTMLElement>('#pausa')!, {
  enCarrera: sala !== null,
  // En solo la pausa baja el volumen; en carrera el juego sigue y suena igual.
  alAbrir: () => sala === null && audio.pausar(true),
  alCerrar: () => audio.pausar(false),
  async alSalir() {
    try {
      await sala?.salir();
    } finally {
      location.href = location.pathname; // sin parámetros: vuelve el menú de inicio
    }
  },
});

/** Fin de la partida (solo) con récord nuevo: suena «record» en vez de «derrota». */
let recordEnEstePaso = false;

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
      // En la carrera no se acaba: se reaparece (lo lleva pasoCorredor).
      if (carrera) break;
      jugador.reaparecerEn = 0;
      pausa.bloquear(true);
      const p = jugador.partida;
      const recordNuevo = guardarRecord(p.alturaMaxima);
      recordEnEstePaso = recordNuevo;
      fin.mostrar({ altura: p.alturaMaxima, fragmentos: p.recogidos.length, segundos: p.tiempo, record: leerRecord(), recordNuevo });
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
    const m = entrada.leer(); // se lee siempre: lo pulsado en la pausa no se guarda para luego
    if (!sala && pausa.abierto()) {
      // En pausa no avanza nada; «anterior» = ahora para que no tiemble al pintar.
      Object.assign(anterior, { x: jugador.escalador.x, y: jugador.escalador.y, z: jugador.escalador.z });
      return;
    }
    camara.girar(
      -m.ratonX * CC.sensibilidadRaton - m.girarX * CC.velocidadGiro * paso,
      m.ratonY * CC.sensibilidadRaton + m.girarY * CC.velocidadGiro * paso,
    );
    const e0 = jugador.escalador;
    camara.recolocar(e0.x, e0.z, paso);
    anterior.x = e0.x;
    anterior.y = e0.y;
    anterior.z = e0.z;

    carrera?.antesDelPaso(paso);
    // Quieto en la espera y la cuenta atrás de la carrera, y con la partida
    // acabada en solo (pero sigue cayendo si estaba en el aire).
    const quieto = carrera ? !carrera.sePuedeMover() || pausa.abierto() : jugador.partida.terminada;
    const ordenes = quieto
      ? { ...QUIETO, giroCamara: camara.giro }
      : { moverX: m.moverX, moverY: m.moverY, saltar: m.saltar, giroCamara: camara.giro };
    const tiempo = carrera ? carrera.estado.tiempo : jugador.partida.tiempo;
    const r = pasoCorredor(jugador, ordenes, tramo, suelo, peligros, tiempo, paso);
    if (r.sucesos.aterrizaje > 0.5) personaje.aterrizar(r.sucesos.aterrizaje / 6);
    if (r.reaparecio) Object.assign(anterior, { x: jugador.escalador.x, y: jugador.escalador.y, z: jugador.escalador.z });
    recordEnEstePaso = false;
    for (const j of r.jugadas) atender(j);
    const toques = sonidosDelPaso(oido, r, jugador.escalador, paso);
    audio.sonarTodos(recordEnEstePaso ? toques.map((t) => (t.sonido === 'derrota' ? { ...t, sonido: 'record' as const } : t)) : toques);
    carrera?.despuesDelPaso(paso, jugador, r);

    // Jugando solo, al subir al rellano de los 220 m empieza la grieta.
    const enTramo = tramoEnAltura(jugador.partida.alturaMaxima);
    if (!carrera && enTramo > tramoAlcanzado) {
      tramoAlcanzado = enTramo;
      hud.avisar(`Tramo ${enTramo + 1} · ${ESCENARIOS[enTramo]}`, 'bueno');
      audio.sonar('tramo');
    }

    // 10 veces por segundo, contar a la sala dónde estoy.
    const e = jugador.escalador;
    if (sala && ++pasosDesdeEnvio >= PASOS_POR_ENVIO) {
      pasosDesdeEnvio = 0;
      sala.enviarEstado({
        t: performance.now(),
        x: e.x,
        y: e.y,
        z: e.z,
        orientacion: e.orientacion,
        postura: e.postura,
        rapidez: Math.hypot(e.vx, e.vz),
        voltereta: progresoPostura(e),
      });
    }
  },
  pintar(alfa, dtReal) {
    const e = jugador.escalador;
    const partida = jugador.partida;
    // Posición mezclada entre el paso anterior y el actual (movimiento suave).
    pintado.x = anterior.x + (e.x - anterior.x) * alfa;
    pintado.y = anterior.y + (e.y - anterior.y) * alfa;
    pintado.z = anterior.z + (e.z - anterior.z) * alfa;

    personaje.colocar(pintado.x, pintado.y, pintado.z, e.orientacion);
    personaje.animar(e.postura, Math.hypot(e.vx, e.vz), progresoPostura(e), dtReal);
    // Parpadea mientras es invulnerable; esperando a reaparecer, no se ve.
    personaje.raiz.visible =
      jugador.reaparecerEn === 0 && (partida.invulnerable === 0 || Math.floor(partida.invulnerable * 12) % 2 === 0);
    sombra.colocar(pintado.x, suelo(pintado.x, pintado.z, pintado.y + 0.05), pintado.z, pintado.y);
    camara.seguir(pintado.x, pintado.y, pintado.z, dtReal);

    const t = partida.tiempo + alfa * (1 / 60);
    fragmentos.animar(t);
    murcielagos.actualizar(t);
    rivales.pintar(performance.now(), dtReal);
    const mezcla = mezclaEscenario(pintado.y);
    mundo.ambientar(mezcla);
    audio.actualizar(dtReal, mezcla);
    if (sala && lista && carrera) {
      carrera.pintar(alfa, dtReal, jugador, e.y);
      const alturas = new Map([...rivales.alturas(), ...carrera.alturasDelOrdenador(), [sala.yo.id, e.y]]);
      lista.actualizar([...sala.miembros(), ...carrera.delOrdenadorEnLista()], sala.yo.id, sala.anfitrion()?.id, alturas);
    }

    mundo.pintar(pintado);
    fps.contar(dtReal);
    panel.actualizar(dtReal, { semilla, altura: e.y, postura: e.postura });
    // Los fragmentos son por tramo (3 en cada uno): se cuentan los del tramo en el que estás.
    const enTramo = tramoEnAltura(e.y);
    hud.actualizar({
      vida: partida.vida,
      altura: e.y,
      record: Math.max(leerRecord(), partida.alturaMaxima),
      fragmentos: partida.recogidos.filter((id) => Math.floor(id / 10) === enTramo).length,
      tramo: carrera ? 'Carrera · meta a 220 m' : `Tramo ${enTramo + 1} · ${ESCENARIOS[enTramo]}`,
    });

    // Aviso para herramientas/captura.mjs: la escena ya se ha pintado varias veces.
    if (++fotogramasPintados === 10) document.body.dataset.listo = 'si';
  },
});

bucle.arrancar();
audio.empezarAmbiente();

// Para probar desde la consola del navegador (y desde la captura con --js):
//   juego.danar(50)   quita vida      juego.partida   el estado de las reglas
Object.assign(window, {
  juego: {
    get partida() {
      return jugador.partida;
    },
    get escalador() {
      return jugador.escalador;
    },
    danar(n: number) {
      jugador.partida.vida = Math.max(jugador.partida.vida - n, 1);
    },
    /** Pone al escalador en (x, y, z) cayendo: para probar la meta sin subir 220 m. */
    teletransportar(x: number, y: number, z: number) {
      Object.assign(jugador.escalador, { x, y, z, vx: 0, vy: 0, vz: 0, enSuelo: false });
      Object.assign(anterior, { x, y, z });
    },
    /** Gira la cámara (rad): para las capturas, p. ej. mirar hacia arriba con `juego.girarCamara(0, -0.5)`. */
    girarCamara(giro: number, inclinacion: number) {
      camara.girar(giro, inclinacion);
    },
    /** Sonido: si el navegador ya lo deja sonar («running») y si está silenciado. */
    get sonido() {
      return { estado: audio.estado(), silenciado: audio.silenciado() };
    },
    /** El anfitrión empieza la carrera (lo mismo que el botón). */
    empezarCarrera(conOrdenador = true) {
      carrera?.alEmpezar(conOrdenador);
    },
    /** Estado de la carrera: fase, ronda, tiempo, participantes y llegadas. */
    get carrera() {
      return carrera?.resumen() ?? null;
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

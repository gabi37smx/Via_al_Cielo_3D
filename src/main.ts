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
import { REGLAS, generarFragmentos, generarFragmentosLadera, generarMurcielagos, murcielagosDelTramo, type Jugada } from './reglas/partida.ts';
import { BASE_LADERA, CIMA, RADIO_COLINA, TUNEL, aLocal, aMundo, acortarFuera, alturaEnSaliente, alturaSueloLadera, centroSaliente, conCrampones, dCara, ejes, generarLadera, limiteMundo, salidaLadera } from './reglas/ladera.ts';
import { crearCorredor, pasoCorredor, type Corredor } from './reglas/carrera.ts';
import { crearCarreraEnSala } from './modos/carrera.ts';
import { crearPantallaCarrera } from './ui/carrera.ts';
import { crearMenuPausa } from './ui/pausa.ts';
import { ESCENARIOS, alturaSueloTorre, generarTramo, posicionSaliente, puntoDeSalida, tramoEnAltura } from './reglas/torre.ts';
import { crearCamaraTerceraPersona, giroHaciaPared } from './mundo/camara.ts';
import { crearCueva } from './mundo/cueva.ts';
import { crearEscena, mezclaEscenario, mezclaExterior } from './mundo/escena.ts';
import { crearMontana } from './mundo/montana.ts';
import { crearEstalactitas, crearGrieta } from './mundo/grieta.ts';
import { crearAdornos } from './mundo/adornos.ts';
import { crearFragmentos, crearMurcielagos } from './mundo/objetos.ts';
import { crearAguilas, crearNieve } from './mundo/aire.ts';
import { aguilaCerca, generarAguilas, rafagaEn } from './reglas/aire.ts';
import { crearSombra } from './mundo/sombra.ts';
import { crearTexturaRoca } from './mundo/texturas.ts';
import { crearTorre } from './mundo/torre.ts';
import { crearPantallaFin, guardarRecord, leerRecord } from './ui/fin.ts';
import { crearAerodromo, crearAvioneta } from './mundo/avioneta.ts';
import { crearValencia } from './mundo/valencia.ts';
import { crearPantallaVuelo } from './ui/vuelo.ts';
import { crearViaje } from './modos/viaje.ts';
import { tocaAvioneta } from './reglas/vuelo.ts';
import { aLocalValencia, aMundoValencia, alturaSueloValencia, enValencia, limiteValencia, llegadaValencia } from './reglas/valencia.ts';
import { CIMA_PALAU, enCostadoPalau, generarFragmentosPalau, generarPalau, zInterior } from './reglas/palau.ts';
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
 *   ?altura=660             empieza en la cima, junto a la avioneta
 *   ?valencia=1             empieza ya en Valencia, al bajar de la avioneta
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
else if (['semilla', 'altura', 'solo', 'valencia'].some((p) => parametros.has(p))) eleccion = { modo: 'solo' };
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

// El mundo: la cueva (0-220 m), la grieta (220-440 m) y, saliendo por el
// pasillo, la ladera de la montaña (440-660 m). De la cima se va en avioneta
// a Valencia (tramo 4), que está lejos. La carrera acaba en el rellano de la
// cueva (`tramo`); jugando solo se sigue.
const tramos = [0, 1].map((i) => generarTramo(semilla, i));
const tramo = tramos[0]!;
const ladera = generarLadera(semilla);
/** El tramo 4: la subida del Palau de les Arts, en Valencia. */
const palau = generarPalau(semilla);
const suelo = (x: number, z: number, techo: number) =>
  enValencia(x, z) ? alturaSueloValencia(x, z, techo, palau) : Math.max(alturaSueloTorre(tramos, x, z, techo), alturaSueloLadera(ladera, x, z, techo));
/** Por dónde no se puede pasar: la pared del pozo, el pasillo, la colina y la montaña; en Valencia, lo suyo. */
const limiteMontana = limiteMundo(ladera);
const limite: typeof limiteMontana = (p, y) => (enValencia(p.x, p.z) ? limiteValencia(p, y) : limiteMontana(p, y));
const peligros = {
  fragmentos: [
    ...tramos.flatMap((t) => generarFragmentos(semilla, t)),
    ...generarFragmentosLadera(semilla, ladera),
    ...generarFragmentosPalau(semilla, palau, REGLAS.fragmentosPorTramo).map((f) => ({ ...f, ...aMundoValencia(f.x, f.z) })),
  ],
  murcielagos: tramos.flatMap((t) => generarMurcielagos(semilla, t, murcielagosDelTramo(t.indice))),
  // Fuera, en la montaña, águilas (y viento: lo pone pasoCorredor con la ladera).
  aguilas: generarAguilas(semilla, ladera),
};
const ejesLadera = ejes(ladera);
/** Fuera, la cámara va detrás del escalador, mirando a la montaña (hacia +N). */
const giroFuera = Math.atan2(-ejesLadera.nx, -ejesLadera.nz);
/** En Valencia la cámara va detrás del escalador, mirando al Palau (hacia +X). */
const GIRO_VALENCIA = -Math.PI / 2;
/** Junto al costado del Palau (y subiéndolo), detrás del escalador mirando a la cáscara (hacia +z). */
const GIRO_PALAU = Math.PI;
function giroEnValencia(x: number, z: number): number {
  const l = aLocalValencia(x, z);
  return enCostadoPalau(l.x, l.z) ? GIRO_PALAU : GIRO_VALENCIA;
}
/** ¿Está en el pasillo o fuera? (ahí la cámara mira a la montaña, no a la pared del pozo) */
function fuera(x: number, z: number, y: number): boolean {
  if (enValencia(x, z)) return false;
  if (y < BASE_LADERA - 1) return false;
  const { d, u } = aLocal(ladera, x, z);
  return Math.hypot(x, z) > RADIO_COLINA - 1 || (d > 11 && Math.abs(u) < TUNEL.ancho);
}
mundo.orientarSol(ejesLadera.nx, ejesLadera.nz);
// Lo que se pisa siempre es más claro que la pared, para verlo de un vistazo.
const roca = crearTexturaRoca({ oscuro: '#2b2620', claro: '#8c7f6c' });
const piedra = crearTexturaRoca({ oscuro: '#6b6356', claro: '#d9cdb4', semilla: 7, relieve: 4 });
const rocaGrieta = crearTexturaRoca({ oscuro: '#8c7b66', claro: '#cdbda5', semilla: 11 });
const piedraGrieta = crearTexturaRoca({ oscuro: '#7d7a72', claro: '#efebe2', semilla: 13, relieve: 4 });
const montana = {
  roca: crearTexturaRoca({ oscuro: '#7b848f', claro: '#cfd6de', semilla: 17 }),
  nieve: crearTexturaRoca({ oscuro: '#d5dee8', claro: '#ffffff', semilla: 19, relieve: 1 }),
  piedra: crearTexturaRoca({ oscuro: '#b9c2cc', claro: '#f7f9fb', semilla: 23, relieve: 3 }),
};
const fragmentos = crearFragmentos(peligros.fragmentos);
const murcielagos = crearMurcielagos(peligros.murcielagos);
const aguilas = crearAguilas(peligros.aguilas);
const nieve = crearNieve();
// Lo de la montaña (de la cueva a la cima): en Valencia se esconde.
const deLaMontana = [
  crearCueva(roca, tramo),
  crearTorre(tramo, piedra),
  crearEstalactitas(tramo, 0x5a5146, 2201), // el techo de la cueva
  crearGrieta(rocaGrieta, tramos[1]!, { angulo: ladera.angulo, ancho: TUNEL.ancho + 0.2, desde: BASE_LADERA - 0.5, hasta: BASE_LADERA + TUNEL.alto }),
  crearTorre(tramos[1]!, piedraGrieta),
  // Fósiles, esqueletos, cráneos, cofres… (solo se ven: no se pisan).
  crearAdornos(tramo, { semilla: 5101, dinosaurios: 3, personas: 5, amonites: 0, craneos: 14, delSuelo: true, hueso: 0xd8cdb0 }),
  crearAdornos(tramos[1]!, { semilla: 5102, dinosaurios: 1, personas: 2, amonites: 10, craneos: 8, delSuelo: false, hueso: 0xeae2cf }),
  crearMontana(ladera, montana),
  crearAerodromo(ladera),
  murcielagos.grupo,
  aguilas.grupo,
  nieve.grupo,
];
const valencia = crearValencia(palau);
const avioneta = crearAvioneta();
// Los fragmentos, siempre (hay en la montaña y en el Palau).
mundo.escena.add(...deLaMontana, valencia.grupo, avioneta.grupo, fragmentos.grupo);
/**
 * Enseña la montaña o Valencia (las dos a la vez, nunca: están lejos y
 * gastaría). `palau`: en Valencia, junto al costado de la subida.
 */
let lugarVisible: 'montana' | 'valencia' | 'palau' | null = null;
function verLugar(lugar: 'montana' | 'valencia' | 'palau') {
  if (lugar === lugarVisible) return;
  lugarVisible = lugar;
  for (const o of deLaMontana) o.visible = lugar === 'montana';
  valencia.grupo.visible = lugar !== 'montana';
  // Fuera, el sol viene desde detrás de quien mira: a la montaña, al Palau
  // (+x) o, subiéndolo, a su cáscara (+z); si no, la cáscara queda de canto y gris.
  if (lugar === 'valencia') mundo.orientarSol(1, 0);
  else if (lugar === 'palau') mundo.orientarSol(0, 1);
  else mundo.orientarSol(ejesLadera.nx, ejesLadera.nz);
}

// Dónde empieza: en el suelo antes del primer saliente, o en el saliente pedido con
// ?altura (desde 440 m, en la explanada delante del pasillo o en un saliente de la ladera).
function sitioDeInicio(): { x: number; y: number; z: number } {
  // En la cima (`?altura=660`): junto al borde, delante de la bandera; la avioneta, a unos pasos.
  if (alturaInicial >= CIMA) return { ...aMundo(ladera, dCara(CIMA) + 1.5, 4), y: CIMA };
  if (alturaInicial >= BASE_LADERA) {
    const s = ladera.salientes.find((x) => x.y >= alturaInicial);
    if (!s || alturaInicial === BASE_LADERA) return { ...salidaLadera(ladera), y: BASE_LADERA };
    const c = centroSaliente(s);
    return { ...aMundo(ladera, c.d, c.u), y: alturaEnSaliente(s, c.d) };
  }
  const todos = tramos.flatMap((t) => t.salientes);
  const inicio = todos.find((s) => s.y >= alturaInicial) ?? todos[0]!;
  const enSuelo = puntoDeSalida(tramo, puesto);
  return alturaInicial > 0 ? { ...posicionSaliente(inicio), y: inicio.y } : { x: enSuelo.x, z: enSuelo.z, y: 0 };
}
const salida = sitioDeInicio();

// El modelo del escalador se descarga (~270 kB): el juego arranca cuando llega.
// Se cargan los dos: el tuyo y el de los rivales, que pueden ser de otro aspecto.
const modelos = await cargarModelos();
const aspecto = elegirAspecto();
const personaje = crearPersonaje(modelos[aspecto]);
const sombra = crearSombra();
mundo.escena.add(personaje.raiz, sombra.mancha);
// La cámara empieza entre el escalador y el centro del pozo, mirando a la pared (fuera: a la montaña).
const empiezaFuera = fuera(salida.x, salida.z, salida.y);
const camara = crearCamaraTerceraPersona(
  mundo.camara,
  empiezaFuera ? giroFuera : giroHaciaPared(salida.x, salida.z),
  empiezaFuera ? CONFIG.camara.inclinacionFuera : CONFIG.camara.inclinacion,
);

// El viaje en avioneta (solo jugando solo: la carrera acaba a 220 m).
const viaje = crearViaje({
  ladera,
  avioneta,
  pantalla: crearPantallaVuelo(document.querySelector<HTMLElement>('#vuelo')!),
  sonar: audio.sonar,
  motor: audio.motor,
});
entrada.alPulsar('Enter', () => viaje.saltar());

/** Al bajar de la avioneta: junto a la puerta, mirando al Palau, sin crampones. */
function bajarEnValencia() {
  const s = llegadaValencia();
  const e = jugador.escalador;
  Object.assign(e, { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, enSuelo: true, orientacion: s.orientacion, alturaMaxima: s.y });
  Object.assign(e, { agarre: null, trepar: 0, crampones: false, postura: 'quieto' as const });
  Object.assign(anterior, { x: s.x, y: s.y, z: s.z });
  camara.colocar(GIRO_VALENCIA, CONFIG.camara.inclinacionFuera);
  verLugar('valencia');
}

// 2 · Los rivales de la sala: aparecen y desaparecen según la presencia de Supabase.
const rivales = crearRivales(mundo.escena, modelos, (x, y, z, antes) => conCrampones(ladera, x, y, z, antes));
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
/** Ya ha llegado a la cima (para avisar una vez). */
let cimaAlcanzada = false;
/** Ya ha llegado al mirador del Palau (para avisar una vez). */
let cimaPalauAlcanzada = false;
const anterior = { x: 0, y: 0, z: 0 };

/** Al principio, al «volver a jugar» (solo) y en cada salida de carrera (con su puesto). */
function reiniciar(puestoCarrera?: number) {
  jugador = crearCorredor(tramo, puestoCarrera ?? puesto);
  const e = jugador.escalador;
  if (puestoCarrera === undefined) Object.assign(e, salida);
  // Empezando ya fuera (?altura desde 440 m), con los crampones puestos (sin su clic).
  e.crampones = conCrampones(ladera, e.x, e.y, e.z, false);
  const angulo = Math.atan2(e.z, e.x);
  // Mirando a la pared (fuera, a la montaña).
  e.orientacion = fuera(e.x, e.z, e.y) ? Math.atan2(ejesLadera.nx, ejesLadera.nz) : Math.atan2(Math.cos(angulo), Math.sin(angulo));
  Object.assign(anterior, { x: e.x, y: e.y, z: e.z });
  jugador.partida.alturaMaxima = e.y;
  tramoAlcanzado = tramoEnAltura(e.y);
  cimaAlcanzada = e.y >= CIMA - 0.01;
  cimaPalauAlcanzada = false;
  oido = crearOido();
  fragmentos.mostrarTodos();
  // La avioneta vuelve a esperar en la cima (o, con ?valencia=1, se empieza ya allí).
  viaje.reiniciar();
  verLugar('montana');
  if (puestoCarrera === undefined && !sala && parametros.has('valencia')) {
    viaje.yaEnValencia();
    bajarEnValencia();
    tramoAlcanzado = tramoEnAltura(CIMA, true);
    cimaAlcanzada = true;
    // Con ?altura (más de 660 m): ya subiendo el Palau, en el primer saliente desde esa altura.
    const s = palau.salientes.find((x) => x.y >= alturaInicial);
    if (alturaInicial > CIMA && s) {
      const p = aMundoValencia(s.u, zInterior(s) - s.fondo / 2);
      Object.assign(e, { x: p.x, y: s.y, z: p.z, alturaMaxima: s.y });
      Object.assign(anterior, { x: p.x, y: s.y, z: p.z });
      jugador.partida.alturaMaxima = s.y;
      camara.colocar(GIRO_PALAU, CONFIG.camara.inclinacionFuera);
    }
  } else {
    // La cámara, de golpe a su sitio (al volver de Valencia no cruza el mapa volando).
    const afuera = fuera(e.x, e.z, e.y);
    camara.colocar(afuera ? giroFuera : giroHaciaPared(e.x, e.z), afuera ? CONFIG.camara.inclinacionFuera : CONFIG.camara.inclinacion);
  }
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
/** Segundos hasta que pueda volver a oírse un águila que pasa cerca (que no chille sin parar). */
let esperaGraznido = 0;

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
    // En la avioneta: el escalador no se mueve y la partida no avanza (el
    // contador de altura se queda quieto). Espacio o Enter saltan la escena.
    if (viaje.volando()) {
      Object.assign(anterior, { x: jugador.escalador.x, y: jugador.escalador.y, z: jugador.escalador.z });
      if (m.saltar) viaje.saltar();
      if (viaje.paso(paso)) bajarEnValencia();
      return;
    }
    camara.girar(
      -m.ratonX * CC.sensibilidadRaton - m.girarX * CC.velocidadGiro * paso,
      m.ratonY * CC.sensibilidadRaton + m.girarY * CC.velocidadGiro * paso,
    );
    const e0 = jugador.escalador;
    const enCiudad = enValencia(e0.x, e0.z);
    const afuera = fuera(e0.x, e0.z, e0.y);
    const giroIdeal = enCiudad ? giroEnValencia(e0.x, e0.z) : afuera ? giroFuera : undefined;
    camara.recolocar(e0.x, e0.z, paso, giroIdeal, enCiudad || afuera ? CC.inclinacionFuera : undefined);
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
    // En Valencia no hay viento de montaña ni crampones (sin la ladera).
    const r = pasoCorredor(jugador, ordenes, tramo, suelo, peligros, tiempo, paso, limite, enCiudad ? undefined : ladera);
    if (r.sucesos.aterrizaje > 0.5) personaje.aterrizar(r.sucesos.aterrizaje / 6);
    if (r.reaparecio) Object.assign(anterior, { x: jugador.escalador.x, y: jugador.escalador.y, z: jugador.escalador.z });
    recordEnEstePaso = false;
    for (const j of r.jugadas) atender(j);
    const toques = sonidosDelPaso(oido, r, jugador.escalador, paso);
    audio.sonarTodos(recordEnEstePaso ? toques.map((t) => (t.sonido === 'derrota' ? { ...t, sonido: 'record' as const } : t)) : toques);
    carrera?.despuesDelPaso(paso, jugador, r);

    // Un águila que pasa cerca se oye venir (un chillido más flojo que el del golpe).
    esperaGraznido = Math.max(esperaGraznido - paso, 0);
    const yo = jugador.escalador;
    if (esperaGraznido === 0 && yo.y > BASE_LADERA && aguilaCerca(peligros.aguilas, jugador.partida.tiempo, yo.x, yo.y + 1, yo.z, 7)) {
      audio.sonar('graznido', 0.5);
      esperaGraznido = 4;
    }

    // Jugando solo, al subir al rellano de los 220 m empieza la grieta (y al bajar de la avioneta, Valencia).
    const enTramo = tramoEnAltura(jugador.partida.alturaMaxima, enValencia(jugador.escalador.x, jugador.escalador.z));
    if (!carrera && enTramo > tramoAlcanzado) {
      tramoAlcanzado = enTramo;
      hud.avisar(`Tramo ${enTramo + 1} · ${ESCENARIOS[enTramo]}`, 'bueno');
      if (ESCENARIOS[enTramo] === 'Valencia') hud.avisar('Ciutat de les Arts i les Ciències', 'info');
      audio.sonar('tramo');
    }
    // Y en lo alto de la montaña, la cima: la avioneta espera.
    if (!carrera && !cimaAlcanzada && jugador.escalador.enSuelo && jugador.escalador.y >= CIMA - 0.01 && !enCiudad) {
      cimaAlcanzada = true;
      hud.avisar(`¡Cima! ${CIMA} m`, 'bueno');
      hud.avisar('✈ La avioneta te espera: ve hasta ella', 'info');
      audio.sonar('victoria');
    }
    // Y arriba del Palau, el mirador (880 m).
    if (!carrera && !cimaPalauAlcanzada && enCiudad && jugador.escalador.enSuelo && jugador.escalador.y >= CIMA_PALAU - 0.01) {
      cimaPalauAlcanzada = true;
      hud.avisar(`¡Cima del Palau! ${CIMA_PALAU} m`, 'bueno');
      audio.sonar('victoria');
    }
    // Tocar la avioneta de la cima = subirse (solo jugando solo y con vida).
    const yoAhora = jugador.escalador;
    if (!carrera && viaje.estado === 'montana' && !jugador.partida.terminada && tocaAvioneta(ladera, yoAhora.x, yoAhora.y, yoAhora.z)) {
      viaje.empezar();
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

    // Volando, la cámara es la de la escena y el escalador va dentro de la avioneta.
    const pose = viaje.pintar(alfa, dtReal, mundo.camara);
    const enCiudad = pose ? pose.lugar === 'valencia' : enValencia(pintado.x, pintado.z);
    verLugar(!enCiudad ? 'montana' : !pose && giroEnValencia(pintado.x, pintado.z) === GIRO_PALAU ? 'palau' : 'valencia');
    personaje.colocar(pintado.x, pintado.y, pintado.z, e.orientacion);
    personaje.animar(e.postura, Math.hypot(e.vx, e.vz), progresoPostura(e), dtReal);
    personaje.ponerCrampones(e.crampones);
    // Parpadea mientras es invulnerable; esperando a reaparecer, no se ve.
    personaje.raiz.visible =
      !pose && jugador.reaparecerEn === 0 && (partida.invulnerable === 0 || Math.floor(partida.invulnerable * 12) % 2 === 0);
    sombra.mancha.visible = !pose;
    sombra.colocar(pintado.x, suelo(pintado.x, pintado.z, pintado.y + 0.05), pintado.z, pintado.y);
    if (!pose) camara.seguir(pintado.x, pintado.y, pintado.z, dtReal, enCiudad ? undefined : (m, c) => acortarFuera(ladera, m, c));

    const t = partida.tiempo + alfa * (1 / 60);
    fragmentos.animar(t);
    murcielagos.actualizar(t);
    // Las águilas, solo por fuera (en la cueva no se ven y no gastan; en Valencia no hay).
    aguilas.grupo.visible = !enCiudad && pintado.y > BASE_LADERA - 30;
    if (aguilas.grupo.visible) aguilas.actualizar(t);
    rivales.pintar(performance.now(), dtReal);
    const mezcla = mezclaEscenario(pintado.y);
    // Volando por la cima ya se está fuera (el escalador va dentro de la avioneta).
    const exterior = enCiudad || pose ? 1 : mezclaExterior(aLocal(ladera, pintado.x, pintado.z).d, pintado.y, BASE_LADERA);
    mundo.ambientar(mezcla, exterior, enCiudad ? 1 : 0);
    // Los copos y las rayas del viento: con la ráfaga de ahora, alrededor de la cámara (en Valencia, no).
    const rafaga = rafagaEn(ladera, t);
    const soplo = rafaga.intensidad * rafaga.fuerza * rafaga.sentido;
    nieve.actualizar(dtReal, mundo.camara.position, { x: ejesLadera.tx * soplo, z: ejesLadera.tz * soplo }, rafaga.intensidad, enCiudad ? 0 : exterior);
    valencia.actualizar(performance.now() / 1000, mundo.camara.position);
    audio.actualizar(dtReal, mezcla, exterior);
    if (sala && lista && carrera) {
      carrera.pintar(alfa, dtReal, jugador, e.y);
      const alturas = new Map([...rivales.alturas(), ...carrera.alturasDelOrdenador(), [sala.yo.id, e.y]]);
      lista.actualizar([...sala.miembros(), ...carrera.delOrdenadorEnLista()], sala.yo.id, sala.anfitrion()?.id, alturas);
    }

    // Las luces (y la caja de las sombras) siguen al escalador o, volando, a la avioneta.
    mundo.pintar(pose ?? pintado);
    fps.contar(dtReal);
    panel.actualizar(dtReal, { semilla, altura: e.y, postura: e.postura });
    // Los fragmentos son por tramo (3 en cada uno): se cuentan los del tramo en el que estás.
    const enTramo = tramoEnAltura(e.y, enCiudad);
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
    /** Pone al escalador dentro de la grieta, a 440 m, delante de la entrada del pasillo (para probar la salida). */
    irAlPasillo() {
      const p = aMundo(ladera, 9.5, 0);
      Object.assign(jugador.escalador, { x: p.x, y: BASE_LADERA + 0.5, z: p.z, vx: 0, vy: 0, vz: 0, enSuelo: false });
      Object.assign(anterior, { x: p.x, y: BASE_LADERA + 0.5, z: p.z });
    },
    /** Pone al escalador en la cima, junto al borde, delante de la bandera (la avioneta, a unos pasos). */
    irALaCima() {
      const p = aMundo(ladera, dCara(CIMA) + 1.5, 4);
      Object.assign(jugador.escalador, { x: p.x, y: CIMA, z: p.z, vx: 0, vy: 0, vz: 0, enSuelo: true });
      Object.assign(anterior, { x: p.x, y: CIMA, z: p.z });
    },
    /** Pone al escalador en el zócalo del Palau, junto al primer saliente de la subida. */
    irAlPalau() {
      const s = palau.salientes[0]!;
      const p = aMundoValencia(s.u, zInterior(s) - 0.8);
      const y = CIMA + 1.2;
      Object.assign(jugador.escalador, { x: p.x, y, z: p.z, vx: 0, vy: 0, vz: 0, enSuelo: true, crampones: false });
      Object.assign(anterior, { x: p.x, y, z: p.z });
    },
    /** Sube a la avioneta de la cima sin ir hasta ella (para probar la escena; `desde`: en ese segundo). */
    volar(desde = 0) {
      if (viaje.estado === 'montana') viaje.empezar(desde);
    },
    /** El viaje: dónde está la avioneta (`montana`, `volando` o `valencia`). */
    get viaje() {
      return viaje.estado;
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

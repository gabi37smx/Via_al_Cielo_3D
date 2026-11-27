/*
 * El modo CARRERA en una sala (sesión 6): une las reglas de la carrera, la
 * red, los rivales del ordenador y lo que se ve. main.ts le pasa el jugador
 * en cada paso y él se encarga del resto.
 *
 * Cómo va una carrera (docs/diseno.md, decisión 033):
 * 1. Sala de espera: todos quietos en su puesto. El anfitrión pulsa
 *    «Empezar carrera» y envía `salida` (ronda y rivales del ordenador).
 * 2. Cada navegador, al recibirlo, pone a todos en su puesto y cuenta 3-2-1.
 * 3. En curso: cada uno simula su escalador (y los del ordenador, iguales en
 *    todos los navegadores). Al llegar a la meta se envía `meta` con el tiempo.
 * 4. Todos apuntan las mismas llegadas; el anfitrión decide cuándo se acaba
 *    (`fin`) y entonces sale la clasificación. Puede empezar otra.
 */
import { crearRivalesOrdenador, pasoRivalesOrdenador, type RivalOrdenador } from '../bots/rivalesOrdenador.ts';
import { progresoPostura } from '../jugador/control.ts';
import type { RivalesEnEscena } from '../mundo/rivales.ts';
import type { Miembro, MensajeCarrera } from '../red/protocolo.ts';
import { MAX_JUGADORES, cabeEnSala } from '../red/protocolo.ts';
import type { Sala } from '../red/sala.ts';
import {
  carreraAcabada,
  clasificar,
  crearCarrera,
  empezarCuentaAtras,
  pasoCarrera,
  sePuedeMover,
  type Corredor,
  type Llegada,
  type Participante,
  type PasoCorredor,
} from '../reglas/carrera.ts';
import type { Peligros } from '../reglas/partida.ts';
import type { Tramo } from '../reglas/torre.ts';
import type { Sonido } from '../sonido/sucesos.ts';
import type { crearPantallaCarrera } from '../ui/carrera.ts';

export interface OpcionesCarrera {
  sala: Sala;
  semilla: number;
  tramo: Tramo;
  peligros: Peligros;
  rivales: RivalesEnEscena;
  pantalla: ReturnType<typeof crearPantallaCarrera>;
  /** Pone al jugador en la salida de su puesto (nueva carrera). */
  alReiniciar(puesto: number): void;
  /** Cuenta atrás, salida, tu llegada y el final (ganas o no). */
  sonar?(sonido: Sonido): void;
}

/** Los que juegan: los 4 más antiguos de la sala, en el orden de la sala. */
function jugadoresDeLaSala(sala: Sala): Miembro[] {
  const miembros = sala.miembros();
  return miembros.filter((m) => cabeEnSala(miembros, m.id));
}

export function crearCarreraEnSala(op: OpcionesCarrera) {
  const { sala, semilla, tramo, peligros, rivales, pantalla } = op;
  const estado = crearCarrera();
  let participantes: Participante[] = [];
  let delOrdenador: RivalOrdenador[] = [];
  /** Posiciones de los del ordenador en el paso anterior (para pintarlos suaves). */
  let anteriores: { x: number; y: number; z: number }[] = [];
  let llegadas: Llegada[] = [];
  let contadorLlegadas = 0;
  const yo = () => sala.yo.id;
  const soyAnfitrion = () => sala.anfitrion()?.id === yo();
  const sonar = (s: Sonido) => op.sonar?.(s);

  function apuntarLlegada(id: string, tiempo: number) {
    if (llegadas.some((l) => l.id === id) || !participantes.some((p) => p.id === id)) return;
    llegadas.push({ id, tiempo, orden: contadorLlegadas++ });
  }

  function terminar() {
    if (estado.fase === 'terminada') return;
    estado.fase = 'terminada';
    // Gana el mejor tiempo; si empatan, quien se supo antes (como clasificar).
    const primera = [...llegadas].sort((a, b) => a.tiempo - b.tiempo || a.orden - b.orden)[0];
    sonar(primera?.id === yo() ? 'victoria' : 'finCarrera');
  }

  /** Empieza la carrera número `ronda`, con `bots` rivales del ordenador. */
  function salida(ronda: number, bots: number) {
    const personas = jugadoresDeLaSala(sala);
    participantes = personas.map((m) => ({ id: m.id, nombre: m.nombre, persona: true }));
    delOrdenador = crearRivalesOrdenador(semilla, ronda, op.tramo, Math.min(bots, MAX_JUGADORES - personas.length), personas.length);
    participantes.push(...delOrdenador);
    anteriores = delOrdenador.map((r) => ({ x: r.corredor.escalador.x, y: r.corredor.escalador.y, z: r.corredor.escalador.z }));
    rivales.ponerDelOrdenador(delOrdenador, personas.length);
    llegadas = [];
    contadorLlegadas = 0;
    op.alReiniciar(Math.max(personas.findIndex((m) => m.id === yo()), 0));
    pantalla.cerrarCaja();
    for (const s of empezarCuentaAtras(estado, ronda)) {
      if (s.tipo !== 'numero') continue;
      pantalla.numero(String(s.numero));
      sonar('cuenta');
    }
  }

  /** Alturas de los del ordenador (para la lista de la sala). */
  function alturasDelOrdenador(): Map<string, number> {
    return new Map(delOrdenador.map((b) => [b.id, b.corredor.escalador.y]));
  }

  function alEmpezar(conOrdenador: boolean) {
    // Solo el anfitrión, y solo en la espera o con la carrera acabada (no a mitad).
    if (!soyAnfitrion() || (estado.fase !== 'esperando' && estado.fase !== 'terminada')) return;
    const personas = jugadoresDeLaSala(sala).length;
    const m: MensajeCarrera = { tipo: 'salida', ronda: estado.ronda + 1, bots: conOrdenador ? MAX_JUGADORES - personas : 0 };
    sala.enviarCarrera(m);
    salida(m.ronda, m.bots);
  }

  sala.alRecibirCarrera((id, m) => {
    if (m.tipo === 'salida') {
      // Solo vale la salida del anfitrión, y no se repite una ronda ya empezada.
      if (id === sala.anfitrion()?.id && m.ronda > estado.ronda) salida(m.ronda, m.bots);
      return;
    }
    if (m.ronda !== estado.ronda) return; // de otra carrera
    if (m.tipo === 'meta') apuntarLlegada(id, m.tiempo);
    else if (m.tipo === 'fin') terminar();
  });

  return {
    estado,
    alEmpezar,
    /** ¿Obedece el jugador? En la espera y la cuenta atrás, no. */
    sePuedeMover: () => sePuedeMover(estado),
    /** Antes del paso del jugador: cuenta atrás y reloj. */
    antesDelPaso(paso: number) {
      for (const s of pasoCarrera(estado, paso)) {
        pantalla.numero(s.tipo === 'salida' ? '¡YA!' : String(s.numero));
        sonar(s.tipo === 'salida' ? 'salida' : 'cuenta');
      }
    },
    /** Después del paso del jugador: su llegada, los del ordenador y el final. */
    despuesDelPaso(paso: number, jugador: Corredor, r: PasoCorredor) {
      if (estado.fase !== 'enCurso' && estado.fase !== 'terminada') return;
      if (r.llego && estado.fase === 'enCurso') {
        apuntarLlegada(yo(), jugador.llegada!);
        sonar('meta');
        sala.enviarCarrera({ tipo: 'meta', ronda: estado.ronda, tiempo: jugador.llegada! });
      }
      anteriores = delOrdenador.map((b) => ({ x: b.corredor.escalador.x, y: b.corredor.escalador.y, z: b.corredor.escalador.z }));
      pasoRivalesOrdenador(delOrdenador, tramo, peligros, estado.tiempo, paso).forEach((p, i) => {
        if (p.llego && estado.fase === 'enCurso') apuntarLlegada(delOrdenador[i]!.id, delOrdenador[i]!.corredor.llegada!);
      });
      // El anfitrión decide cuándo se acaba y avisa a todos.
      if (estado.fase === 'enCurso' && soyAnfitrion()) {
        const presentes = new Set(sala.miembros().map((m) => m.id));
        if (carreraAcabada(participantes, presentes, llegadas, estado.tiempo)) {
          sala.enviarCarrera({ tipo: 'fin', ronda: estado.ronda });
          terminar();
        }
      }
    },
    alturasDelOrdenador,
    /** Los del ordenador como filas de la lista de la sala (detrás de las personas). */
    delOrdenadorEnLista(): Miembro[] {
      return delOrdenador.map((b) => ({ id: b.id, nombre: `${b.nombre} (CPU)`, unidoEn: Infinity, semilla, aspecto: b.aspecto }));
    },
    /** Al pintar: los del ordenador y la pantalla de la carrera. */
    pintar(alfa: number, dt: number, jugador: Corredor, alturaJugador: number) {
      rivales.pintarDelOrdenador(
        delOrdenador.map((b, i) => {
          const e = b.corredor.escalador;
          const a = anteriores[i] ?? e;
          const inv = b.corredor.partida.invulnerable;
          return {
            id: b.id,
            x: a.x + (e.x - a.x) * alfa,
            y: a.y + (e.y - a.y) * alfa,
            z: a.z + (e.z - a.z) * alfa,
            orientacion: e.orientacion,
            postura: e.postura,
            rapidez: Math.hypot(e.vx, e.vz),
            progreso: progresoPostura(e),
            visible: b.corredor.reaparecerEn === 0 && (inv === 0 || Math.floor(inv * 12) % 2 === 0),
          };
        }),
        dt,
      );

      // Reloj: corre hasta que llegas; luego se queda en tu tiempo.
      const enMarcha = estado.fase === 'enCurso' || estado.fase === 'terminada';
      pantalla.reloj(enMarcha ? (jugador.llegada ?? (estado.fase === 'enCurso' ? estado.tiempo : null)) : null);
      pantalla.aviso(jugador.reaparecerEn > 0 ? `Reapareces en ${Math.ceil(jugador.reaparecerEn)}` : null);

      if (estado.fase === 'esperando') {
        const anfitrion = sala.anfitrion();
        pantalla.esperando(soyAnfitrion(), anfitrion?.nombre ?? '', jugadoresDeLaSala(sala).length);
      } else if (estado.fase === 'terminada' || jugador.llegada !== null) {
        const alturas = new Map([...rivales.alturas(), ...alturasDelOrdenador(), [yo(), alturaJugador]]);
        pantalla.resultados(clasificar(participantes, llegadas, alturas), estado.fase === 'terminada', soyAnfitrion(), yo());
      }
    },
    /** Para la consola y la prueba de red. */
    resumen() {
      return {
        fase: estado.fase,
        ronda: estado.ronda,
        tiempo: estado.tiempo,
        participantes: participantes.map((p) => p.nombre),
        llegadas: llegadas.map((l) => ({ nombre: participantes.find((p) => p.id === l.id)?.nombre, tiempo: l.tiempo })),
      };
    },
  };
}

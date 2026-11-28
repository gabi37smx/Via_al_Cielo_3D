/*
 * El sonido del juego (sesión 7): el AudioContext, el volumen, silenciar (M)
 * y el fondo de la cueva. Lo que suena lo decide sucesos.ts y cómo suena,
 * sintetizador.ts.
 *
 * Los navegadores no dejan sonar nada hasta que la persona toca la página:
 * el AudioContext se crea en la primera pulsación o clic. Lo que se pida
 * antes, simplemente no suena (así no hay avisos en la consola).
 */
import { CONFIG } from '../config.ts';
import { crearAmbienteCueva, crearMotor, tocar } from './sintetizador.ts';
import type { Sonido, Toque } from './sucesos.ts';

const CLAVE = 'via-al-cielo-3d:sonido';
const S = CONFIG.sonido;

export function crearAudio() {
  let ctx: AudioContext | null = null;
  let maestro: GainNode | null = null;
  let efectos: GainNode | null = null;
  let fondo: GainNode | null = null;
  let silencio = localStorage.getItem(CLAVE) === 'no';
  let enPausa = false;
  let ambienteQuerido = false;
  let ambiente: ReturnType<typeof crearAmbienteCueva> | null = null;
  let ultimoFiltro: number = S.filtroCueva;
  /** El motor de la avioneta: solo existe mientras suena. */
  let motor: ReturnType<typeof crearMotor> | null = null;
  let potenciaMotor = -1;
  const avisos = new Set<(silencio: boolean) => void>();

  const volumenMaestro = () => (silencio ? 0 : S.volumen * (enPausa ? S.enPausa : 1));

  function ajustarVolumen() {
    if (!ctx || !maestro) return;
    // Rampa corta: sin chasquidos al silenciar o al abrir la pausa.
    maestro.gain.setTargetAtTime(volumenMaestro(), ctx.currentTime, 0.05);
  }

  function arrancar() {
    if (ctx) {
      if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
      return;
    }
    ctx = new AudioContext();
    // Compresor al final: aunque coincidan varios sonidos, no se satura.
    const compresor = ctx.createDynamicsCompressor();
    compresor.connect(ctx.destination);
    maestro = ctx.createGain();
    maestro.gain.value = volumenMaestro();
    maestro.connect(compresor);
    efectos = ctx.createGain();
    efectos.connect(maestro);
    fondo = ctx.createGain();
    fondo.gain.value = S.ambiente;
    fondo.connect(maestro);
    if (ambienteQuerido) ambiente = crearAmbienteCueva(ctx, fondo);
  }
  window.addEventListener('pointerdown', arrancar);
  window.addEventListener('keydown', arrancar);
  // Con la pestaña escondida no suena nada (el juego tampoco se pinta).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });

  function sonar(sonido: Sonido, fuerza = 1) {
    if (!ctx || !efectos || silencio || ctx.state !== 'running') return;
    tocar(ctx, efectos, sonido, ctx.currentTime, fuerza, Math.random());
  }

  return {
    sonar,
    sonarTodos(toques: Toque[]) {
      for (const t of toques) sonar(t.sonido, t.fuerza);
    },
    /** Empieza el fondo de la cueva (o en cuanto se pueda sonar). */
    empezarAmbiente() {
      ambienteQuerido = true;
      if (ctx && fondo && !ambiente) ambiente = crearAmbienteCueva(ctx, fondo);
    },
    /**
     * En cada fotograma: de vez en cuando cae una gota. `grieta` (0-1): en la
     * grieta el rumor suena más abierto y caen la mitad de gotas. `exterior`
     * (0-1): fuera no hay gotas y el rumor suena a viento.
     */
    actualizar(dt: number, grieta = 0, exterior = 0) {
      // Fuera, el rumor se abre del todo: suena a viento.
      const enCueva = S.filtroCueva + (S.filtroGrieta - S.filtroCueva) * grieta;
      const filtro = enCueva + (S.filtroExterior - enCueva) * exterior;
      // Solo cuando cambia de verdad: cada orden se queda apuntada en el AudioContext.
      if (ctx && ambiente && Math.abs(filtro - ultimoFiltro) > 2) {
        ultimoFiltro = filtro;
        ambiente.filtro.frequency.setTargetAtTime(filtro, ctx.currentTime, 0.5);
      }
      if (!ambienteQuerido || enPausa) return;
      const gotas = S.gotasPorSegundo * (1 - grieta * 0.5) * (1 - exterior);
      if (Math.random() < gotas * Math.min(dt, 0.1)) sonar('gota', 0.4 + Math.random() * 0.6);
    },
    /**
     * El motor de la avioneta (0-1): se crea al empezar a sonar y se quita
     * al volver a 0. Solo manda al AudioContext los cambios que se oyen.
     */
    motor(potencia: number) {
      if (!ctx || !efectos || ctx.state !== 'running') return;
      if (potencia <= 0.001) {
        if (motor) motor.parar(ctx.currentTime);
        motor = null;
        potenciaMotor = -1;
        return;
      }
      if (!motor) motor = crearMotor(ctx, efectos);
      if (Math.abs(potencia - potenciaMotor) < 0.01) return;
      potenciaMotor = potencia;
      motor.potencia(potencia, ctx.currentTime);
    },
    /** Pausa (solo): baja el volumen y no caen gotas. */
    pausar(si: boolean) {
      enPausa = si;
      ajustarVolumen();
    },
    silenciado: () => silencio,
    silenciar(si: boolean) {
      silencio = si;
      localStorage.setItem(CLAVE, si ? 'no' : 'si');
      ajustarVolumen();
      for (const f of avisos) f(si);
    },
    alCambiarSilencio(f: (silencio: boolean) => void) {
      avisos.add(f);
    },
    /** Para el panel y las pruebas: ¿hay sonido de verdad? */
    estado: () => ctx?.state ?? 'sin crear',
  };
}

export type Audio = ReturnType<typeof crearAudio>;

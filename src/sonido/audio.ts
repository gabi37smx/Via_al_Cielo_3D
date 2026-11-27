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
import { crearAmbienteCueva, tocar } from './sintetizador.ts';
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
  let pararAmbiente: (() => void) | null = null;
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
    if (ambienteQuerido) pararAmbiente = crearAmbienteCueva(ctx, fondo);
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
      if (ctx && fondo && !pararAmbiente) pararAmbiente = crearAmbienteCueva(ctx, fondo);
    },
    /** En cada fotograma: de vez en cuando cae una gota en la cueva. */
    actualizar(dt: number) {
      if (!ambienteQuerido || enPausa) return;
      if (Math.random() < S.gotasPorSegundo * Math.min(dt, 0.1)) sonar('gota', 0.4 + Math.random() * 0.6);
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

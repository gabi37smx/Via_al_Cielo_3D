/*
 * CÓMO suena cada sonido (sesión 7, decisión 037). Todo se fabrica con Web
 * Audio en el momento: osciladores (tonos) y ruido filtrado (golpes, roces,
 * soplidos). No hay archivos que descargar ni que acreditar, igual que las
 * texturas pintadas en canvas (decisión 014).
 *
 * `tocar` sirve para un AudioContext (el juego) y para un OfflineAudioContext
 * (herramientas/sonidos.mjs, que los graba en WAV para oírlos y medirlos).
 */
import type { Sonido } from './sucesos.ts';

type Contexto = BaseAudioContext;

/* ---------- Piezas ---------- */

/** Un segundo de ruido blanco por contexto (se reutiliza). */
const ruidos = new WeakMap<Contexto, AudioBuffer>();
function ruidoBlanco(ctx: Contexto): AudioBuffer {
  let b = ruidos.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    // Ruido con semilla fija: el mismo en todas las partidas (y en las pruebas).
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      d[i] = (s / 0xffffffff) * 2 - 1;
    }
    ruidos.set(ctx, b);
  }
  return b;
}

/** Envolvente: sube en `ataque` s hasta `vol` y se apaga del todo a los `dur` s. */
function envolvente(ctx: Contexto, destino: AudioNode, t0: number, dur: number, vol: number, ataque = 0.005): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(destino);
  return g;
}

interface OpcionesTono {
  forma?: OscillatorType;
  desde: number;
  hasta?: number;
  t0: number;
  dur: number;
  vol: number;
  ataque?: number;
}

/** Un tono que va de `desde` a `hasta` Hz. */
function tono(ctx: Contexto, destino: AudioNode, o: OpcionesTono) {
  const osc = ctx.createOscillator();
  osc.type = o.forma ?? 'sine';
  osc.frequency.setValueAtTime(o.desde, o.t0);
  if (o.hasta !== undefined && o.hasta !== o.desde) osc.frequency.exponentialRampToValueAtTime(o.hasta, o.t0 + o.dur);
  osc.connect(envolvente(ctx, destino, o.t0, o.dur, o.vol, o.ataque));
  osc.start(o.t0);
  osc.stop(o.t0 + o.dur + 0.02);
}

interface OpcionesSoplo {
  filtro: BiquadFilterType;
  desde: number;
  hasta?: number;
  q?: number;
  t0: number;
  dur: number;
  vol: number;
  ataque?: number;
}

/** Ruido filtrado: golpes (graves), roces y soplidos (medios), siseos (agudos). */
function soplo(ctx: Contexto, destino: AudioNode, o: OpcionesSoplo) {
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruidoBlanco(ctx);
  fuente.loop = true;
  const filtro = ctx.createBiquadFilter();
  filtro.type = o.filtro;
  filtro.Q.value = o.q ?? 1;
  filtro.frequency.setValueAtTime(o.desde, o.t0);
  if (o.hasta !== undefined && o.hasta !== o.desde) filtro.frequency.exponentialRampToValueAtTime(o.hasta, o.t0 + o.dur);
  fuente.connect(filtro).connect(envolvente(ctx, destino, o.t0, o.dur, o.vol, o.ataque));
  fuente.start(o.t0, Math.random() * 0.5);
  fuente.stop(o.t0 + o.dur + 0.02);
}

/** Notas en fila (`separacion` s entre una y otra); la última dura `final` s. */
function melodia(ctx: Contexto, destino: AudioNode, t0: number, notas: number[], separacion: number, final: number, vol: number, forma: OscillatorType = 'triangle') {
  notas.forEach((f, i) => {
    const ultima = i === notas.length - 1;
    tono(ctx, destino, { forma, desde: f, t0: t0 + i * separacion, dur: ultima ? final : separacion * 1.6, vol, ataque: 0.01 });
  });
}

/** Campanita: un tono con un armónico «inarmónico» (como un cristal). */
function campana(ctx: Contexto, destino: AudioNode, f: number, t0: number, dur: number, vol: number) {
  tono(ctx, destino, { desde: f, t0, dur, vol, ataque: 0.002 });
  tono(ctx, destino, { desde: f * 2.76, t0, dur: dur * 0.5, vol: vol * 0.35, ataque: 0.002 });
}

/* ---------- Notas (Hz) ---------- */
const DO5 = 523.25, MI5 = 659.25, SOL5 = 783.99, DO6 = 1046.5, MI6 = 1318.5, SOL6 = 1568;
const SOL4 = 392, FA4 = 349.23, MIb4 = 311.13, DO4 = 261.63;

/** Lo que dura cada sonido (s), con margen: para grabarlos y para no cortarlos. */
export const DURACION: Record<Sonido, number> = {
  salto: 0.2,
  dobleSalto: 0.3,
  aterrizaje: 0.2,
  paso: 0.08,
  agarre: 0.12,
  trepar: 0.4,
  fragmento: 0.75,
  vidaExtra: 0.6,
  golpe: 0.3,
  caida: 0.45,
  derrota: 1.3,
  record: 1.5,
  reaparecer: 0.6,
  cuenta: 0.25,
  salida: 0.6,
  meta: 1,
  victoria: 1.6,
  finCarrera: 0.8,
  gota: 0.35,
};

/**
 * Toca `sonido` en `t0` (tiempo del contexto) hacia `destino`. `fuerza` (0-1)
 * cambia el volumen de los que dependen de algo (aterrizajes, pasos) y
 * `variacion` (0-1) cambia un poco el tono, para que los pasos y las gotas no
 * suenen siempre igual.
 */
export function tocar(ctx: Contexto, destino: AudioNode, sonido: Sonido, t0: number, fuerza = 1, variacion = 0.5) {
  const v = 0.9 + variacion * 0.2; // ±10 % de tono
  switch (sonido) {
    case 'salto':
      tono(ctx, destino, { forma: 'triangle', desde: 260 * v, hasta: 520 * v, t0, dur: 0.14, vol: 0.18 });
      soplo(ctx, destino, { filtro: 'bandpass', desde: 800, hasta: 2000, t0, dur: 0.12, vol: 0.1 });
      break;
    case 'dobleSalto':
      tono(ctx, destino, { forma: 'triangle', desde: 420 * v, hasta: 900 * v, t0, dur: 0.16, vol: 0.15 });
      soplo(ctx, destino, { filtro: 'bandpass', desde: 1500, hasta: 4500, q: 0.8, t0, dur: 0.26, vol: 0.14, ataque: 0.04 });
      break;
    case 'aterrizaje':
      soplo(ctx, destino, { filtro: 'lowpass', desde: 500, hasta: 120, t0, dur: 0.14, vol: 0.45 * fuerza });
      tono(ctx, destino, { desde: 120 * v, hasta: 50, t0, dur: 0.12, vol: 0.4 * fuerza });
      break;
    case 'paso':
      // Grava bajo la bota: un chasquido corto, cada uno un poco distinto.
      soplo(ctx, destino, { filtro: 'bandpass', desde: 1700 * v, q: 1.8, t0, dur: 0.05, vol: 0.18 * (0.5 + fuerza * 0.5) });
      soplo(ctx, destino, { filtro: 'lowpass', desde: 350, t0, dur: 0.04, vol: 0.12 * (0.5 + fuerza * 0.5) });
      break;
    case 'agarre':
      // Palmada de las manos contra la roca.
      soplo(ctx, destino, { filtro: 'bandpass', desde: 1200, q: 1.5, t0, dur: 0.07, vol: 0.4 });
      soplo(ctx, destino, { filtro: 'lowpass', desde: 300, t0, dur: 0.06, vol: 0.25 });
      break;
    case 'trepar':
      // Roce de la ropa y las botas subiendo.
      soplo(ctx, destino, { filtro: 'bandpass', desde: 600, hasta: 1500, q: 1, t0, dur: 0.35, vol: 0.14, ataque: 0.06 });
      break;
    case 'fragmento':
      campana(ctx, destino, SOL6, t0, 0.6, 0.14);
      campana(ctx, destino, DO6 * 2, t0 + 0.08, 0.65, 0.12);
      break;
    case 'vidaExtra':
      melodia(ctx, destino, t0, [DO5, MI5, SOL5, DO6], 0.08, 0.3, 0.13);
      break;
    case 'golpe': {
      // Chillido del murciélago (con temblor) y el golpe.
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2400, t0);
      osc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.16);
      const temblor = ctx.createOscillator();
      temblor.frequency.value = 38;
      const cuanto = ctx.createGain();
      cuanto.gain.value = 180;
      temblor.connect(cuanto).connect(osc.frequency);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = 2000;
      filtro.Q.value = 2;
      osc.connect(filtro).connect(envolvente(ctx, destino, t0, 0.18, 0.22));
      osc.start(t0);
      temblor.start(t0);
      osc.stop(t0 + 0.2);
      temblor.stop(t0 + 0.2);
      soplo(ctx, destino, { filtro: 'lowpass', desde: 700, hasta: 150, t0, dur: 0.12, vol: 0.4 });
      tono(ctx, destino, { forma: 'square', desde: 180, hasta: 90, t0, dur: 0.12, vol: 0.08 });
      break;
    }
    case 'caida':
      tono(ctx, destino, { desde: 150, hasta: 42, t0, dur: 0.35, vol: 0.55 * fuerza });
      soplo(ctx, destino, { filtro: 'lowpass', desde: 600, hasta: 90, t0, dur: 0.3, vol: 0.55 * fuerza });
      break;
    case 'derrota':
      melodia(ctx, destino, t0, [SOL4, FA4, MIb4, DO4], 0.2, 0.7, 0.16);
      break;
    case 'record':
      melodia(ctx, destino, t0, [DO5, MI5, SOL5], 0.11, 0.2, 0.13);
      for (const f of [DO6, MI6, SOL6]) tono(ctx, destino, { forma: 'triangle', desde: f, t0: t0 + 0.33, dur: 1.1, vol: 0.09, ataque: 0.01 });
      break;
    case 'reaparecer':
      tono(ctx, destino, { desde: 400, hasta: 1600, t0, dur: 0.5, vol: 0.12, ataque: 0.1 });
      soplo(ctx, destino, { filtro: 'highpass', desde: 3000, t0, dur: 0.5, vol: 0.06, ataque: 0.15 });
      break;
    case 'cuenta':
      tono(ctx, destino, { desde: 660, t0, dur: 0.2, vol: 0.25 });
      break;
    case 'salida':
      tono(ctx, destino, { desde: 1320, t0, dur: 0.55, vol: 0.25 });
      tono(ctx, destino, { forma: 'square', desde: 660, t0, dur: 0.4, vol: 0.04 });
      break;
    case 'meta':
      melodia(ctx, destino, t0, [DO5, MI5, SOL5, DO6], 0.12, 0.6, 0.14);
      melodia(ctx, destino, t0, [DO5 / 2, MI5 / 2, SOL5 / 2, DO5], 0.12, 0.6, 0.03, 'square');
      break;
    case 'victoria':
      melodia(ctx, destino, t0, [SOL5, SOL5, SOL5], 0.12, 0.12, 0.13);
      for (const f of [DO6, MI6, SOL6]) tono(ctx, destino, { forma: 'triangle', desde: f, t0: t0 + 0.4, dur: 1.15, vol: 0.09, ataque: 0.01 });
      tono(ctx, destino, { forma: 'square', desde: DO5 / 2, t0: t0 + 0.4, dur: 1.1, vol: 0.03 });
      break;
    case 'finCarrera':
      melodia(ctx, destino, t0, [MI5, SOL5], 0.18, 0.55, 0.13);
      break;
    case 'gota': {
      // Gota de agua en la cueva y su eco.
      const f = 1500 * v;
      tono(ctx, destino, { desde: f, hasta: f / 3, t0, dur: 0.07, vol: 0.12 * fuerza, ataque: 0.001 });
      tono(ctx, destino, { desde: f, hasta: f / 3, t0: t0 + 0.17, dur: 0.07, vol: 0.035 * fuerza, ataque: 0.001 });
      break;
    }
  }
}

/** Fondo de la cueva: un rumor grave que «respira» (ruido marrón filtrado). */
export function crearAmbienteCueva(ctx: Contexto, destino: AudioNode): () => void {
  const segundos = 4;
  const b = ctx.createBuffer(1, ctx.sampleRate * segundos, ctx.sampleRate);
  const d = b.getChannelData(0);
  const blanco = ruidoBlanco(ctx).getChannelData(0);
  let ultimo = 0;
  for (let i = 0; i < d.length; i++) {
    // Ruido marrón: cada muestra se acerca un poco a la anterior (más grave).
    ultimo = (ultimo + 0.02 * blanco[i % blanco.length]!) / 1.02;
    d[i] = ultimo * 3.5;
  }
  // Que el final empalme sin chasquido: los últimos 0,2 s se funden con los
  // primeros, y la vuelta salta justo a donde acaba esa fusión (loopStart).
  const cruce = Math.floor(ctx.sampleRate * 0.2);
  for (let i = 0; i < cruce; i++) {
    const a = i / cruce;
    d[d.length - cruce + i] = d[d.length - cruce + i]! * (1 - a) + d[i]! * a;
  }
  const fuente = ctx.createBufferSource();
  fuente.buffer = b;
  fuente.loop = true;
  fuente.loopStart = cruce / ctx.sampleRate;
  fuente.loopEnd = segundos;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 220;
  const volumen = ctx.createGain();
  volumen.gain.value = 0.5;
  // Respiración lenta: el volumen sube y baja cada ~14 s.
  const respiro = ctx.createOscillator();
  respiro.frequency.value = 0.07;
  const cuanto = ctx.createGain();
  cuanto.gain.value = 0.18;
  respiro.connect(cuanto).connect(volumen.gain);
  fuente.connect(filtro).connect(volumen).connect(destino);
  fuente.start();
  respiro.start();
  return () => {
    fuente.stop();
    respiro.stop();
  };
}

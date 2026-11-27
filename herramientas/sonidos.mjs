#!/usr/bin/env node
/*
 * Graba cada sonido del juego en un WAV para oírlo suelto y comprobar que
 * ninguno sale mudo ni saturado (la IA no puede oír: así lo mide).
 *
 *   npm run sonidos
 *
 * Abre Chromium sin pantalla, toca cada sonido con el MISMO código del juego
 * (src/sonido/sintetizador.ts) en un OfflineAudioContext y deja
 * capturas/sonidos/<nombre>.wav (+ ambiente.wav, 6 s del fondo de la cueva).
 * Enseña una tabla con la duración, el pico y el volumen medio (RMS).
 * Falla si alguno no suena (pico < 0,02) o se satura (pico > 1).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = resolve(raiz, 'capturas/sonidos');
const servidor = await createServer({ root: raiz, logLevel: 'error', server: { port: 0 } });
let navegador;
let fallos = 0;

/** WAV de 16 bits, un canal. */
function wav(muestras, frecuencia) {
  const datos = Buffer.alloc(44 + muestras.length * 2);
  datos.write('RIFF', 0);
  datos.writeUInt32LE(36 + muestras.length * 2, 4);
  datos.write('WAVEfmt ', 8);
  datos.writeUInt32LE(16, 16);
  datos.writeUInt16LE(1, 20);
  datos.writeUInt16LE(1, 22);
  datos.writeUInt32LE(frecuencia, 24);
  datos.writeUInt32LE(frecuencia * 2, 28);
  datos.writeUInt16LE(2, 32);
  datos.writeUInt16LE(16, 34);
  datos.write('data', 36);
  datos.writeUInt32LE(muestras.length * 2, 40);
  muestras.forEach((m, i) => datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, m)) * 32767), 44 + i * 2));
  return datos;
}

try {
  await servidor.listen();
  const url = servidor.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite no ha dado una dirección local');
  navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  pagina.on('pageerror', (e) => {
    fallos++;
    console.log(`[navegador excepción] ${e.message}`);
  });
  await pagina.goto(new URL('?', url).href);

  const grabaciones = await pagina.evaluate(async () => {
    const { tocar, crearAmbienteCueva, DURACION } = await import('/src/sonido/sintetizador.ts');
    const { SONIDOS } = await import('/src/sonido/sucesos.ts');
    const frecuencia = 44100;
    const grabar = async (segundos, poner) => {
      const ctx = new OfflineAudioContext(1, Math.ceil(frecuencia * segundos), frecuencia);
      poner(ctx);
      return Array.from((await ctx.startRendering()).getChannelData(0));
    };
    const salida = [];
    for (const s of SONIDOS) {
      salida.push({ nombre: s, duracion: DURACION[s], muestras: await grabar(DURACION[s], (ctx) => tocar(ctx, ctx.destination, s, 0, 1, 0.5)) });
    }
    salida.push({ nombre: 'ambiente', duracion: 6, muestras: await grabar(6, (ctx) => crearAmbienteCueva(ctx, ctx.destination)) });
    return { frecuencia, salida };
  });

  await mkdir(carpeta, { recursive: true });
  const filas = [];
  for (const g of grabaciones.salida) {
    const pico = g.muestras.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    const rms = Math.sqrt(g.muestras.reduce((m, x) => m + x * x, 0) / g.muestras.length);
    // ¿Se apaga antes de acabar la grabación? (si no, el sonido se corta)
    const cola = g.muestras.slice(-Math.floor(grabaciones.frecuencia * 0.02));
    const picoCola = cola.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    const problema = pico < 0.02 ? 'NO SUENA' : pico > 1 ? 'SATURA' : g.nombre !== 'ambiente' && picoCola > 0.01 ? 'SE CORTA' : '';
    if (problema) fallos++;
    filas.push({ sonido: g.nombre, 's': g.duracion, pico: pico.toFixed(2), rms: rms.toFixed(3), problema });
    await writeFile(resolve(carpeta, `${g.nombre}.wav`), wav(g.muestras, grabaciones.frecuencia));
  }
  console.table(filas);
  console.log(`WAV en ${carpeta}`);
} catch (e) {
  console.error(`No se pudieron grabar los sonidos: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  await navegador?.close();
  await servidor.close();
}
if (fallos > 0) {
  console.log(`Ojo: ${fallos} problema(s).`);
  process.exitCode = 1;
}

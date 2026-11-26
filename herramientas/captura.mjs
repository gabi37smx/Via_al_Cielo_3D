#!/usr/bin/env node
/*
 * Herramienta de captura: abre el juego en Chromium SIN ventana y guarda una
 * imagen, para que la IA (y tú) podáis ver lo que se ha hecho sin abrir nada.
 *
 *   npm run captura
 *   node herramientas/captura.mjs [--salida capturas/x.png] [--ancho 1280] [--alto 720] [--espera 500]
 *                                 [--ruta "?semilla=1&altura=60&panel=1"]
 *
 *                                 [--teclas "KeyW:600,Space:80"]
 *
 * `--ruta` se añade a la dirección del juego: sirve para elegir la torre
 * (semilla), mirar a otra altura o abrir el panel de datos.
 * `--teclas` pulsa teclas antes de la captura (código:milisegundos, en orden),
 * para ver el juego en movimiento: un salto, una carrera… `_:300` espera
 * 300 ms sin pulsar nada (p. ej. doble salto: "Space:60,_:300,Space:60").
 *
 * Arranca su propio servidor de Vite en un puerto libre (no hace falta tener
 * `npm run dev` abierto), espera a que el juego avise de que ya ha pintado
 * (body[data-listo]) y muestra los errores de la consola del navegador.
 *
 * Sin tarjeta gráfica (servidores, CI) Chromium usa SwiftShader, que dibuja
 * WebGL por software: por eso los parámetros --use-angle y --enable-unsafe-swiftshader.
 *
 * La primera vez: npx playwright install chromium
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { values: op } = parseArgs({
  options: {
    salida: { type: 'string', default: 'capturas/captura.png' },
    ancho: { type: 'string', default: '1280' },
    alto: { type: 'string', default: '720' },
    espera: { type: 'string', default: '500' },
    ruta: { type: 'string', default: '?semilla=1&panel=1' },
    teclas: { type: 'string', default: '' },
  },
});

const salida = resolve(raiz, op.salida);
const servidor = await createServer({ root: raiz, logLevel: 'error', server: { port: 0 } });
let navegador;
let errores = 0;

try {
  await servidor.listen();
  const url = servidor.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite no ha dado una dirección local');

  navegador = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const pagina = await navegador.newPage({
    viewport: { width: Number(op.ancho), height: Number(op.alto) },
  });

  pagina.on('console', (m) => {
    // «GL Driver Message … ReadPixels» es ruido de SwiftShader al hacer la captura.
    if (m.text().includes('GL Driver Message')) return;
    if (m.type() === 'error' || m.type() === 'warning') {
      if (m.type() === 'error') errores++;
      console.log(`[navegador ${m.type()}] ${m.text()}`);
    }
  });
  pagina.on('pageerror', (e) => {
    errores++;
    console.log(`[navegador excepción] ${e.message}`);
  });

  await pagina.goto(new URL(op.ruta, url).href);
  await pagina.waitForSelector('body[data-listo]', { timeout: 15000 });
  for (const par of op.teclas.split(',').filter(Boolean)) {
    const [tecla, ms = '100'] = par.trim().split(':');
    if (tecla === '_') {
      await pagina.waitForTimeout(Number(ms));
      continue;
    }
    await pagina.keyboard.down(tecla);
    await pagina.waitForTimeout(Number(ms));
    await pagina.keyboard.up(tecla);
  }
  await pagina.waitForTimeout(Number(op.espera));

  await mkdir(dirname(salida), { recursive: true });
  await pagina.screenshot({ path: salida });
  console.log(`Captura guardada en ${salida}`);
  if (errores > 0) console.log(`Ojo: ${errores} error(es) en la consola del navegador.`);
} catch (e) {
  console.error(`No se pudo capturar: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  await navegador?.close();
  await servidor.close();
}
if (errores > 0) process.exitCode = 1;

#!/usr/bin/env node
/*
 * Prueba de red con DOS navegadores de verdad (Chromium sin pantalla) contra
 * Supabase:
 *
 *   npm run prueba-red
 *
 * 1. Ana crea la sala y Beto entra con el mismo código.
 * 2. Los dos se ven en la lista, con la misma semilla y Ana de anfitriona.
 * 3. Beto corre: Ana tiene que verle cerca de donde está de verdad.
 * 4. Carrera (sesión 6): Ana la empieza con rivales del ordenador; los dos
 *    cuentan 3-2-1 y salen; Beto y luego Ana llegan a la meta (se les
 *    teletransporta encima del rellano para no subir 220 m); los dos ven las
 *    mismas llegadas, la carrera acaba y Beto gana.
 * 5. Ana se va: Beto se queda solo y pasa a ser el anfitrión.
 *
 * Deja capturas/red-ana.png, capturas/red-beto.png y
 * capturas/red-carrera.png (resultados). Necesita los datos de
 * Supabase en .env o en variables de entorno VITE_SUPABASE_URL y
 * VITE_SUPABASE_CLAVE.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const codigo = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;

function comprobar(bien, texto) {
  console.log(`${bien ? '✔' : '✘'} ${texto}`);
  if (!bien) fallos++;
}

/** Espera hasta que `condicion(red)` se cumpla en la página (o se acabe el plazo). */
async function esperarRed(pagina, condicion, plazo = 15000) {
  const fin = Date.now() + plazo;
  let red = null;
  while (Date.now() < fin) {
    red = await pagina.evaluate(() => window.juego?.red ?? null);
    if (red && condicion(red)) return red;
    await esperar(300);
  }
  return red;
}

/** Espera hasta que `condicion(carrera)` se cumpla en la página (o se acabe el plazo). */
async function esperarCarrera(pagina, condicion, plazo = 60000) {
  const fin = Date.now() + plazo;
  let c = null;
  while (Date.now() < fin) {
    c = await pagina.evaluate(() => window.juego?.carrera ?? null);
    if (c && condicion(c)) return c;
    await esperar(300);
  }
  return c;
}

/** Encima del rellano (la meta), lejos del centro del pozo: cae y se posa. */
const encimaDeLaMeta = (angulo) => [Math.cos(angulo) * 11, 221.5, Math.sin(angulo) * 11];

const servidor = await createServer({ root: raiz, logLevel: 'error', server: { port: 0 } });
let navegador;
try {
  await servidor.listen();
  const url = servidor.resolvedUrls?.local[0];
  navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  async function jugador(nombre, aspecto) {
    const contexto = await navegador.newContext({ viewport: { width: 960, height: 600 } });
    const pagina = await contexto.newPage();
    pagina.on('pageerror', (e) => console.log(`[${nombre} excepción] ${e.message}`));
    pagina.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('GL Driver')) console.log(`[${nombre} error] ${m.text()}`);
    });
    await pagina.goto(new URL(`?sala=${codigo}&nombre=${nombre}&aspecto=${aspecto}`, url).href);
    return { contexto, pagina };
  }

  console.log(`Sala de prueba: ${codigo}`);
  // Ana sube con la escaladora y Beto con el escalador: cada uno tiene que ver al otro como se eligió.
  const ana = await jugador('Ana', 'escaladora');
  await ana.pagina.waitForSelector('body[data-listo]', { timeout: 30000 });
  const beto = await jugador('Beto', 'escalador');
  await beto.pagina.waitForSelector('body[data-listo]', { timeout: 30000 });

  // 2 · Se ven los dos.
  const redAna = await esperarRed(ana.pagina, (r) => r.miembros.length === 2);
  const redBeto = await esperarRed(beto.pagina, (r) => r.miembros.length === 2);
  comprobar(redAna?.miembros.join() === 'Ana,Beto', `Ana ve a los dos: ${redAna?.miembros.join(', ')}`);
  comprobar(redBeto?.miembros.join() === 'Ana,Beto', `Beto ve a los dos: ${redBeto?.miembros.join(', ')}`);
  comprobar(redAna?.semilla === redBeto?.semilla, `Misma torre (semilla ${redAna?.semilla} y ${redBeto?.semilla})`);
  comprobar(redAna?.anfitrion === 'Ana' && redBeto?.anfitrion === 'Ana', 'Ana es la anfitriona para los dos');
  comprobar(redBeto?.rivales[0]?.aspecto === 'escaladora', `Beto ve a Ana como escaladora (${redBeto?.rivales[0]?.aspecto})`);
  comprobar(redAna?.rivales[0]?.aspecto === 'escalador', `Ana ve a Beto como escalador (${redAna?.rivales[0]?.aspecto})`);

  // 3 · Beto corre y Ana le ve donde está.
  await beto.pagina.keyboard.down('KeyA');
  await esperar(1500);
  await beto.pagina.keyboard.up('KeyA');
  await esperar(1200); // que paren y llegue el último estado
  const real = await beto.pagina.evaluate(() => ({ x: juego.escalador.x, y: juego.escalador.y, z: juego.escalador.z }));
  const visto = (await esperarRed(ana.pagina, (r) => r.rivales[0]?.visible))?.rivales[0];
  const distancia = visto ? Math.hypot(visto.x - real.x, visto.y - real.y, visto.z - real.z) : Infinity;
  comprobar(visto?.visible === true, 'Ana ve el escalador de Beto');
  comprobar(distancia < 0.5, `Ana ve a Beto donde está de verdad (a ${distancia.toFixed(2)} m)`);

  await mkdir(resolve(raiz, 'capturas'), { recursive: true });
  await ana.pagina.screenshot({ path: resolve(raiz, 'capturas/red-ana.png') });
  await beto.pagina.screenshot({ path: resolve(raiz, 'capturas/red-beto.png') });

  // 4 · La carrera.
  await ana.pagina.evaluate(() => window.juego.empezarCarrera(true));
  const enCursoAna = await esperarCarrera(ana.pagina, (c) => c.fase === 'enCurso');
  const enCursoBeto = await esperarCarrera(beto.pagina, (c) => c.fase === 'enCurso');
  comprobar(enCursoAna?.fase === 'enCurso' && enCursoBeto?.fase === 'enCurso', 'Los dos cuentan 3-2-1 y salen');
  comprobar(
    enCursoBeto?.participantes.join() === 'Ana,Beto,Roca,Grieta',
    `Los mismos corredores en los dos (2 personas + 2 del ordenador): ${enCursoBeto?.participantes.join(', ')}`,
  );
  // La meta por debajo de 220 m / 14 m/s ≈ 16 s se rechaza (sería trampa): se espera a pasar de 17 s.
  await esperarCarrera(beto.pagina, (c) => c.tiempo > 17, 120000);
  await beto.pagina.evaluate((p) => window.juego.teletransportar(...p), encimaDeLaMeta(1));
  const llegaBeto = await esperarCarrera(ana.pagina, (c) => c.llegadas.some((l) => l.nombre === 'Beto'));
  comprobar(llegaBeto?.llegadas.some((l) => l.nombre === 'Beto'), 'Ana se entera de que Beto ha llegado a la meta');
  await esperarCarrera(ana.pagina, (c) => c.tiempo > 19, 60000);
  await ana.pagina.evaluate((p) => window.juego.teletransportar(...p), encimaDeLaMeta(3));
  const finAna = await esperarCarrera(ana.pagina, (c) => c.fase === 'terminada');
  const finBeto = await esperarCarrera(beto.pagina, (c) => c.fase === 'terminada');
  comprobar(finAna?.fase === 'terminada' && finBeto?.fase === 'terminada', 'Al llegar las dos personas, la anfitriona da la carrera por acabada');
  const orden = (c) => c?.llegadas.slice().sort((a, b) => a.tiempo - b.tiempo).filter((l) => l.nombre === 'Ana' || l.nombre === 'Beto').map((l) => l.nombre).join();
  comprobar(orden(finAna) === 'Beto,Ana' && orden(finBeto) === 'Beto,Ana', `Gana Beto en los dos navegadores (${orden(finAna)} / ${orden(finBeto)})`);
  await esperar(500);
  await beto.pagina.screenshot({ path: resolve(raiz, 'capturas/red-carrera.png') });

  // 5 · Ana se va: Beto hereda la sala.
  await ana.contexto.close();
  const final = await esperarRed(beto.pagina, (r) => r.miembros.length === 1, 30000);
  comprobar(final?.miembros.join() === 'Beto', `Al irse Ana, en la sala queda: ${final?.miembros.join(', ')}`);
  comprobar(final?.anfitrion === 'Beto', `El nuevo anfitrión es ${final?.anfitrion}`);
} catch (e) {
  console.error(`La prueba se ha roto: ${e instanceof Error ? e.message : e}`);
  fallos++;
} finally {
  await navegador?.close();
  await servidor.close();
}
console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nRed OK: capturas en capturas/red-ana.png y capturas/red-beto.png');
process.exitCode = fallos ? 1 : 0;

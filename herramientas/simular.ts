/*
 * Simula subidas de la cueva con el cerebro del ordenador y enseña una tabla.
 *
 *   npm run simular                    20 torres con los murciélagos de config
 *   npm run simular -- 50 20           50 torres con 20 murciélagos
 *
 * Node 24 ejecuta TypeScript directamente (quita los tipos al cargar).
 */
import { REGLAS } from '../src/reglas/partida.ts';
import { simularSubida } from '../src/bots/simulacion.ts';

const torres = Number(process.argv[2]) || 20;
const murcielagos = Number(process.argv[3] ?? REGLAS.murcielagosCueva);

const inicio = performance.now();
const resultados = Array.from({ length: torres }, (_, i) => simularSubida(i + 1, { murcielagos }));
const ms = performance.now() - inicio;

const media = (f: (r: (typeof resultados)[number]) => number) =>
  resultados.reduce((s, r) => s + f(r), 0) / resultados.length;

console.table(
  resultados.map((r) => ({
    semilla: r.semilla,
    llega: r.llego ? 'sí' : r.murio ? 'muere' : 'no',
    segundos: Math.round(r.segundos),
    saltos: r.saltos,
    dobles: r.doblesSaltos,
    tropiezos: r.tropiezos,
    golpes: r.golpes,
    fragmentos: r.fragmentos,
    vida: r.vida,
  })),
);
console.log(`${torres} torres con ${murcielagos} murciélagos, simuladas en ${Math.round(ms)} ms`);
console.log(`Llegan arriba: ${resultados.filter((r) => r.llego).length}/${torres} · mueren: ${resultados.filter((r) => r.murio).length}`);
console.log(`Media: ${media((r) => r.segundos).toFixed(0)} s, ${media((r) => r.golpes).toFixed(1)} golpes, vida final ${media((r) => r.vida).toFixed(0)}, ${media((r) => r.tropiezos).toFixed(1)} tropiezos`);

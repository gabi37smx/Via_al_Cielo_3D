/*
 * Simula subidas con el cerebro del ordenador y enseña una tabla.
 *
 *   npm run simular                    20 torres de la cueva (tramo 1) con sus murciélagos
 *   npm run simular -- 50 20           50 torres con 20 murciélagos
 *   npm run simular -- 20 - 2          20 torres de la grieta (tramo 2) con sus murciélagos
 *   npm run simular -- 20 - 3          20 laderas de la montaña (tramo 3) con sus águilas y el viento
 *   npm run simular -- 20 30 3         la ladera con 30 águilas
 *
 * Node 24 ejecuta TypeScript directamente (quita los tipos al cargar).
 */
import { murcielagosDelTramo } from '../src/reglas/partida.ts';
import { AIRE } from '../src/reglas/aire.ts';
import { INDICE_LADERA } from '../src/reglas/ladera.ts';
import { ESCENARIOS } from '../src/reglas/torre.ts';
import { simularSubida } from '../src/bots/simulacion.ts';

const torres = Number(process.argv[2]) || 20;
const tramo = Math.min(Math.max((Number(process.argv[4]) || 1) - 1, 0), ESCENARIOS.length - 1);
const argMurcielagos = process.argv[3];
// En la ladera, el número es de águilas (allí no hay murciélagos).
const enLadera = tramo === INDICE_LADERA;
const porDefecto = enLadera ? AIRE.aguilas : murcielagosDelTramo(tramo);
const murcielagos = argMurcielagos === undefined || argMurcielagos === '-' ? porDefecto : Number(argMurcielagos);

const inicio = performance.now();
const resultados = Array.from({ length: torres }, (_, i) => simularSubida(i + 1, { tramo, murcielagos }));
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
    agarres: r.agarres,
    tropiezos: r.tropiezos,
    golpes: r.golpes,
    fragmentos: r.fragmentos,
    vida: r.vida,
  })),
);
console.log(`Tramo ${tramo + 1} (${ESCENARIOS[tramo]}): ${torres} torres con ${murcielagos} ${enLadera ? 'águilas y viento' : 'murciélagos'}, simuladas en ${Math.round(ms)} ms`);
console.log(`Llegan arriba: ${resultados.filter((r) => r.llego).length}/${torres} · mueren: ${resultados.filter((r) => r.murio).length}`);
console.log(`Media: ${media((r) => r.segundos).toFixed(0)} s, ${media((r) => r.golpes).toFixed(1)} golpes, vida final ${media((r) => r.vida).toFixed(0)}, ${media((r) => r.tropiezos).toFixed(1)} tropiezos, ${media((r) => r.agarres).toFixed(1)} agarres`);

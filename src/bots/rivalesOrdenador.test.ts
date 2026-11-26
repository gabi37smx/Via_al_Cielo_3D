import { describe, expect, it } from 'vitest';
import { PASO } from '../nucleo/bucle.ts';
import { REGLAS, generarFragmentos, generarMurcielagos } from '../reglas/partida.ts';
import { generarTramo } from '../reglas/torre.ts';
import { crearRivalesOrdenador, pasoRivalesOrdenador } from './rivalesOrdenador.ts';

/** Una carrera entera solo con los 3 rivales del ordenador. Devuelve sus tiempos de llegada. */
function carrera(semilla: number, ronda = 1) {
  const tramo = generarTramo(semilla, 0);
  const peligros = {
    fragmentos: generarFragmentos(semilla, tramo),
    murcielagos: generarMurcielagos(semilla, tramo, REGLAS.murcielagosCueva),
  };
  const rivales = crearRivalesOrdenador(semilla, ronda, tramo, 3, 1);
  for (let t = 0; t < 400 && rivales.some((r) => r.corredor.llegada === null); t += PASO) {
    pasoRivalesOrdenador(rivales, tramo, peligros, t, PASO);
  }
  return rivales.map((r) => r.corredor.llegada);
}

describe('rivales del ordenador en la carrera', () => {
  const SEMILLAS = [1, 42, 777, 2026, 31337];
  const resultados = SEMILLAS.map((s) => carrera(s));

  it('los tres llegan a la meta en todas las torres', () => {
    for (const r of resultados) for (const t of r) expect(t).not.toBeNull();
  });

  it('cada uno tiene su ritmo: no llegan juntos y el más tranquilo suele ser el último', () => {
    for (const r of resultados) expect(new Set(r.map((t) => t!.toFixed(1))).size).toBe(3);
    const media = (i: number) => resultados.reduce((a, r) => a + r[i]!, 0) / resultados.length;
    expect(media(0)).toBeLessThan(media(2)); // Roca (pausas cortas) antes que Pico (largas)
  });

  it('suben a ritmo de persona: entre 1,5 y 3 minutos, por debajo de 14 m/s', () => {
    for (const r of resultados) {
      for (const t of r) {
        expect(t!).toBeGreaterThan(90);
        expect(t!).toBeLessThan(180);
        expect(220 / t!).toBeLessThan(14);
      }
    }
  });

  it('es determinista: misma semilla y ronda → mismos tiempos en todos los navegadores', () => {
    expect(carrera(42)).toEqual(carrera(42));
  });

  it('en la revancha (otra ronda) las pausas cambian', () => {
    expect(carrera(42, 2)).not.toEqual(carrera(42, 1));
  });
});

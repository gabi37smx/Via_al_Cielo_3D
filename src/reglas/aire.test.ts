import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config.ts';
import { crearEscalador, pasoEscalador, type Ordenes, type Suelo } from '../jugador/control.ts';
import { PASO } from '../nucleo/bucle.ts';
import { AIRE, aguilaCerca, alAireLibre, empiezaRafaga, generarAguilas, posicionAguila, rafagaEn, viento } from './aire.ts';
import { BASE_LADERA, CIMA, RADIO_COLINA, aLocal, aMundo, dCara, generarLadera } from './ladera.ts';
import { REGLAS, crearPartida, pasoPartida } from './partida.ts';

const l = generarLadera(5);

describe('las águilas', () => {
  const aguilas = generarAguilas(5, l);

  it('son las mismas con la misma semilla, 22 como en el 2D, repartidas por la ladera', () => {
    expect(generarAguilas(5, l)).toEqual(aguilas);
    expect(aguilas).toHaveLength(22);
    for (const a of aguilas) {
      expect(a.y).toBeGreaterThan(BASE_LADERA + 10);
      expect(a.y).toBeLessThan(CIMA);
    }
    // Repartidas: ninguna franja de 40 m se queda sin águila.
    for (let y = BASE_LADERA + 20; y < CIMA - 40; y += 40) {
      expect(aguilas.some((a) => a.y >= y && a.y < y + 40)).toBe(true);
    }
  });

  it('van y vuelven de lado delante de la cara, por donde se sube', () => {
    for (const a of aguilas.slice(0, 5)) {
      let sentidos = new Set<number>();
      for (let t = 0; t < 40; t += 0.25) {
        const p = posicionAguila(a, t);
        const { d, u } = aLocal(l, p.x, p.z);
        expect(u).toBeCloseTo(p.u, 6);
        expect(Math.abs(u)).toBeLessThanOrEqual(AIRE.recorrido + 1e-9);
        // Delante de la cara, entre 0,8 y 3 m (donde están los salientes).
        expect(dCara(p.y) - d).toBeGreaterThanOrEqual(0.8 - 1e-6);
        expect(dCara(p.y) - d).toBeLessThanOrEqual(3 + 1e-6);
        expect(Math.abs(p.y - a.y)).toBeLessThanOrEqual(a.vaiven + 1e-9);
        sentidos.add(p.sentido);
      }
      expect(sentidos).toEqual(new Set([1, -1]));
      sentidos = new Set();
    }
  });

  it('al tocar al escalador le quitan 15 de vida (como en el 2D) y queda invulnerable', () => {
    const a = { ...aguilas[3]!, rapidez: 0 };
    const p = posicionAguila(a, PASO);
    const partida = crearPartida();
    const jugadas = pasoPartida(
      partida,
      { x: p.x, y: p.y - REGLAS.centroCuerpo, z: p.z, aterrizaje: 0 },
      { fragmentos: [], murcielagos: [], aguilas: [a] },
      PASO,
    );
    expect(jugadas).toContainEqual({ tipo: 'golpe', danio: 15, animal: 'aguila' });
    expect(partida.vida).toBe(85);
    expect(partida.invulnerable).toBeCloseTo(REGLAS.invulnerabilidad);
  });
});

describe('el aviso de que viene un águila', () => {
  it('se sabe si pasa alguna cerca', () => {
    const aguilas = generarAguilas(5, l);
    const p = posicionAguila(aguilas[7]!, 10);
    expect(aguilaCerca(aguilas, 10, p.x + 2, p.y, p.z, 7)).toBe(true);
    expect(aguilaCerca(aguilas, 10, 0, 300, 0, 7)).toBe(false);
  });
});

describe('el viento', () => {
  it('sopla a ráfagas: una por periodo, que sube y baja sin tirones, a un lado o al otro', () => {
    const { periodo, duracion, fuerza } = AIRE.rafaga;
    let soplando = 0;
    let total = 0;
    const sentidos = new Set<number>();
    for (let k = 0; k < 40; k++) {
      let rafagas = 0;
      let antes = 0;
      for (let t = k * periodo; t < (k + 1) * periodo; t += PASO) {
        const r = rafagaEn(l, t);
        expect(r.intensidad).toBeGreaterThanOrEqual(0);
        expect(r.intensidad).toBeLessThanOrEqual(1);
        expect(Math.abs(r.intensidad - antes)).toBeLessThan(0.05); // sin tirones
        if (r.intensidad > 0 && antes === 0) rafagas++;
        if (r.intensidad > 0) {
          soplando++;
          sentidos.add(r.sentido);
          expect(r.fuerza).toBeGreaterThanOrEqual(fuerza[0]);
          expect(r.fuerza).toBeLessThanOrEqual(fuerza[1]);
        }
        antes = r.intensidad;
        total++;
      }
      expect(rafagas).toBe(1);
    }
    expect(soplando / total).toBeCloseTo(duracion / periodo, 1);
    expect(sentidos).toEqual(new Set([1, -1]));
    // La misma semilla, las mismas ráfagas.
    expect(rafagaEn(generarLadera(5), 123.4)).toEqual(rafagaEn(l, 123.4));
  });

  it('solo al aire libre, y de lado (a lo largo de la cara)', () => {
    const t = buscarRafaga();
    const fuera = aMundo(l, dCara(520) - 1, 3);
    const v = viento(l, fuera.x, 520, fuera.z, t);
    expect(Math.hypot(v.x, v.z)).toBeGreaterThan(0.5);
    // Nada hacia la montaña ni hacia fuera: todo de lado.
    const n = { x: Math.cos(l.angulo), z: Math.sin(l.angulo) };
    expect(v.x * n.x + v.z * n.z).toBeCloseTo(0, 9);
    // Dentro del pozo, en el pasillo o a ras de la explanada, nada.
    expect(viento(l, 3, 300, 2, t)).toEqual({ x: 0, z: 0 });
    const pasillo = aMundo(l, RADIO_COLINA - 4, 0);
    expect(alAireLibre(l, pasillo.x, BASE_LADERA + 1, pasillo.z)).toBe(false);
    const explanada = aMundo(l, RADIO_COLINA + 5, 0);
    expect(viento(l, explanada.x, BASE_LADERA, explanada.z, t)).toEqual({ x: 0, z: 0 });
  });

  it('se sabe cuándo empieza cada ráfaga (para que suene una vez)', () => {
    let empiezan = 0;
    for (let t = PASO; t < AIRE.rafaga.periodo * 10; t += PASO) if (empiezaRafaga(l, t, PASO)) empiezan++;
    expect(empiezan).toBe(10);
  });

  it('en el aire lleva al escalador de lado; de pie no se nota', () => {
    const C = CONFIG.escalador;
    const plano: Suelo = (_x, _z, techo) => (techo >= 0 ? 0 : -Infinity);
    const quieto: Ordenes = { moverX: 0, moverY: 0, saltar: false, giroCamara: 0 };
    const aire = { x: 3, z: 0 };
    const dePie = crearEscalador(0, 0, 0);
    for (let i = 0; i < 60; i++) pasoEscalador(dePie, quieto, plano, PASO, undefined, aire);
    expect(dePie.x).toBe(0);
    const saltando = crearEscalador(0, 0, 0);
    pasoEscalador(saltando, { ...quieto, saltar: true }, plano, PASO, undefined, aire);
    for (let i = 0; i < 30; i++) pasoEscalador(saltando, quieto, plano, PASO, undefined, aire);
    expect(saltando.enSuelo).toBe(false);
    expect(saltando.x).toBeGreaterThan(1);
    // Empujando en contra se aguanta (corre más que lo que sopla).
    const contra = crearEscalador(0, 0, 0);
    pasoEscalador(contra, { ...quieto, saltar: true, moverX: -1 }, plano, PASO, undefined, aire);
    for (let i = 0; i < 30; i++) pasoEscalador(contra, { ...quieto, moverX: -1 }, plano, PASO, undefined, aire);
    expect(contra.x).toBeLessThan(0);
    expect(C.velocidad).toBeGreaterThan(AIRE.rafaga.fuerza[1]);
  });
});

/** Un momento en plena ráfaga. */
function buscarRafaga(): number {
  for (let t = 0; t < 100; t += 0.1) if (rafagaEn(l, t).intensidad > 0.8) return t;
  throw new Error('sin ráfagas');
}

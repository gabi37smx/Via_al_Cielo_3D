import { describe, expect, it } from 'vitest';
import {
  REGLAS,
  crearPartida,
  generarFragmentos,
  generarMurcielagos,
  pasoPartida,
  posicionMurcielago,
  type Murcielago,
  type Peligros,
  type Situacion,
} from './partida.ts';
import { generarTramo } from './torre.ts';

const PASO = 1 / 60;
const NADA: Peligros = { fragmentos: [], murcielagos: [] };
const lejos: Situacion = { x: 15, y: 0, z: 0, aterrizaje: 0 };
/** Situación con el centro del cuerpo justo en el punto dado. */
const en = (x: number, y: number, z: number, aterrizaje = 0): Situacion => ({ x, y: y - REGLAS.centroCuerpo, z, aterrizaje });
/** Un murciélago quieto en (5, 10, 0). */
const quieto: Murcielago = { id: 1, y: 10, radio: 5, fase: 0, velocidad: 0, vaiven: 0 };

describe('fragmentos', () => {
  it('hay 3 por tramo, uno en cada tercio, y salen igual con la misma semilla', () => {
    const t = generarTramo(42, 0);
    const f = generarFragmentos(42, t);
    expect(f).toHaveLength(3);
    expect(generarFragmentos(42, t)).toEqual(f);
    f.forEach((x, i) => {
      expect(x.y).toBeGreaterThan(t.base + (220 * i) / 3);
      expect(x.y).toBeLessThan(t.base + (220 * (i + 1)) / 3 + 2);
    });
  });

  it('cada fragmento flota sobre un saliente (se puede alcanzar)', () => {
    for (let semilla = 1; semilla < 30; semilla++) {
      const t = generarTramo(semilla, 0);
      for (const f of generarFragmentos(semilla, t)) {
        const debajo = t.salientes.some((s) => Math.abs(s.y + 1.2 - f.y) < 1e-9);
        expect(debajo).toBe(true);
      }
    }
  });

  it('se coge al pasar cerca y solo una vez', () => {
    const p = crearPartida();
    const f = { id: 0, x: 4, y: 20, z: 0 };
    const mundo = { fragmentos: [f], murcielagos: [] };
    expect(pasoPartida(p, en(4, 20.5, 0), mundo, PASO)).toEqual([{ tipo: 'fragmento', id: 0, enTramo: 1 }]);
    expect(pasoPartida(p, en(4, 20.5, 0), mundo, PASO)).toEqual([]);
  });

  it('los 3 de un tramo dan +25 de vida (sin pasar de 100), una sola vez', () => {
    const p = crearPartida();
    p.vida = 60;
    const fragmentos = [0, 1, 2].map((id) => ({ id, x: 4, y: 10 + id * 50, z: 0 }));
    const mundo = { fragmentos, murcielagos: [] };
    let jugadas = fragmentos.flatMap((f) => pasoPartida(p, en(f.x, f.y, f.z), mundo, PASO));
    expect(jugadas).toContainEqual({ tipo: 'vidaExtra', cantidad: 25 });
    expect(p.vida).toBe(85);

    const llena = crearPartida();
    llena.vida = 90;
    jugadas = fragmentos.flatMap((f) => pasoPartida(llena, en(f.x, f.y, f.z), mundo, PASO));
    expect(jugadas).toContainEqual({ tipo: 'vidaExtra', cantidad: 10 });
    expect(llena.vida).toBe(100);
  });
});

describe('caídas', () => {
  it('caer más de 90 m quita 30 de vida', () => {
    const p = crearPartida();
    expect(pasoPartida(p, { ...lejos, aterrizaje: 95 }, NADA, PASO)).toEqual([{ tipo: 'caida', metros: 95, danio: 30 }]);
    expect(p.vida).toBe(70);
  });

  it('caer 90 m justos o menos no hace daño', () => {
    const p = crearPartida();
    expect(pasoPartida(p, { ...lejos, aterrizaje: 90 }, NADA, PASO)).toEqual([]);
    expect(p.vida).toBe(100);
  });
});

describe('murciélagos', () => {
  it('salen igual con la misma semilla, repartidos a lo alto del tramo', () => {
    const t = generarTramo(7, 0);
    const m = generarMurcielagos(7, t, 12);
    expect(generarMurcielagos(7, t, 12)).toEqual(m);
    const alturas = m.map((x) => x.y).sort((a, b) => a - b);
    expect(alturas[0]!).toBeGreaterThan(t.base + 10);
    expect(alturas.at(-1)!).toBeLessThan(t.rellano - 5);
    // Ninguna franja de 40 m se queda con más de la mitad.
    for (let y = 0; y < 220; y += 40) {
      expect(alturas.filter((a) => a >= y && a < y + 40).length).toBeLessThanOrEqual(6);
    }
  });

  it('dan vueltas a la torre sin meterse en la columna', () => {
    const m = generarMurcielagos(3, generarTramo(3, 0), 12)[0]!;
    for (let t = 0; t < 20; t += 0.5) {
      const p = posicionMurcielago(m, t);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(m.radio, 9);
    }
  });

  it('un golpe quita 10 y deja 1,5 s invulnerable', () => {
    const p = crearPartida();
    const mundo = { fragmentos: [], murcielagos: [quieto] };
    expect(pasoPartida(p, en(5, 10, 0), mundo, PASO)).toEqual([{ tipo: 'golpe', danio: 10, animal: 'murcielago' }]);
    expect(p.vida).toBe(90);
    // Durante 1,5 s no vuelve a golpear aunque siga encima.
    for (let i = 0; i < 89; i++) expect(pasoPartida(p, en(5, 10, 0), mundo, PASO)).toEqual([]);
    expect(pasoPartida(p, en(5, 10, 0), mundo, PASO)).toEqual([{ tipo: 'golpe', danio: 10, animal: 'murcielago' }]);
    expect(p.vida).toBe(80);
  });

  it('lejos no golpea', () => {
    const p = crearPartida();
    expect(pasoPartida(p, en(5, 12, 0), { fragmentos: [], murcielagos: [quieto] }, PASO)).toEqual([]);
  });
});

describe('fin de partida', () => {
  it('con vida 0 se acaba y ya no pasa nada más', () => {
    const p = crearPartida();
    p.vida = 10;
    const mundo = { fragmentos: [], murcielagos: [quieto] };
    expect(pasoPartida(p, en(5, 10, 0), mundo, PASO)).toEqual([{ tipo: 'golpe', danio: 10, animal: 'murcielago' }, { tipo: 'fin' }]);
    expect(p.terminada).toBe(true);
    expect(pasoPartida(p, en(5, 10, 0), mundo, PASO)).toEqual([]);
  });

  it('la vida nunca baja de 0', () => {
    const p = crearPartida();
    p.vida = 20;
    pasoPartida(p, { ...lejos, aterrizaje: 200 }, NADA, PASO);
    expect(p.vida).toBe(0);
  });

  it('guarda la altura máxima alcanzada', () => {
    const p = crearPartida();
    pasoPartida(p, { ...lejos, y: 50 }, NADA, PASO);
    pasoPartida(p, { ...lejos, y: 20 }, NADA, PASO);
    expect(p.alturaMaxima).toBe(50);
  });
});

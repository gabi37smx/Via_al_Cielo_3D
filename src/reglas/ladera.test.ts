import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config.ts';
import {
  ALTO_COLINA,
  ANCHO_CIMA,
  ANCHO_ZIGZAG,
  BASE_LADERA,
  CIMA,
  D_CARA,
  RADIO_COLINA,
  TUNEL,
  aLocal,
  aMundo,
  alturaSueloLadera,
  dCara,
  generarLadera,
  acortarFuera,
  limiteMundo,
  limitePozo,
  salidaLadera,
  sobreSalienteLadera,
} from './ladera.ts';
import { RADIO_PARED, TIPOS } from './torre.ts';

const SEMILLAS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);
const R = CONFIG.escalador.radio;

describe('generarLadera', () => {
  it('es reproducible: misma semilla → misma ladera (y mismo pasillo)', () => {
    expect(generarLadera(42)).toEqual(generarLadera(42));
    expect(generarLadera(42).angulo).not.toBe(generarLadera(43).angulo);
  });

  it('sube de 440 a 660 m, cada saliente lo que dice su tipo, y el último hueco hasta la cima mide 2-3 m', () => {
    for (const s of SEMILLAS) {
      const l = generarLadera(s);
      expect(l.base).toBe(BASE_LADERA);
      expect(l.rellano).toBe(CIMA);
      let y = l.base;
      for (const x of l.salientes) {
        const sube = x.y - y;
        expect(sube).toBeGreaterThanOrEqual(Math.min(TIPOS[x.tipo].subida[0], TIPOS.normal.subida[0]) - 1e-9);
        // En los últimos 8 m todos suben como uno normal (para repartir el final).
        expect(sube).toBeLessThanOrEqual(Math.max(TIPOS[x.tipo].subida[1], TIPOS.normal.subida[1]) + 1e-9);
        y = x.y;
      }
      const ultimo = CIMA - y;
      expect(ultimo).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(ultimo).toBeLessThanOrEqual(3 + 1e-9);
    }
  });

  it('va en zigzag: cambia de sentido varias veces, siempre tras un descansillo, y no se sale de la cima', () => {
    for (const s of SEMILLAS) {
      const l = generarLadera(s);
      let giros = 0;
      for (let i = 2; i < l.salientes.length; i++) {
        const [a, b, c] = [l.salientes[i - 2]!, l.salientes[i - 1]!, l.salientes[i]!];
        if (Math.sign(b.u - a.u) !== Math.sign(c.u - b.u) && Math.abs(c.u - b.u) > 0.5 && Math.abs(b.u - a.u) > 0.5) {
          giros++;
          expect(b.tipo).toBe('descansillo');
        }
      }
      expect(giros).toBeGreaterThanOrEqual(4);
      for (const x of l.salientes) expect(Math.abs(x.u) + x.ancho / 2).toBeLessThanOrEqual(ANCHO_CIMA / 2);
      expect(Math.max(...l.salientes.map((x) => Math.abs(x.u)))).toBeGreaterThan(ANCHO_ZIGZAG - 3);
    }
  });
});

describe('dónde se pisa en la ladera', () => {
  const l = generarLadera(7);

  it('el pasillo y la explanada están a 440 m; dentro de la colina, fuera del pasillo, no hay suelo', () => {
    const pasillo = aMundo(l, (RADIO_PARED + RADIO_COLINA) / 2, 0);
    expect(alturaSueloLadera(l, pasillo.x, pasillo.z, 441)).toBe(BASE_LADERA);
    const explanada = aMundo(l, D_CARA - 3, 10);
    expect(alturaSueloLadera(l, explanada.x, explanada.z, 441)).toBe(BASE_LADERA);
    const roca = aMundo(l, (RADIO_PARED + RADIO_COLINA) / 2, TUNEL.ancho);
    expect(alturaSueloLadera(l, roca.x, roca.z, 441)).toBe(-Infinity);
  });

  it('encima de un saliente, su altura (de un sentido: desde abajo no cuenta)', () => {
    const s = l.salientes[5]!;
    const p = aMundo(l, dCara(s.y) - s.fondo / 2, s.u);
    expect(sobreSalienteLadera(s, dCara(s.y) - s.fondo / 2, s.u)).toBe(true);
    expect(alturaSueloLadera(l, p.x, p.z, s.y + 0.01)).toBe(s.y);
    expect(alturaSueloLadera(l, p.x, p.z, s.y - 0.5)).toBeLessThan(s.y);
  });

  it('la cima ocupa todo el ancho, desde el borde de la cara', () => {
    for (const u of [-ANCHO_CIMA / 2 + 1, 0, ANCHO_CIMA / 2 - 1]) {
      const p = aMundo(l, dCara(CIMA) - 1, u);
      expect(alturaSueloLadera(l, p.x, p.z, CIMA + 1)).toBe(CIMA);
    }
  });

  it('se empieza en la explanada, delante del pasillo', () => {
    const p = salidaLadera(l);
    expect(alturaSueloLadera(l, p.x, p.z, BASE_LADERA + 0.01)).toBe(BASE_LADERA);
  });
});

describe('por dónde no se pasa (límite del mundo)', () => {
  const l = generarLadera(11);
  const limite = limiteMundo(l);
  const prueba = (d: number, u: number, y: number) => {
    const p = aMundo(l, d, u);
    const choque = limite(p, y);
    return { ...aLocal(l, p.x, p.z), r: Math.hypot(p.x, p.z), choque };
  };

  it('por debajo de la ladera es el pozo de siempre (igual que limitePozo)', () => {
    for (const [d, u] of [[15, 0], [11.9, 0.5], [3, 2]] as const) {
      const a = aMundo(l, d, u);
      const b = { ...a };
      limite(a, 300);
      limitePozo(b, 300);
      expect(a.x).toBeCloseTo(b.x);
      expect(a.z).toBeCloseTo(b.z);
    }
  });

  it('a 440 m se sale por el pasillo, que no deja salirse de lado', () => {
    const dentro = prueba(16, 0.5, BASE_LADERA);
    expect(dentro.choque).toBeNull();
    const contraLaPared = prueba(16, TUNEL.ancho / 2 + 0.2, BASE_LADERA);
    expect(Math.abs(contraLaPared.u)).toBeCloseTo(TUNEL.ancho / 2 - R);
    // Saltando dentro del pasillo tampoco vuelve de golpe al pozo.
    const saltando = prueba(18, 0, BASE_LADERA + 5);
    expect(saltando.d).toBeCloseTo(18);
  });

  it('en la roca de la colina fuera del pasillo, a lo más cercano: el pozo o la explanada', () => {
    expect(prueba(13, 6, BASE_LADERA).r).toBeCloseTo(RADIO_PARED - R);
    expect(prueba(21, 6, BASE_LADERA).r).toBeCloseTo(RADIO_COLINA + R);
  });

  it('no se entra en la cara de la montaña: se queda delante, a cualquier altura', () => {
    for (const y of [BASE_LADERA, 500, 600, CIMA - 1]) {
      const p = prueba(dCara(y) + 3, 4, y);
      expect(p.d).toBeCloseTo(dCara(y) - R);
      expect(p.choque).not.toBeNull();
    }
  });

  it('por encima de la colina se puede pasar por encima del pozo', () => {
    expect(prueba(15, 6, ALTO_COLINA + 1).choque).toBeNull();
  });
});

describe('la cámara fuera no se mete en la roca', () => {
  const l = generarLadera(13);
  const punto = (d: number, u: number, y: number) => ({ ...aMundo(l, d, u), y });

  it('si queda delante de la cara, entera; si entraría en la cara, se acorta justo hasta ella', () => {
    expect(acortarFuera(l, punto(30, 0, 441), punto(26, 0, 442))).toBe(1);
    const y = 520;
    const t = acortarFuera(l, punto(dCara(y) - 2, 0, y), punto(dCara(y) + 5, 0, y));
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
    const d = dCara(y) - 2 + t * 7;
    expect(d).toBeCloseTo(dCara(y) - 0.4);
  });

  it('no entra en la colina, salvo por el pasillo', () => {
    const t = acortarFuera(l, punto(26, 10, 441), punto(18, 10, 442));
    expect(t).toBeLessThan(1);
    expect(acortarFuera(l, punto(26, 0, 441), punto(18, 0, 442))).toBe(1);
  });
});


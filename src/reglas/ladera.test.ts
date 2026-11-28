import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config.ts';
import {
  ALTO_COLINA,
  ANCHO_CIMA,
  ANCHO_ZIGZAG,
  BASE_LADERA,
  CIMA,
  CRAMPONES,
  D_CARA,
  FONDO_CIMA,
  FONDO_MAX,
  INCLINACION_HIELO,
  PENDIENTE,
  PICO,
  RADIO_COLINA,
  TUNEL,
  aLocal,
  aMundo,
  alturaBorde,
  alturaEnSaliente,
  alturaSueloLadera,
  centroPico,
  conCrampones,
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

  it('cada saliente sale lo que se ha alejado la cara: un salto de lado desde la pared del de abajo cae encima', () => {
    for (const s of SEMILLAS) {
      const l = generarLadera(s);
      for (let i = 1; i < l.salientes.length; i++) {
        const [a, b] = [l.salientes[i - 1]!, l.salientes[i]!];
        expect(b.fondo).toBeLessThanOrEqual(FONDO_MAX + 1e-9);
        // Su borde de fuera queda al menos 1,4 m por delante de la pared del de abajo.
        expect(dCara(b.y) - b.fondo).toBeLessThanOrEqual(dCara(a.y) - 1.4);
        expect(b.fondo).toBeGreaterThanOrEqual(Math.min(1.4 + (b.y - a.y) * PENDIENTE, FONDO_MAX) - 1e-9);
      }
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
    const mitad = dCara(s.y) - s.fondo / 2;
    const p = aMundo(l, mitad, s.u);
    const h = s.y + (s.fondo / 2) * INCLINACION_HIELO;
    expect(sobreSalienteLadera(s, mitad, s.u)).toBe(true);
    expect(alturaSueloLadera(l, p.x, p.z, h + 0.01)).toBeCloseTo(h);
    expect(alturaSueloLadera(l, p.x, p.z, h - 0.5)).toBeLessThan(s.y);
  });

  it('es una cuña de hielo: lo más bajo junto a la pared y sube hacia el borde de fuera', () => {
    const s = l.salientes[8]!;
    const cara = dCara(s.y);
    expect(alturaEnSaliente(s, cara)).toBeCloseTo(s.y);
    expect(alturaEnSaliente(s, cara - s.fondo)).toBeCloseTo(alturaBorde(s));
    expect(alturaBorde(s) - s.y).toBeCloseTo(s.fondo * INCLINACION_HIELO);
    // Cuesta suave (≈ 7°): menos de medio metro de punta a punta.
    expect(alturaBorde(s) - s.y).toBeLessThan(0.55);
    // Hacia la pared, cada vez más bajo.
    const alturas = [0.9, 0.6, 0.3, 0.05].map((f) => alturaEnSaliente(s, cara - s.fondo * f));
    for (let i = 1; i < alturas.length; i++) expect(alturas[i]!).toBeLessThan(alturas[i - 1]!);
  });

  it('la cima ocupa todo el ancho, desde un borde que apenas sobresale de la cara hacia dentro', () => {
    for (const u of [-ANCHO_CIMA / 2 + 1, 0, ANCHO_CIMA / 2 - 1, 80]) {
      for (const d of [dCara(CIMA) - FONDO_CIMA + 0.05, dCara(CIMA) + 6, dCara(CIMA) + PICO.atras - 1]) {
        const p = aMundo(l, d, u);
        expect(alturaSueloLadera(l, p.x, p.z, CIMA + 1)).toBe(CIMA);
      }
    }
    // Un metro por delante del borde ya no hay cima (se ve el borde y se cae).
    const fuera = aMundo(l, dCara(CIMA) - FONDO_CIMA - 1, 0);
    expect(alturaSueloLadera(l, fuera.x, fuera.z, CIMA + 1)).toBeLessThan(CIMA);
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

  it('en la cima no hay cara delante: se anda hacia dentro hasta el pie del pico, que no deja pasar', () => {
    expect(prueba(dCara(CIMA) + 8, 3, CIMA).choque).toBeNull();
    const contraElPico = prueba(dCara(CIMA) + PICO.atras + 5, 0, CIMA);
    expect(contraElPico.choque).not.toBeNull();
    expect(contraElPico.d).toBeCloseTo(dCara(CIMA) + PICO.atras - R);
    const c = centroPico(l);
    const p = aMundo(l, dCara(CIMA) + PICO.atras + 2, 10);
    limite(p, CIMA);
    expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeCloseTo(PICO.radio + R);
  });
});

describe('los crampones', () => {
  const l = generarLadera(17);
  const en = (d: number, u: number, y: number, antes = false) => {
    const p = aMundo(l, d, u);
    return conCrampones(l, p.x, y, p.z, antes);
  };

  it('se ponen al pasar por delante del soporte del pasillo, antes de salir a la nieve', () => {
    expect(en(CRAMPONES.d - 1, 0, BASE_LADERA)).toBe(false);
    expect(en(CRAMPONES.d + 0.1, 0, BASE_LADERA)).toBe(true);
    expect(CRAMPONES.d).toBeLessThan(RADIO_COLINA);
    expect(CRAMPONES.d).toBeGreaterThan(RADIO_PARED);
  });

  it('fuera, en la ladera y en la cima, siempre puestos (también si se empieza allí)', () => {
    const s = salidaLadera(l);
    expect(conCrampones(l, s.x, BASE_LADERA, s.z, false)).toBe(true);
    expect(en(dCara(500) - 1, 3, 500)).toBe(true);
    expect(en(dCara(CIMA) + 3, 0, CIMA)).toBe(true);
  });

  it('entre el pozo y el soporte se quedan como estaban; en el pozo, fuera', () => {
    expect(en(CRAMPONES.d - 2, 0, BASE_LADERA, true)).toBe(true);
    expect(en(CRAMPONES.d - 2, 0, BASE_LADERA, false)).toBe(false);
    expect(en(5, 0, BASE_LADERA, true)).toBe(false);
    expect(en(11, 0, 300, true)).toBe(false);
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


import { describe, expect, it } from 'vitest';
import {
  BASE_PALAU,
  CIMA_PALAU,
  ELIPSOIDE_CASCARAS,
  MIRADOR,
  PALAU,
  PHI_DELANTE,
  SUELO_PALAU,
  Z_MIRADOR,
  alturaSueloPalau,
  enCostadoPalau,
  fueraDelPalau,
  generarFragmentosPalau,
  generarPalau,
  sobreZocalo,
  zCara,
  zInterior,
} from './palau.ts';
import { METROS_POR_TRAMO, TIPOS } from './torre.ts';

const palaus = [1, 2, 3, 42, 777, 123456, 9, 31337].map(generarPalau);
const libre = (x: number, z: number, y: number) => fueraDelPalau({ x, z }, y) === null;
/** El punto de en medio de lo que se pisa de un saliente (marco de Valencia). */
const medio = (s: (typeof palaus)[number]['salientes'][number]) => ({ x: s.u, z: zInterior(s) - s.fondo / 2 });

describe('el Palau', () => {
  it('mide un tramo: del suelo (660 m) a lo alto de las cáscaras (880 m)', () => {
    expect(PALAU.alto).toBe(METROS_POR_TRAMO);
    expect(SUELO_PALAU).toBe(660);
    expect(CIMA_PALAU).toBe(880);
  });

  it('la cáscara: a plomo abajo, se mete al subir y arriba llega a 0 en el medio', () => {
    const x = PALAU.x;
    expect(zCara(x, 0)).toBeCloseTo(PALAU.cascaras.rz, 0);
    expect(zCara(x, 100)).toBeGreaterThan(zCara(x, 180));
    expect(zCara(x, PALAU.alto)).toBeCloseTo(0, 6);
    // Lejos del medio no llega tan alto.
    expect(zCara(x - 150, 200)).toBe(0);
  });
});

describe('la subida', () => {
  it('sale siempre igual con la misma semilla', () => {
    expect(generarPalau(42)).toEqual(generarPalau(42));
    expect(generarPalau(42)).not.toEqual(generarPalau(43));
  });

  it('tiene entre 70 y 120 salientes, de abajo arriba', () => {
    for (const p of palaus) {
      expect(p.salientes.length).toBeGreaterThan(70);
      expect(p.salientes.length).toBeLessThan(120);
      for (let i = 1; i < p.salientes.length; i++) expect(p.salientes[i]!.y).toBeGreaterThan(p.salientes[i - 1]!.y);
    }
  });

  it('el primero se alcanza desde el zócalo: 1-3 m por encima y con el zócalo debajo de parte de él', () => {
    for (const p of palaus) {
      const s = p.salientes[0]!;
      expect(s.y - BASE_PALAU).toBeGreaterThanOrEqual(1);
      expect(s.y - BASE_PALAU).toBeLessThanOrEqual(3);
      expect(sobreZocalo(s.u, zInterior(s) - 0.5)).toBe(true);
    }
  });

  it('de un saliente al siguiente se llega: sube como mucho lo de un saliente alto y quedan cerca', () => {
    for (const p of palaus) {
      for (let i = 1; i < p.salientes.length; i++) {
        const a = p.salientes[i - 1]!;
        const b = p.salientes[i]!;
        expect(b.y - a.y).toBeLessThanOrEqual(TIPOS.alto.subida[1] + 1e-9);
        // Hueco de lado entre bordes, como mucho el de un saliente bajo.
        const hueco = Math.abs(b.u - a.u) - (a.ancho + b.ancho) / 2;
        expect(hueco).toBeLessThanOrEqual(TIPOS.bajo.hueco[1] + 1e-9);
        // Lo que se pisa de uno y otro se solapa hacia fuera (un salto de lado cae encima).
        const solape = Math.min(zInterior(a), zInterior(b)) - Math.max(zInterior(a) - a.fondo, zInterior(b) - b.fondo);
        expect(solape, `semilla, saliente ${i}`).toBeGreaterThan(0.5);
      }
    }
  });

  it('cada saliente sale de la cáscara (donde la hay) y se puede estar encima', () => {
    for (const p of palaus) {
      for (const s of p.salientes) {
        const h = s.y - SUELO_PALAU;
        expect(zCara(s.u, h)).toBeGreaterThan(0);
        // Por detrás del corte de delante (ahí las cáscaras están abiertas).
        const corte = PALAU.x - Math.cos(PHI_DELANTE) * ELIPSOIDE_CASCARAS.rx * Math.sqrt(1 - ((h - PALAU.centroY) / ELIPSOIDE_CASCARAS.ry) ** 2);
        expect(s.u - s.ancho / 2).toBeGreaterThan(corte);
        const m = medio(s);
        expect(libre(m.x, m.z, s.y)).toBe(true);
        expect(alturaSueloPalau(p, m.x, m.z, s.y + 0.01)).toBe(s.y);
      }
    }
  });

  it('el zigzag va en diagonal hacia el medio del edificio (donde la cáscara llega arriba)', () => {
    for (const p of palaus) {
      const primero = p.salientes[0]!;
      const ultimo = p.salientes[p.salientes.length - 1]!;
      expect(primero.u).toBeLessThan(PALAU.x - 100);
      expect(Math.abs(ultimo.u - PALAU.x)).toBeLessThan(20);
    }
  });

  it('el último queda 2-3 m por debajo del mirador y debajo de su borde', () => {
    for (const p of palaus) {
      const s = p.salientes[p.salientes.length - 1]!;
      expect(CIMA_PALAU - s.y).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(CIMA_PALAU - s.y).toBeLessThanOrEqual(3 + 1e-9);
      expect(Math.abs(s.u - PALAU.x) + s.ancho / 2).toBeLessThan(MIRADOR.largo / 2);
      // Desde su borde de dentro, el mirador está a menos de un metro (o encima).
      expect(Math.abs(zInterior(s)) - Z_MIRADOR).toBeLessThan(1);
    }
  });
});

describe('dónde se pisa y por dónde no se pasa', () => {
  const p = palaus[0]!;

  it('el zócalo se pisa (1,2 m) todo alrededor, también delante del Palau', () => {
    expect(alturaSueloPalau(p, PALAU.x, -(PALAU.cascaras.rz + 2), 700)).toBeCloseTo(SUELO_PALAU + PALAU.zocalo.alto, 6);
    expect(alturaSueloPalau(p, PALAU.x - PALAU.casco.rx - 2, 0, 700)).toBeCloseTo(SUELO_PALAU + PALAU.zocalo.alto, 6);
    // Desde debajo no se pisa (es de un sentido, como todo).
    expect(alturaSueloPalau(p, PALAU.x, -(PALAU.cascaras.rz + 2), SUELO_PALAU + 0.5)).toBe(-Infinity);
    // Fuera del zócalo, nada del Palau.
    expect(alturaSueloPalau(p, PALAU.x, -(PALAU.cascaras.rz + 10), 700)).toBe(-Infinity);
  });

  it('el mirador se pisa a 880 m', () => {
    expect(alturaSueloPalau(p, PALAU.x, 0, 900)).toBe(CIMA_PALAU);
    expect(alturaSueloPalau(p, PALAU.x, -Z_MIRADOR + 0.2, 900)).toBe(CIMA_PALAU);
  });

  it('no se entra en la cáscara a ninguna altura: el límite saca por fuera', () => {
    for (const h of [5, 60, 120, 180, 210]) {
      const dentro = { x: PALAU.x, z: -(zCara(PALAU.x, h) - 1) };
      const n = fueraDelPalau(dentro, SUELO_PALAU + h);
      expect(n, `a ${h} m`).not.toBeNull();
      expect(-dentro.z).toBeGreaterThanOrEqual(zCara(PALAU.x, h) - 1e-6);
      // La normal apunta hacia la cáscara (+z, desde el lado de −z).
      expect(n!.nz).toBeGreaterThan(0.5);
    }
  });

  it('en el mirador: barandilla por +z y en las puntas; por el lado de la subida (−z), abierto', () => {
    const y = CIMA_PALAU;
    const lado = { x: PALAU.x, z: Z_MIRADOR + 0.5 };
    expect(fueraDelPalau(lado, y)).toEqual({ nx: 0, nz: 1 });
    const punta = { x: PALAU.x + MIRADOR.largo / 2 + 0.5, z: 0 };
    expect(fueraDelPalau(punta, y)).toEqual({ nx: 1, nz: 0 });
    expect(libre(PALAU.x, -Z_MIRADOR - 0.5, y)).toBe(true);
    expect(libre(PALAU.x, 0, y)).toBe(true);
  });

  it('por delante de las cáscaras (abiertas) solo choca el casco', () => {
    expect(libre(PALAU.cascaras.desde - 8, -(PALAU.casco.rz + 6), SUELO_PALAU)).toBe(true);
    expect(libre(PALAU.x, -(PALAU.casco.rz + 6), SUELO_PALAU)).toBe(false);
  });
});

describe('la cámara', () => {
  it('junto al costado de la subida (y subiendo) mira a la cáscara; delante del Palau o al otro lado, no', () => {
    const p = palaus[0]!;
    const s = p.salientes[0]!;
    expect(enCostadoPalau(s.u, zInterior(s) - 9)).toBe(true);
    for (const x of p.salientes) expect(enCostadoPalau(x.u, zInterior(x) - x.fondo / 2)).toBe(true);
    expect(enCostadoPalau(-10, 0)).toBe(false); // la plaza, delante del morro
    expect(enCostadoPalau(PALAU.x, PALAU.cascaras.rz + 10)).toBe(false); // el otro costado
  });
});

describe('fragmentos', () => {
  it('tres, uno por tercio, encima de un saliente (ids 30-32)', () => {
    for (const p of palaus) {
      const f = generarFragmentosPalau(7, p, 3);
      expect(f.map((x) => x.id)).toEqual([30, 31, 32]);
      for (const x of f) {
        const debajo = alturaSueloPalau(p, x.x, x.z, x.y);
        expect(x.y - debajo).toBeCloseTo(1.2, 6);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { generarLadera, limiteMundo, RADIO_MUNDO } from './ladera.ts';
import {
  AVIONETA_VALENCIA,
  BORDES_VALENCIA,
  CENTRO_VALENCIA,
  ESTANQUES,
  HEMISFERIC,
  MUSEU,
  PALAU,
  PIE_PALAU,
  PISTA_VALENCIA,
  SENYERA,
  SUELO_VALENCIA,
  aLocalValencia,
  aMundoValencia,
  alturaSueloValencia,
  enValencia,
  fueraDeElipse,
  fueraDeRectangulo,
  libreEnValencia,
  limiteValencia,
  llegadaValencia,
} from './valencia.ts';

const mundo = (x: number, z: number) => aMundoValencia(x, z);

describe('Valencia', () => {
  it('está lejos de la montaña (no se ven) y no se pisa la una desde la otra', () => {
    expect(Math.hypot(CENTRO_VALENCIA.x, CENTRO_VALENCIA.z)).toBeGreaterThan(RADIO_MUNDO * 10);
    expect(enValencia(0, 0)).toBe(false);
    expect(enValencia(CENTRO_VALENCIA.x, CENTRO_VALENCIA.z)).toBe(true);
    expect(alturaSueloValencia(0, 0, 1000)).toBe(-Infinity);
  });

  it('el suelo es plano, a la altura de la cima (el contador no salta)', () => {
    const p = mundo(-200, 30);
    expect(alturaSueloValencia(p.x, p.z, SUELO_VALENCIA + 5)).toBe(SUELO_VALENCIA);
    expect(alturaSueloValencia(p.x, p.z, SUELO_VALENCIA - 0.1)).toBe(-Infinity);
    expect(SUELO_VALENCIA).toBe(660);
  });

  it('el marco va y vuelve', () => {
    const p = aMundoValencia(12, -7);
    expect(aLocalValencia(p.x, p.z)).toEqual({ x: 12, z: -7 });
  });

  it('no se entra en los estanques, el Museu, la avioneta ni el Palau', () => {
    const centros = [
      ...ESTANQUES.map((r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 })),
      { x: (MUSEU.x0 + MUSEU.x1) / 2, z: (MUSEU.z0 + MUSEU.z1) / 2 },
      { x: (AVIONETA_VALENCIA.x0 + AVIONETA_VALENCIA.x1) / 2, z: 0 },
      { x: PALAU.x, z: PALAU.z },
      { x: PALAU.x - PALAU.casco.rx + 2, z: 0 },
      { x: PALAU.x, z: PALAU.cascaras.rz - 2 },
    ];
    for (const c of centros) {
      const p = mundo(c.x, c.z);
      expect(libreEnValencia(p.x, p.z)).toBe(false);
      // Y el límite le saca a un sitio libre.
      limiteValencia(p, SUELO_VALENCIA);
      expect(libreEnValencia(p.x, p.z)).toBe(true);
    }
  });

  it('delante de las cáscaras (abiertas) se puede pasar junto al casco; detrás, no', () => {
    const z = PALAU.casco.rz + 6; // fuera del casco, dentro de la elipse de las cáscaras
    const delante = mundo(PALAU.cascaras.desde - 8, z);
    expect(libreEnValencia(delante.x, delante.z)).toBe(true);
    const detras = mundo(PALAU.x, z);
    expect(libreEnValencia(detras.x, detras.z)).toBe(false);
  });

  it('del jardín no se sale', () => {
    const p = mundo(BORDES_VALENCIA.x0 - 30, 0);
    const n = limiteValencia(p, SUELO_VALENCIA);
    expect(n).toEqual({ nx: -1, nz: 0 });
    expect(aLocalValencia(p.x, p.z).x).toBeCloseTo(BORDES_VALENCIA.x0, 6);
  });

  it('la normal del choque apunta hacia el obstáculo (para quitar esa velocidad)', () => {
    // Entrando en el estanque de la derecha desde el paseo (z pequeña): el obstáculo queda hacia +z.
    const r = ESTANQUES[1]!;
    const p = { x: (r.x0 + r.x1) / 2, z: r.z0 + 0.1 };
    expect(fueraDeRectangulo(p, r)).toEqual({ nx: 0, nz: 1 });
    // Contra el frente del Palau (desde −X): hacia +X.
    const q = { x: PALAU.x - PALAU.casco.rx, z: 0 };
    const n = fueraDeElipse(q, { x: PALAU.x, z: PALAU.z, ...PALAU.casco })!;
    expect(n.nx).toBeCloseTo(1, 6);
    expect(q.x).toBeLessThan(PALAU.x - PALAU.casco.rx);
  });

  it('de la avioneta al pie del Palau se va andando en línea recta por el paseo', () => {
    const s = llegadaValencia();
    const desde = aLocalValencia(s.x, s.z);
    const hasta = PIE_PALAU;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const p = mundo(desde.x + (hasta.x - desde.x) * t, desde.z + (hasta.z - desde.z) * t);
      expect(libreEnValencia(p.x, p.z), `bloqueado en t=${t}`).toBe(true);
    }
    // Un paseo corto: menos de 120 m.
    expect(Math.hypot(hasta.x - desde.x, hasta.z - desde.z)).toBeLessThan(120);
  });

  it('las cosas están en su sitio: la pista libre, el Hemisfèric en su estanque y la senyera en la plaza', () => {
    // La pista no pasa por ningún obstáculo antes de donde se para la avioneta.
    for (let x = PISTA_VALENCIA.desde; x < AVIONETA_VALENCIA.x0 - 1; x += 2) {
      for (const z of [-PISTA_VALENCIA.ancho / 2, 0, PISTA_VALENCIA.ancho / 2]) {
        const p = mundo(x, z);
        expect(libreEnValencia(p.x, p.z), `pista bloqueada en x=${x}`).toBe(true);
      }
    }
    const e = ESTANQUES[0]!;
    expect(HEMISFERIC.x - HEMISFERIC.largo / 2).toBeGreaterThan(e.x0);
    expect(HEMISFERIC.x + HEMISFERIC.largo / 2).toBeLessThan(e.x1);
    expect(HEMISFERIC.z - HEMISFERIC.ancho / 2).toBeGreaterThan(e.z0);
    expect(HEMISFERIC.z + HEMISFERIC.ancho / 2).toBeLessThan(e.z1);
    const s = mundo(SENYERA.x, SENYERA.z);
    expect(libreEnValencia(s.x, s.z)).toBe(true);
  });

  it('el límite de la montaña no lo estorba: Valencia tiene el suyo', () => {
    // (main.ts usa limiteValencia en Valencia y limiteMundo en la montaña.)
    const l = generarLadera(1);
    const p = mundo(-140, 30);
    const antes = { ...p };
    limiteMundo(l)(p, SUELO_VALENCIA);
    expect(p).not.toEqual(antes); // la montaña lo devolvería a su explanada
    const q = { ...antes };
    expect(limiteValencia(q, SUELO_VALENCIA)).toBeNull();
    expect(q).toEqual(antes);
  });
});

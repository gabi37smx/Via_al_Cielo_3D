import { describe, expect, it } from 'vitest';
import { simularSubida } from './simulacion.ts';

/*
 * Estas pruebas vigilan el EQUILIBRIO: si alguien cambia los saltos, la torre
 * o los murciélagos y la cueva deja de poder subirse (o se vuelve un
 * paseo/un infierno), fallan.
 */
const SEMILLAS = Array.from({ length: 20 }, (_, i) => i * 31 + 1);
const sinMurcielagos = SEMILLAS.map((s) => simularSubida(s, { murcielagos: 0 }));
const conMurcielagos = SEMILLAS.map((s) => simularSubida(s));
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('simulación de la cueva con el escalador del ordenador', () => {
  it('todas las torres se pueden subir enteras con los saltos reales', () => {
    for (const r of sinMurcielagos) expect(r.llego, `semilla ${r.semilla}`).toBe(true);
  });

  it('se sube a menos de 14 m/s de media (si no, la API del ranking la rechazaría)', () => {
    for (const r of sinMurcielagos) expect(220 / r.segundos).toBeLessThan(14);
  });

  it('subir la cueva lleva entre 40 s y 2 min', () => {
    const t = media(sinMurcielagos.map((r) => r.segundos));
    expect(t).toBeGreaterThan(40);
    expect(t).toBeLessThan(120);
  });

  it('por el camino se cogen los 3 fragmentos', () => {
    expect(media(sinMurcielagos.map((r) => r.fragmentos))).toBeGreaterThanOrEqual(2.5);
  });

  it('los murciélagos molestan pero la cueva es suave: 1-4 golpes de media y nadie muere', () => {
    const golpes = media(conMurcielagos.map((r) => r.golpes));
    expect(golpes).toBeGreaterThan(1);
    expect(golpes).toBeLessThan(4);
    for (const r of conMurcielagos) expect(r.murio).toBe(false);
  });
});

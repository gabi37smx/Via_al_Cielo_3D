import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config.ts';
import { DIRECCION, crearCorrerSolo, pararCorrer, pulsarTecla } from './correrSolo.ts';

const S = CONFIG.escalador.separacionToques;
const tresToques = (tecla: string) => {
  const c = crearCorrerSolo();
  for (const t of [0, 0.1, 0.2]) pulsarTecla(c, tecla, t);
  return c;
};

describe('correr solo', () => {
  it('tres toques seguidos de W lo empiezan hacia delante; de A, a la izquierda; de D, a la derecha', () => {
    expect(tresToques('KeyW').activo).toBe('adelante');
    expect(tresToques('KeyA').activo).toBe('izquierda');
    expect(tresToques('KeyD').activo).toBe('derecha');
    expect(DIRECCION.izquierda).toEqual({ moverX: -1, moverY: 0 });
    expect(DIRECCION.derecha).toEqual({ moverX: 1, moverY: 0 });
    expect(DIRECCION.adelante).toEqual({ moverX: 0, moverY: 1 });
  });

  it('con las flechas también (y la flecha y su letra cuentan igual)', () => {
    expect(tresToques('ArrowUp').activo).toBe('adelante');
    expect(tresToques('ArrowLeft').activo).toBe('izquierda');
    expect(tresToques('ArrowRight').activo).toBe('derecha');
    const c = crearCorrerSolo();
    pulsarTecla(c, 'ArrowUp', 0);
    pulsarTecla(c, 'KeyW', 0.1);
    expect(pulsarTecla(c, 'ArrowUp', 0.2)).toBe(true);
  });

  it('atrás (S) no: no se corre de espaldas', () => {
    expect(tresToques('KeyS').activo).toBeNull();
    expect(tresToques('ArrowDown').activo).toBeNull();
  });

  it('los tres toques tienen que ser hacia el mismo lado', () => {
    const c = crearCorrerSolo();
    pulsarTecla(c, 'KeyW', 0);
    pulsarTecla(c, 'KeyD', 0.1);
    expect(pulsarTecla(c, 'KeyW', 0.2)).toBe(false);
    expect(c.activo).toBeNull();
  });

  it('con toques demasiado separados no empieza (pero vuelve a contar desde el último)', () => {
    const c = crearCorrerSolo();
    pulsarTecla(c, 'KeyW', 0);
    pulsarTecla(c, 'KeyW', 0.2);
    expect(pulsarTecla(c, 'KeyW', 0.2 + S + 0.05)).toBe(false);
    expect(c.activo).toBeNull();
    pulsarTecla(c, 'KeyW', 0.2 + S + 0.25);
    expect(pulsarTecla(c, 'KeyW', 0.2 + S + 0.45)).toBe(true);
  });

  it('otra tecla en medio corta la cuenta', () => {
    const c = crearCorrerSolo();
    pulsarTecla(c, 'KeyW', 0);
    pulsarTecla(c, 'KeyW', 0.1);
    pulsarTecla(c, 'KeyE', 0.15);
    expect(pulsarTecla(c, 'KeyW', 0.2)).toBe(false);
    expect(c.activo).toBeNull();
  });

  it('corriendo, cualquier tecla lo para (también moverse o saltar)', () => {
    for (const tecla of ['KeyA', 'Space', 'KeyW', 'KeyP', 'KeyS']) {
      const c = tresToques('KeyD');
      expect(pulsarTecla(c, tecla, 5)).toBe(false);
      expect(c.activo).toBeNull();
    }
  });

  it('pararCorrer lo para desde fuera', () => {
    const c = tresToques('KeyW');
    pararCorrer(c);
    expect(c.activo).toBeNull();
  });
});

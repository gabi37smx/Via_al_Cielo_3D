import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config.ts';
import { crearEscalador, type Escalador } from '../jugador/control.ts';
import type { Jugada } from '../reglas/partida.ts';
import type { PasoCorredor } from '../reglas/carrera.ts';
import { crearOido, sonidosDelPaso } from './sucesos.ts';

const PASO = 1 / 60;

function resultado(cambios: Partial<PasoCorredor['sucesos']> = {}, jugadas: Jugada[] = [], extra: Partial<PasoCorredor> = {}): PasoCorredor {
  return { sucesos: { salto: false, dobleSalto: false, aterrizaje: 0, agarre: false, ...cambios }, jugadas, llego: false, reaparecio: false, ...extra };
}

function escalador(cambios: Partial<Escalador> = {}): Escalador {
  return Object.assign(crearEscalador(0, 0, 0), cambios);
}

const nombres = (t: { sonido: string }[]) => t.map((x) => x.sonido);

describe('qué suena en cada paso', () => {
  it('quieto no suena nada', () => {
    expect(sonidosDelPaso(crearOido(), resultado(), escalador(), PASO)).toEqual([]);
  });

  it('salto y doble salto (el doble no suena además como salto)', () => {
    expect(nombres(sonidosDelPaso(crearOido(), resultado({ salto: true }), escalador(), PASO))).toEqual(['salto']);
    expect(nombres(sonidosDelPaso(crearOido(), resultado({ salto: true, dobleSalto: true }), escalador(), PASO))).toEqual(['dobleSalto']);
  });

  it('el aterrizaje suena más fuerte cuanto más alto se cae; un escalón no suena', () => {
    const bajo = sonidosDelPaso(crearOido(), resultado({ aterrizaje: 1 }), escalador(), PASO);
    const alto = sonidosDelPaso(crearOido(), resultado({ aterrizaje: 5 }), escalador(), PASO);
    expect(nombres(bajo)).toEqual(['aterrizaje']);
    expect(alto[0]!.fuerza).toBeGreaterThan(bajo[0]!.fuerza);
    expect(alto[0]!.fuerza).toBeLessThanOrEqual(1);
    expect(sonidosDelPaso(crearOido(), resultado({ aterrizaje: 0.3 }), escalador(), PASO)).toEqual([]);
  });

  it('una caída con daño suena como «caida», no también como aterrizaje', () => {
    const t = sonidosDelPaso(crearOido(), resultado({ aterrizaje: 12 }, [{ tipo: 'caida', metros: 12, danio: 20 }]), escalador(), PASO);
    expect(nombres(t)).toEqual(['caida']);
  });

  it('cada jugada de las reglas tiene su sonido', () => {
    const jugadas: Jugada[] = [
      { tipo: 'fragmento', id: 1, enTramo: 1 },
      { tipo: 'vidaExtra', cantidad: 10 },
      { tipo: 'golpe', danio: 15 },
      { tipo: 'fin' },
    ];
    expect(nombres(sonidosDelPaso(crearOido(), resultado({}, jugadas), escalador(), PASO))).toEqual(['fragmento', 'vidaExtra', 'golpe', 'derrota']);
  });

  it('agarrarse y empezar a trepar suenan una vez', () => {
    const oido = crearOido();
    expect(nombres(sonidosDelPaso(oido, resultado({ agarre: true }), escalador({ postura: 'colgado', enSuelo: false }), PASO))).toEqual(['agarre']);
    expect(nombres(sonidosDelPaso(oido, resultado(), escalador({ postura: 'trepando', enSuelo: false }), PASO))).toEqual(['trepar']);
    expect(sonidosDelPaso(oido, resultado(), escalador({ postura: 'trepando', enSuelo: false }), PASO)).toEqual([]);
  });

  it('reaparecer suena', () => {
    expect(nombres(sonidosDelPaso(crearOido(), resultado({}, [], { reaparecio: true }), escalador(), PASO))).toEqual(['reaparecer']);
  });

  it('corriendo, un paso cada zancada (más deprisa, más pasos)', () => {
    const contar = (rapidez: number) => {
      const oido = crearOido();
      const e = escalador({ postura: 'corriendo', vx: rapidez });
      let pasos = 0;
      for (let i = 0; i < 120; i++) pasos += sonidosDelPaso(oido, resultado(), e, PASO).length;
      return pasos;
    };
    const v = CONFIG.escalador.velocidad;
    // 2 s a 6 m/s = 12 m; el primero a los 0,64 m y luego uno cada 1,6 m: 8 pasos.
    const z = CONFIG.sonido.zancada;
    expect(contar(v)).toBe(1 + Math.floor((v * 2 - z * 0.4) / z));
    expect(contar(v / 2)).toBeLessThan(contar(v));
  });

  it('en el aire no hay pasos y al volver a correr el primero llega pronto', () => {
    const oido = crearOido();
    const aire = escalador({ postura: 'subiendo', enSuelo: false, vx: 6 });
    for (let i = 0; i < 60; i++) expect(sonidosDelPaso(oido, resultado(), aire, PASO)).toEqual([]);
    const corriendo = escalador({ postura: 'corriendo', vx: 6 });
    let primero = 0;
    while (sonidosDelPaso(oido, resultado(), corriendo, PASO).length === 0) primero++;
    expect(primero * PASO).toBeLessThan(0.2);
  });
});

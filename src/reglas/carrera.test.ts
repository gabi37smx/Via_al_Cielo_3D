import { describe, expect, it } from 'vitest';
import { PASO } from '../nucleo/bucle.ts';
import {
  CARRERA,
  carreraAcabada,
  clasificar,
  crearCarrera,
  crearCorredor,
  empezarCuentaAtras,
  formatearTiempo,
  haLlegado,
  pasoCarrera,
  pasoCorredor,
  puntoDeControl,
  sePuedeMover,
  sitioDeReaparicion,
  type Participante,
  type SucesoCarrera,
} from './carrera.ts';
import { generarTramo, alturaSuelo } from './torre.ts';

const tramo = generarTramo(7, 0);
const suelo = (x: number, z: number, techo: number) => alturaSuelo(tramo, x, z, techo);
const SIN_PELIGROS = { fragmentos: [], murcielagos: [] };
const QUIETO = { moverX: 0, moverY: 0, saltar: false, giroCamara: 0 };

describe('cuenta atrás y salida', () => {
  it('espera quieto, cuenta 3-2-1 en 3 s y da la salida a la vez para todos', () => {
    const c = crearCarrera();
    expect(c.fase).toBe('esperando');
    expect(sePuedeMover(c)).toBe(false);

    const sucesos: SucesoCarrera[] = [...empezarCuentaAtras(c, 1)];
    let pasos = 0;
    while (c.fase === 'cuentaAtras') {
      expect(sePuedeMover(c)).toBe(false);
      sucesos.push(...pasoCarrera(c, PASO));
      pasos++;
    }
    expect(sucesos).toEqual([
      { tipo: 'numero', numero: 3 },
      { tipo: 'numero', numero: 2 },
      { tipo: 'numero', numero: 1 },
      { tipo: 'salida' },
    ]);
    expect(pasos).toBe(CARRERA.cuentaAtras * 60);
    expect(c.fase).toBe('enCurso');
    expect(sePuedeMover(c)).toBe(true);
  });

  it('el reloj de carrera cuenta desde la salida, paso a paso', () => {
    const c = crearCarrera();
    empezarCuentaAtras(c, 1);
    while (c.fase === 'cuentaAtras') pasoCarrera(c, PASO);
    for (let i = 0; i < 600; i++) pasoCarrera(c, PASO);
    expect(c.tiempo).toBeCloseTo(10, 6);
  });
});

describe('puntos de control y reaparición', () => {
  it('hay un punto de control cada 55 m (y el último antes de la meta)', () => {
    expect(puntoDeControl(0, tramo)).toBe(0);
    expect(puntoDeControl(54.9, tramo)).toBe(0);
    expect(puntoDeControl(55, tramo)).toBe(55);
    expect(puntoDeControl(130, tramo)).toBe(110);
    expect(puntoDeControl(219, tramo)).toBe(165);
  });

  it('antes del primer control se reaparece en la salida; después, en un saliente justo por debajo del control', () => {
    const salida = sitioDeReaparicion(tramo, 20, 2);
    expect(salida.y).toBe(0);
    const sitio = sitioDeReaparicion(tramo, 120, 0);
    expect(sitio.y).toBeLessThanOrEqual(110);
    expect(sitio.y).toBeGreaterThan(110 - 5);
    // Se puede estar de pie ahí.
    expect(suelo(sitio.x, sitio.z, sitio.y + 0.01)).toBe(sitio.y);
  });

  it('con la vida a 0 no se acaba: a los 3 s reaparece en el punto de control con la vida llena', () => {
    const c = crearCorredor(tramo, 0);
    // Ya pasó el control de 55 m, le queda poca vida y cae 100 m al suelo (−30).
    c.partida.alturaMaxima = 70;
    c.partida.vida = 10;
    Object.assign(c.escalador, { x: 0, y: 100, z: 0, enSuelo: false, alturaMaxima: 100 });
    let pasos = 0;
    let reaparecio = false;
    let caido = false;
    for (; pasos < 1000 && !reaparecio; pasos++) {
      const r = pasoCorredor(c, QUIETO, tramo, suelo, SIN_PELIGROS, 0, PASO);
      if (r.jugadas.some((j) => j.tipo === 'fin')) {
        caido = true;
        pasos = 0; // desde aquí se cuentan los 3 s
      }
      reaparecio = r.reaparecio;
    }
    expect(caido).toBe(true);
    expect(reaparecio).toBe(true);
    expect(pasos * PASO).toBeCloseTo(CARRERA.reaparicion, 1);
    expect(c.partida.vida).toBe(100);
    expect(c.partida.terminada).toBe(false);
    expect(c.escalador.y).toBeGreaterThan(45);
    expect(c.escalador.y).toBeLessThanOrEqual(55);
  });

  it('llega a la meta al ponerse de pie en el rellano, y apunta su tiempo una sola vez', () => {
    const c = crearCorredor(tramo, 0);
    c.escalador.x = 11;
    c.escalador.z = 0;
    c.escalador.y = tramo.rellano + 0.5;
    c.escalador.enSuelo = false;
    let llegadas = 0;
    for (let i = 0; i < 60; i++) if (pasoCorredor(c, QUIETO, tramo, suelo, SIN_PELIGROS, 80 + i * PASO, PASO).llego) llegadas++;
    expect(llegadas).toBe(1);
    expect(haLlegado(c.escalador, tramo)).toBe(true);
    expect(c.llegada).toBeGreaterThan(80);
    expect(c.llegada).toBeLessThan(81);
  });
});

describe('clasificación', () => {
  const p = (id: string, persona = true): Participante => ({ id, nombre: id, persona });
  const todos = [p('ana'), p('beto'), p('roca', false), p('carla')];

  it('primero los que llegan, por tiempo; detrás los demás, por altura', () => {
    const filas = clasificar(todos, [{ id: 'beto', tiempo: 95, orden: 0 }, { id: 'roca', tiempo: 90, orden: 1 }], new Map([['ana', 150], ['carla', 180]]));
    expect(filas.map((f) => f.id)).toEqual(['roca', 'beto', 'carla', 'ana']);
    expect(filas.map((f) => f.puesto)).toEqual([1, 2, 3, 4]);
    expect(filas[2]!.tiempo).toBeNull();
  });

  it('empate exacto: gana quien se supo antes (lo decide el anfitrión)', () => {
    const filas = clasificar(todos, [{ id: 'carla', tiempo: 90, orden: 5 }, { id: 'ana', tiempo: 90, orden: 2 }], new Map());
    expect(filas[0]!.id).toBe('ana');
  });

  it('se acaba cuando llegan todas las personas que siguen en la sala', () => {
    const presentes = new Set(['ana', 'beto', 'carla']);
    const llegadas = [{ id: 'ana', tiempo: 90, orden: 0 }, { id: 'beto', tiempo: 95, orden: 1 }];
    expect(carreraAcabada(todos, presentes, llegadas, 96)).toBe(false); // falta Carla
    expect(carreraAcabada(todos, new Set(['ana', 'beto']), llegadas, 96)).toBe(true); // Carla se fue
    expect(carreraAcabada(todos, presentes, [...llegadas, { id: 'carla', tiempo: 99, orden: 2 }], 99)).toBe(true);
  });

  it('los del ordenador no hace falta esperarlos, y a los lentos se les espera 90 s desde el primero', () => {
    const presentes = new Set(['ana', 'beto', 'carla']);
    const llegadas = [{ id: 'roca', tiempo: 80, orden: 0 }];
    expect(carreraAcabada(todos, presentes, llegadas, 80 + CARRERA.esperaTrasPrimero - 1)).toBe(false);
    expect(carreraAcabada(todos, presentes, llegadas, 80 + CARRERA.esperaTrasPrimero)).toBe(true);
    expect(carreraAcabada(todos, presentes, [], 500)).toBe(false); // nadie ha llegado aún
  });

  it('el tiempo se enseña como minutos:segundos,décimas', () => {
    expect(formatearTiempo(83.44)).toBe('1:23,4');
    expect(formatearTiempo(5.06)).toBe('0:05,1');
  });
});

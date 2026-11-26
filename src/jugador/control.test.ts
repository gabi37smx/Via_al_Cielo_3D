import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config.ts';
import { PASO } from '../nucleo/bucle.ts';
import { RADIO_COLUMNA, SEPARACION_MAX } from '../reglas/torre.ts';
import { crearEscalador, pasoEscalador, type Escalador, type Ordenes, type Suelo } from './control.ts';

const C = CONFIG.escalador;
const QUIETO: Ordenes = { moverX: 0, moverY: 0, saltar: false, giroCamara: 0 };
/** Suelo plano a 0 m en todo el mundo. */
const PLANO: Suelo = (_x, _z, techo) => (techo >= 0 ? 0 : -Infinity);

/** Lejos de la columna para que no estorbe. */
const nuevo = () => crearEscalador(10, 0, 0);

function pasos(e: Escalador, n: number, o: Ordenes = QUIETO, suelo: Suelo = PLANO) {
  for (let i = 0; i < n; i++) pasoEscalador(e, o, suelo, PASO);
}

/** Salta (y opcionalmente hace doble salto en el punto más alto) y devuelve la altura máxima. */
function alturaDeSalto(doble: boolean): number {
  const e = nuevo();
  pasoEscalador(e, { ...QUIETO, saltar: true }, PLANO, PASO);
  let max = e.y;
  let dobleHecho = false;
  for (let i = 0; i < 300; i++) {
    const saltar = doble && !dobleHecho && e.vy <= 0;
    if (saltar) dobleHecho = true;
    pasoEscalador(e, { ...QUIETO, saltar }, PLANO, PASO);
    max = Math.max(max, e.y);
    if (e.enSuelo) break;
  }
  return max;
}

describe('salto', () => {
  it('el salto normal sube unos 3,5 m: llega a cualquier saliente (están a 2-3 m)', () => {
    const h = alturaDeSalto(false);
    expect(h).toBeGreaterThan(3.3);
    expect(h).toBeLessThan(3.6);
    expect(h).toBeGreaterThan(SEPARACION_MAX + 0.25);
  });

  it('el doble salto añade unos 2 m más', () => {
    const h = alturaDeSalto(true);
    expect(h).toBeGreaterThan(5.2);
    expect(h).toBeLessThan(5.6);
  });

  it('no hay triple salto', () => {
    const e = nuevo();
    pasoEscalador(e, { ...QUIETO, saltar: true }, PLANO, PASO);
    pasos(e, 10);
    pasoEscalador(e, { ...QUIETO, saltar: true }, PLANO, PASO); // doble
    pasos(e, 10);
    const s = pasoEscalador(e, { ...QUIETO, saltar: true }, PLANO, PASO); // triple: nada
    expect(s.salto || s.dobleSalto).toBe(false);
  });

  it('salto guardado: pulsado justo antes de aterrizar, salta al tocar el suelo', () => {
    const e = crearEscalador(10, 0.3, 0);
    e.enSuelo = false;
    e.saltosAereos = 0; // ya gastó el doble salto
    e.vy = -2;
    pasoEscalador(e, { ...QUIETO, saltar: true }, PLANO, PASO); // aún en el aire
    expect(e.enSuelo).toBe(false);
    let salto = false;
    for (let i = 0; i < 10 && !salto; i++) salto = pasoEscalador(e, QUIETO, PLANO, PASO).salto;
    expect(salto).toBe(true);
  });

  it('tiempo coyote: puede saltar justo después de salir de un borde', () => {
    // Suelo solo en x < 10.5: el escalador sale corriendo hacia +x.
    const borde: Suelo = (x, _z, techo) => (x < 10.5 && techo >= 0 ? 0 : -50);
    const e = crearEscalador(10, 0, 0);
    e.vx = C.velocidad;
    const derecha: Ordenes = { ...QUIETO, moverX: 1 };
    let pasosEnElAire = 0;
    while (pasosEnElAire < 3) {
      pasoEscalador(e, derecha, borde, PASO);
      if (!e.enSuelo) pasosEnElAire++;
    }
    const s = pasoEscalador(e, { ...derecha, saltar: true }, borde, PASO);
    expect(s.salto).toBe(true); // salto normal, no el doble
  });
});

describe('suelo y salientes', () => {
  // Un saliente a 2,5 m que ocupa x de 9 a 11 (y el suelo a 0).
  const conSaliente: Suelo = (x, _z, techo) => {
    let s = techo >= 0 ? 0 : -Infinity;
    if (x > 9 && x < 11 && techo >= 2.5) s = 2.5;
    return s;
  };

  it('aterriza sobre el saliente al caer encima', () => {
    const e = crearEscalador(10, 6, 0);
    e.enSuelo = false;
    pasos(e, 120, QUIETO, conSaliente);
    expect(e.enSuelo).toBe(true);
    expect(e.y).toBe(2.5);
  });

  it('lo atraviesa desde abajo al saltar y se queda encima', () => {
    const e = crearEscalador(10, 0, 0);
    pasoEscalador(e, { ...QUIETO, saltar: true }, conSaliente, PASO);
    pasos(e, 120, QUIETO, conSaliente);
    expect(e.y).toBe(2.5);
  });

  it('avisa de cuántos metros ha caído al aterrizar', () => {
    const e = crearEscalador(10, 20, 0);
    e.enSuelo = false;
    let caida = 0;
    for (let i = 0; i < 200 && !caida; i++) caida = pasoEscalador(e, QUIETO, PLANO, PASO).aterrizaje;
    expect(caida).toBeCloseTo(20, 0);
  });

  it('cayendo muy rápido no atraviesa el saliente', () => {
    const e = crearEscalador(10, 3, 0);
    e.enSuelo = false;
    e.vy = -C.velocidadMaxCaida;
    pasos(e, 5, QUIETO, conSaliente);
    expect(e.y).toBe(2.5);
  });
});

describe('carrera', () => {
  it('en diagonal corre igual de rápido que en recto', () => {
    const recto = nuevo();
    const diagonal = nuevo();
    pasos(recto, 60, { ...QUIETO, moverY: 1 });
    pasos(diagonal, 60, { ...QUIETO, moverX: 1, moverY: 1 });
    expect(Math.hypot(diagonal.vx, diagonal.vz)).toBeCloseTo(Math.hypot(recto.vx, recto.vz), 5);
    expect(Math.hypot(recto.vx, recto.vz)).toBeCloseTo(C.velocidad, 5);
  });

  it('al soltar frena en un instante, pero no en seco', () => {
    const e = nuevo();
    pasos(e, 60, { ...QUIETO, moverY: 1 });
    pasos(e, 1);
    expect(Math.hypot(e.vx, e.vz)).toBeGreaterThan(0); // no en seco
    pasos(e, 11);
    expect(Math.hypot(e.vx, e.vz)).toBe(0); // en 0,2 s parado
  });

  it('adelante es hacia donde mira la cámara', () => {
    // Cámara en +x mirando hacia −x: «adelante» tiene que ir hacia −x.
    const e = nuevo();
    pasos(e, 30, { ...QUIETO, moverY: 1, giroCamara: Math.PI / 2 });
    expect(e.vx).toBeLessThan(-5);
    expect(Math.abs(e.vz)).toBeLessThan(1e-9);
  });

  it('no se mete en la columna: se desliza por su borde', () => {
    const e = crearEscalador(RADIO_COLUMNA + 2, 0, 0);
    pasos(e, 120, { ...QUIETO, moverY: 1, giroCamara: Math.PI / 2 }); // hacia −x, contra la columna
    expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(RADIO_COLUMNA + C.radio - 1e-9);
  });
});

import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config.ts';
import { PASO } from '../nucleo/bucle.ts';
import { RADIO_PARED, SEPARACION_MAX } from '../reglas/torre.ts';
import { crearEscalador, pasoEscalador, type Escalador, type Ordenes, type Suelo } from './control.ts';

const C = CONFIG.escalador;
const QUIETO: Ordenes = { moverX: 0, moverY: 0, saltar: false, giroCamara: 0 };
/** Suelo plano a 0 m en todo el mundo. */
const PLANO: Suelo = (_x, _z, techo) => (techo >= 0 ? 0 : -Infinity);

/** En el centro del pozo, lejos de la pared para que no estorbe. */
const nuevo = () => crearEscalador(0, 0, 0);

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

  it('no se mete en la pared del pozo', () => {
    const e = crearEscalador(RADIO_PARED - 2, 0, 0);
    pasos(e, 120, { ...QUIETO, moverY: 1, giroCamara: -Math.PI / 2 }); // hacia +x, contra la pared
    expect(Math.hypot(e.x, e.z)).toBeLessThanOrEqual(RADIO_PARED - C.radio + 1e-9);
  });

  it('corriendo de lado junto a la pared, se desliza por ella sin pararse', () => {
    const e = crearEscalador(RADIO_PARED - 1, 0, 0);
    // Cámara hacia el centro (giro −π/2 en x > 0) y en diagonal: adelante (contra la pared) y a la derecha.
    pasos(e, 60, { ...QUIETO, moverY: 1, moverX: 1, giroCamara: -Math.PI / 2 });
    expect(Math.hypot(e.x, e.z)).toBeLessThanOrEqual(RADIO_PARED - C.radio + 1e-9);
    expect(Math.hypot(e.vx, e.vz)).toBeGreaterThan(2);
  });
});

describe('agarrarse al borde y trepar (idea I3)', () => {
  /** Un saliente demasiado alto para el salto (4,5 m) que empieza en x = 1 y sigue hacia +x. */
  const ALTO = 4.5;
  const CORNISA: Suelo = (x, _z, techo) => (x >= 1 && techo >= ALTO ? ALTO : techo >= 0 ? 0 : -Infinity);

  /** Junto al borde, de cara al saliente, salta en vertical y espera a que pase algo. */
  function saltarJuntoAlBorde(x = 0.6): Escalador {
    const e = crearEscalador(x, 0, 0);
    e.orientacion = Math.PI / 2; // mirando hacia +x
    pasoEscalador(e, { ...QUIETO, saltar: true }, CORNISA, PASO);
    for (let i = 0; i < 120 && !e.agarre && !e.enSuelo; i++) pasoEscalador(e, QUIETO, CORNISA, PASO);
    return e;
  }

  it('si el saliente queda a la altura de las manos al caer, se agarra y se queda colgado', () => {
    const e = saltarJuntoAlBorde();
    expect(e.postura).toBe('colgado');
    expect(e.y).toBeCloseTo(ALTO - C.alturaManos, 9);
    expect(e.x).toBeCloseTo(1 - C.radio, 9); // el cuerpo justo delante del borde
    // Sin tocar nada, sigue colgado.
    pasos(e, 120, QUIETO, CORNISA);
    expect(e.postura).toBe('colgado');
    expect(e.y).toBeCloseTo(ALTO - C.alturaManos, 9);
  });

  it('con salto, trepa en el tiempo de trepar y acaba de pie encima', () => {
    const e = saltarJuntoAlBorde();
    pasoEscalador(e, { ...QUIETO, saltar: true }, CORNISA, PASO);
    expect(e.postura).toBe('trepando');
    pasos(e, Math.ceil(C.trepar / PASO) + 1, QUIETO, CORNISA);
    expect(e.enSuelo).toBe(true);
    expect(e.y).toBe(ALTO);
    expect(e.x).toBeGreaterThan(1); // encima del saliente, no en el aire
    expect(e.postura).toBe('quieto');
  });

  it('empujando hacia el saliente también trepa', () => {
    const e = saltarJuntoAlBorde();
    pasos(e, Math.ceil(C.trepar / PASO) + 2, { ...QUIETO, moverX: 1 }, CORNISA); // derecha = +x
    expect(e.enSuelo).toBe(true);
    expect(e.y).toBe(ALTO);
  });

  it('empujando hacia atrás se suelta, cae y no se vuelve a agarrar enseguida', () => {
    const e = saltarJuntoAlBorde();
    pasoEscalador(e, { ...QUIETO, moverX: -1 }, CORNISA, PASO);
    expect(e.agarre).toBeNull();
    expect(e.postura).toBe('cayendo');
    for (let i = 0; i < 120 && !e.enSuelo; i++) pasoEscalador(e, QUIETO, CORNISA, PASO);
    expect(e.enSuelo).toBe(true);
    expect(e.y).toBe(0);
  });

  it('debajo del saliente (no en su borde) no se agarra', () => {
    const e = saltarJuntoAlBorde(2);
    expect(e.agarre).toBeNull();
    expect(e.enSuelo).toBe(true);
    expect(e.y).toBe(0);
  });

  it('cayendo muy rápido no se agarra: no salva una caída larga', () => {
    const e = crearEscalador(0.6, 25, 0);
    e.orientacion = Math.PI / 2;
    e.enSuelo = false;
    for (let i = 0; i < 200 && !e.enSuelo; i++) pasoEscalador(e, QUIETO, CORNISA, PASO);
    expect(e.y).toBe(0);
  });

  it('al agarrarse se corta la caída: luego no cuenta como caída larga', () => {
    const e = saltarJuntoAlBorde();
    expect(e.alturaMaxima).toBeCloseTo(e.y, 9);
  });
});

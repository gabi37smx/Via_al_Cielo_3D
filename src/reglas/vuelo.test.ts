import { describe, expect, it } from 'vitest';
import { CIMA, PICO, aLocal, aMundo, centroPico, dCara, generarLadera } from './ladera.ts';
import { AERODROMO, AVIONETA, DURACION_VUELO, T_CAMBIO, X_TOMA, avionetaEnCima, dPista, poseVuelo, tocaAvioneta } from './vuelo.ts';
import { PISTA_VALENCIA, SUELO_VALENCIA, aLocalValencia, enValencia, libreEnValencia, llegadaValencia } from './valencia.ts';

const laderas = [1, 2, 3, 42, 777, 123456].map(generarLadera);
const PASO = 1 / 60;

describe('el aeródromo de la cima', () => {
  it('la avioneta está en la cima, entre el borde y el pico, lejos de la bandera', () => {
    for (const l of laderas) {
      const a = avionetaEnCima(l);
      const { d, u } = aLocal(l, a.x, a.z);
      expect(d).toBeGreaterThan(dCara(l.rellano));
      // Las puntas de las alas no llegan al pie del pico.
      const pico = centroPico(l);
      for (const lado of [-1, 1]) {
        const punta = aMundo(l, d + (lado * AVIONETA.envergadura) / 2, u);
        expect(Math.hypot(punta.x - pico.x, punta.z - pico.z)).toBeGreaterThan(PICO.radio + 0.5);
      }
      // La bandera está en u = 0, 4 m por detrás del borde: la cola queda lejos.
      expect(u - AVIONETA.cola).toBeGreaterThan(3);
    }
  });

  it('se sube al tocarla, andando por la cima; no desde lejos, ni desde abajo, ni desde muy arriba', () => {
    for (const l of laderas) {
      const puerta = aMundo(l, dPista(l) - AVIONETA.ancho / 2 - 0.5, AERODROMO.u);
      expect(tocaAvioneta(l, puerta.x, CIMA, puerta.z)).toBe(true);
      expect(tocaAvioneta(l, puerta.x, CIMA + 1.5, puerta.z)).toBe(true); // saltando
      expect(tocaAvioneta(l, puerta.x, CIMA - 3, puerta.z)).toBe(false);
      expect(tocaAvioneta(l, puerta.x, CIMA + 6, puerta.z)).toBe(false);
      const lejos = aMundo(l, dPista(l) - 4, AERODROMO.u);
      expect(tocaAvioneta(l, lejos.x, CIMA, lejos.z)).toBe(false);
      // Al llegar a la cima (junto al borde, delante de la bandera) aún no.
      const borde = aMundo(l, dCara(l.rellano) + 0.5, 0);
      expect(tocaAvioneta(l, borde.x, CIMA, borde.z)).toBe(false);
    }
  });
});

describe('la escena del vuelo', () => {
  it('empieza aparcada en la cima y acaba aparcada en Valencia, al final de la pista', () => {
    for (const l of laderas) {
      const p0 = poseVuelo(l, 0);
      const a = avionetaEnCima(l);
      expect(p0.lugar).toBe('cima');
      expect(p0.x).toBeCloseTo(a.x, 6);
      expect(p0.z).toBeCloseTo(a.z, 6);
      expect(p0.y).toBe(CIMA);
      expect(p0.rumbo).toBeCloseTo(a.rumbo, 6);
      const fin = poseVuelo(l, DURACION_VUELO);
      expect(fin.lugar).toBe('valencia');
      expect(enValencia(fin.x, fin.z)).toBe(true);
      expect(aLocalValencia(fin.x, fin.z).x).toBeCloseTo(PISTA_VALENCIA.parada, 6);
      expect(fin.y).toBe(SUELO_VALENCIA);
      expect(fin.motor).toBe(0);
      expect(fin.puerta).toBeCloseTo(1, 6);
      // Pasado el final se queda igual (saltar la escena = ir al final).
      expect(poseVuelo(l, DURACION_VUELO + 50)).toEqual(fin);
    }
  });

  it('dura unos 15 s', () => {
    expect(DURACION_VUELO).toBeGreaterThan(10);
    expect(DURACION_VUELO).toBeLessThan(17);
  });

  it('va sin saltos: de un paso al siguiente se mueve poco (salvo en el cambio de sitio, tapado de blanco)', () => {
    for (const l of laderas) {
      let antes = poseVuelo(l, 0);
      for (let t = PASO; t <= DURACION_VUELO; t += PASO) {
        const p = poseVuelo(l, t);
        if (p.lugar === antes.lugar) {
          expect(Math.hypot(p.x - antes.x, p.y - antes.y, p.z - antes.z)).toBeLessThan(0.7); // < 42 m/s
          expect(Math.hypot(p.camara.x - antes.camara.x, p.camara.y - antes.camara.y, p.camara.z - antes.camara.z)).toBeLessThan(0.8);
          expect(Math.abs(p.rumbo - antes.rumbo)).toBeLessThan(0.05);
        } else {
          expect(p.blanco).toBeGreaterThan(0.99);
          expect(antes.blanco).toBeGreaterThan(0.99);
        }
        antes = p;
      }
    }
  });

  it('en la cima rueda por la pista sin salirse, despega y no se acerca al pico', () => {
    for (const l of laderas) {
      const pico = centroPico(l);
      for (let t = 0; t < T_CAMBIO; t += PASO) {
        const p = poseVuelo(l, t);
        expect(p.y).toBeGreaterThanOrEqual(CIMA);
        const { u } = aLocal(l, p.x, p.z);
        // En tierra, dentro de la pista.
        if (p.y === CIMA) expect(u).toBeLessThan(AERODROMO.u + AERODROMO.largoPista);
        expect(Math.hypot(p.x - pico.x, p.z - pico.z)).toBeGreaterThan(PICO.radio + AVIONETA.envergadura / 2);
        expect(p.camara.y).toBeGreaterThan(CIMA + 1);
      }
      // Al meterse en las nubes ya va por el aire.
      expect(poseVuelo(l, T_CAMBIO - 0.01).y).toBeGreaterThan(CIMA + 10);
    }
  });

  it('en Valencia baja hacia la pista, toca tierra en la pista y no la pasa', () => {
    const l = laderas[0]!;
    let tocoEn: number | null = null;
    for (let t = T_CAMBIO; t <= DURACION_VUELO; t += PASO) {
      const p = poseVuelo(l, t);
      expect(p.lugar).toBe('valencia');
      expect(p.y).toBeGreaterThanOrEqual(SUELO_VALENCIA);
      expect(p.camara.y).toBeGreaterThan(SUELO_VALENCIA + 1);
      const x = aLocalValencia(p.x, p.z).x;
      expect(x).toBeLessThanOrEqual(PISTA_VALENCIA.parada + 1e-6);
      if (p.y === SUELO_VALENCIA && tocoEn === null) tocoEn = x;
    }
    expect(tocoEn).toBeCloseTo(X_TOMA, 0);
    expect(X_TOMA).toBeGreaterThan(PISTA_VALENCIA.desde + 20);
  });

  it('se sube con la puerta abierta, se cierra al arrancar y se vuelve a abrir al pararse', () => {
    const l = laderas[0]!;
    expect(poseVuelo(l, 0).puerta).toBe(1);
    expect(poseVuelo(l, 1).puerta).toBe(0);
    expect(poseVuelo(l, T_CAMBIO).puerta).toBe(0);
    expect(poseVuelo(l, DURACION_VUELO).puerta).toBeCloseTo(1, 6);
  });

  it('el motor y el blanco van de 0 a 1', () => {
    const l = laderas[0]!;
    for (let t = 0; t <= DURACION_VUELO; t += PASO) {
      const p = poseVuelo(l, t);
      expect(p.motor).toBeGreaterThanOrEqual(0);
      expect(p.motor).toBeLessThanOrEqual(1);
      expect(p.blanco).toBeGreaterThanOrEqual(0);
      expect(p.blanco).toBeLessThanOrEqual(1);
    }
    expect(poseVuelo(l, 0).blanco).toBe(0);
    expect(poseVuelo(l, T_CAMBIO).blanco).toBe(1);
    expect(poseVuelo(l, DURACION_VUELO).blanco).toBe(0);
  });

  it('al bajar se aparece junto a la puerta, en un sitio libre', () => {
    const s = llegadaValencia();
    expect(s.y).toBe(SUELO_VALENCIA);
    expect(libreEnValencia(s.x, s.z)).toBe(true);
  });
});

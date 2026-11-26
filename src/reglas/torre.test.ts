import { describe, expect, it } from 'vitest';
import { crearAzar } from './azar.ts';
import {
  METROS_ENTRE_DESCANSILLOS,
  METROS_POR_TRAMO,
  RADIO_PARED,
  RADIO_RELLANO,
  SUBIDA_MAX,
  SUBIDA_MIN,
  TIPOS,
  alturaSuelo,
  generarTramo,
  huecoEntre,
  posicionSaliente,
  puntoDeSalida,
  type TipoSaliente,
} from './torre.ts';

const SEMILLAS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);
const TRAMOS = [0, 1, 2, 5];
const MARGEN = 1e-9;

describe('azar con semilla', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = crearAzar(42);
    const b = crearAzar(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('siempre devuelve números en [0, 1)', () => {
    const a = crearAzar(7);
    for (let i = 0; i < 10000; i++) {
      const n = a();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('generarTramo', () => {
  it('es reproducible: misma semilla y tramo → misma torre (base de la carrera)', () => {
    expect(generarTramo(1234, 0)).toEqual(generarTramo(1234, 0));
    expect(generarTramo(1234, 3)).toEqual(generarTramo(1234, 3));
  });

  it('semillas distintas dan torres distintas', () => {
    expect(generarTramo(1, 0).salientes).not.toEqual(generarTramo(2, 0).salientes);
  });

  it('cada tramo va de su base a su rellano (220 m)', () => {
    const t = generarTramo(99, 2);
    expect(t.base).toBe(2 * METROS_POR_TRAMO);
    expect(t.rellano).toBe(3 * METROS_POR_TRAMO);
  });

  it('cada saliente sube lo que dice su tipo, y el último hueco hasta el rellano mide 2-3 m', () => {
    for (const s of SEMILLAS) {
      for (const n of TRAMOS) {
        const t = generarTramo(s, n);
        let y = t.base;
        for (const x of t.salientes) {
          const subida = x.y - y;
          expect(subida).toBeGreaterThanOrEqual(SUBIDA_MIN - MARGEN);
          expect(subida).toBeLessThanOrEqual(TIPOS[x.tipo].subida[1] + MARGEN);
          y = x.y;
        }
        const ultimo = t.rellano - y;
        expect(ultimo).toBeGreaterThanOrEqual(2 - MARGEN);
        expect(ultimo).toBeLessThanOrEqual(3 + MARGEN);
      }
    }
    expect(SUBIDA_MAX).toBeLessThanOrEqual(4.2); // doble salto (5,5 m) o salto + trepar (5,2 m)
  });

  it('el hueco entre bordes seguidos es el de su tipo (se puede saltar) y siempre gira hacia el mismo lado', () => {
    for (const s of SEMILLAS) {
      const { salientes } = generarTramo(s, 0);
      for (let i = 1; i < salientes.length; i++) {
        const b = salientes[i]!;
        const hueco = huecoEntre(salientes[i - 1]!, b);
        expect(hueco).toBeGreaterThanOrEqual(TIPOS[b.tipo].hueco[0] - MARGEN);
        expect(hueco).toBeLessThanOrEqual(TIPOS[b.tipo].hueco[1] + MARGEN);
      }
    }
  });

  it('las medidas de cada saliente son las de su tipo', () => {
    for (const s of SEMILLAS) {
      for (const x of generarTramo(s, 0).salientes) {
        const m = TIPOS[x.tipo];
        for (const [valor, [min, max]] of [[x.ancho, m.ancho], [x.fondo, m.fondo], [x.grosor, m.grosor]] as const) {
          expect(valor).toBeGreaterThanOrEqual(min);
          expect(valor).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('hay variedad: salen todos los tipos y la mitad o más son normales', () => {
    const cuenta: Record<TipoSaliente, number> = { normal: 0, bajo: 0, alto: 0, cornisa: 0, descansillo: 0 };
    let total = 0;
    for (const s of SEMILLAS) {
      for (const x of generarTramo(s, 0).salientes) {
        cuenta[x.tipo]++;
        total++;
      }
    }
    for (const n of Object.values(cuenta)) expect(n).toBeGreaterThan(0);
    expect(cuenta.normal / total).toBeGreaterThan(0.5);
  });

  it('nunca hay dos altos seguidos', () => {
    for (const s of SEMILLAS) {
      const { salientes } = generarTramo(s, 0);
      for (let i = 1; i < salientes.length; i++) {
        expect(salientes[i - 1]!.tipo === 'alto' && salientes[i]!.tipo === 'alto').toBe(false);
      }
    }
  });

  it('hay un descansillo cada 40 m más, como mucho, un saliente alto y lo que sube el propio descansillo', () => {
    for (const s of SEMILLAS) {
      const t = generarTramo(s, 0);
      let ultimo = t.base;
      for (const x of t.salientes) {
        if (x.tipo !== 'descansillo') continue;
        expect(x.y - ultimo).toBeLessThanOrEqual(METROS_ENTRE_DESCANSILLOS + SUBIDA_MAX + TIPOS.descansillo.subida[1] + MARGEN);
        ultimo = x.y;
      }
      expect(ultimo).toBeGreaterThan(t.rellano - METROS_ENTRE_DESCANSILLOS - 20);
    }
  });

  it('alturaSuelo: encima de un saliente da su altura; fuera, el suelo', () => {
    const t = generarTramo(5, 0);
    const s = t.salientes[10]!;
    const { x, z } = posicionSaliente(s);
    expect(alturaSuelo(t, x, z, s.y + 1)).toBe(s.y);
    // Por debajo de su cara de arriba no cuenta (se atraviesa desde abajo).
    expect(alturaSuelo(t, x, z, s.y - 0.01)).toBeLessThan(s.y);
    // En el centro del pozo no hay salientes: solo queda el suelo de la cueva.
    expect(alturaSuelo(t, 0, 0, 100)).toBe(0);
  });

  it('los salientes salen de la pared hacia dentro', () => {
    const t = generarTramo(5, 0);
    for (const s of t.salientes) {
      const { x, z } = posicionSaliente(s);
      const r = Math.hypot(x, z);
      expect(r).toBeLessThan(RADIO_PARED);
      expect(r).toBeGreaterThan(RADIO_PARED - 1.6);
      // Pegado a la pared se pisa; más allá de su fondo, ya no.
      expect(alturaSuelo(t, (x / r) * (RADIO_PARED - 0.4), (z / r) * (RADIO_PARED - 0.4), s.y + 0.01)).toBe(s.y);
      const fuera = RADIO_PARED - s.fondo - 0.3;
      expect(alturaSuelo(t, (x / r) * fuera, (z / r) * fuera, s.y + 0.01)).toBeLessThan(s.y);
    }
  });

  it('alturaSuelo: el rellano es una cornisa que da la vuelta entera a la pared', () => {
    const t = generarTramo(5, 0);
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const x = Math.cos(a) * (RADIO_RELLANO + 0.3);
      const z = Math.sin(a) * (RADIO_RELLANO + 0.3);
      expect(alturaSuelo(t, x, z, t.rellano + 1)).toBe(t.rellano);
    }
    // En el hueco del centro no hay rellano.
    expect(alturaSuelo(t, RADIO_RELLANO - 1, 0, t.rellano + 1)).toBeLessThan(t.rellano);
  });

  it('en los tramos de arriba el suelo de salida es la cornisa, no un suelo entero', () => {
    const t = generarTramo(5, 1);
    expect(alturaSuelo(t, RADIO_RELLANO + 0.5, 0, t.base + 0.01)).toBe(t.base);
    expect(alturaSuelo(t, 0, 0, t.base + 0.01)).toBe(-Infinity);
  });

  it('se sale desde el suelo, dentro del pozo y sin pisar ningún saliente', () => {
    for (const s of SEMILLAS) {
      const t = generarTramo(s, 0);
      for (let puesto = 0; puesto < 4; puesto++) {
        const { x, z } = puntoDeSalida(t, puesto);
        expect(Math.hypot(x, z)).toBeLessThan(RADIO_PARED - 1);
        expect(alturaSuelo(t, x, z, 100)).toBe(0);
      }
    }
  });

  it('un tramo tiene entre 73 y 110 salientes: ni un paseo ni eterno', () => {
    for (const s of SEMILLAS) {
      const n = generarTramo(s, 0).salientes.length;
      expect(n).toBeGreaterThanOrEqual(73);
      expect(n).toBeLessThanOrEqual(110);
    }
  });
});

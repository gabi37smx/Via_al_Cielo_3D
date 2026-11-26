import { describe, expect, it } from 'vitest';
import { Interpolador, RETARDO } from './interpolacion.ts';
import {
  MAX_JUGADORES,
  cabeEnSala,
  codificar,
  decodificar,
  elegirAnfitrion,
  generarCodigo,
  leerAspecto,
  limpiarNombre,
  normalizarCodigo,
  type EstadoRed,
  type Miembro,
} from './protocolo.ts';

const miembro = (id: string, unidoEn: number, semilla = 1): Miembro => ({ id, nombre: id, unidoEn, semilla, aspecto: 'escalador' });
const estado = (t: number, x: number, extra: Partial<EstadoRed> = {}): EstadoRed => ({
  t, x, y: 0, z: 0, orientacion: 0, postura: 'corriendo', rapidez: 6, voltereta: 0, ...extra,
});

describe('códigos de sala', () => {
  it('tienen 4 letras y nunca I ni O (se confunden con 1 y 0)', () => {
    for (let i = 0; i < 500; i++) expect(generarCodigo()).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });

  it('se limpia lo que escribe el jugador', () => {
    expect(normalizarCodigo(' ab-cd ')).toBe('ABCD');
    expect(normalizarCodigo('abc')).toBeNull();
    expect(normalizarCodigo('abcde')).toBeNull();
  });

  it('los nombres se recortan y no admiten etiquetas', () => {
    expect(limpiarNombre('  Gabi  ')).toBe('Gabi');
    expect(limpiarNombre('<b>hola</b>')).toBe('bhola/b');
    expect(limpiarNombre('UnNombreMuyMuyLargo')).toHaveLength(12);
    expect(limpiarNombre('   ')).toBe('Escalador');
  });
});

describe('anfitrión', () => {
  it('es el que lleva más tiempo en la sala', () => {
    expect(elegirAnfitrion([miembro('b', 200), miembro('a', 100), miembro('c', 300)])?.id).toBe('a');
  });

  it('si se va, lo hereda el siguiente más antiguo', () => {
    const sala = [miembro('b', 200), miembro('c', 300)];
    expect(elegirAnfitrion(sala)?.id).toBe('b');
  });

  it('si entran a la vez, decide el id (todos eligen el mismo)', () => {
    expect(elegirAnfitrion([miembro('z', 100), miembro('m', 100)])?.id).toBe('m');
  });

  it('solo caben 4: el quinto en llegar no juega', () => {
    const sala = [1, 2, 3, 4, 5].map((n) => miembro(`j${n}`, n * 100));
    expect(MAX_JUGADORES).toBe(4);
    expect(cabeEnSala(sala, 'j4')).toBe(true);
    expect(cabeEnSala(sala, 'j5')).toBe(false);
  });
});

describe('estado por la red', () => {
  it('se codifica y decodifica igual (redondeado a cm)', () => {
    const e = estado(1234, 3.14159, { y: 87.654, z: -2.5, orientacion: 1.23456, postura: 'dobleSalto', voltereta: 0.333 });
    const d = decodificar(codificar(e))!;
    expect(d.postura).toBe('dobleSalto');
    expect(d.x).toBeCloseTo(3.14, 5);
    expect(d.y).toBeCloseTo(87.65, 5);
    expect(d.orientacion).toBeCloseTo(1.235, 5);
  });

  it('un mensaje raro se descarta', () => {
    expect(decodificar('hola')).toBeNull();
    expect(decodificar([1, 2, 3])).toBeNull();
    expect(decodificar([1, 2, 3, 4, 5, 99, 7, 8])).toBeNull(); // postura que no existe
    expect(decodificar([1, 2, NaN, 4, 5, 0, 7, 8])).toBeNull();
  });
});

describe('interpolación', () => {
  /** Rival que corre a 6 m/s enviando 10 estados por segundo, con 40 ms de red. */
  function rival(retrasos: number[] = []) {
    const i = new Interpolador();
    const relojRival = 50_000; // su reloj no tiene nada que ver con el nuestro
    for (let k = 0; k < 20; k++) {
      const t = relojRival + k * 100;
      i.anadir(estado(t, k * 0.6), 1_000 + k * 100 + 40 + (retrasos[k] ?? 0));
    }
    return i;
  }

  it('pinta al rival donde estaba hace RETARDO ms, mezclando los dos estados de alrededor', () => {
    const i = rival();
    // Llegó el estado 10 (x = 6) en el instante 2040: RETARDO ms después debe estar en x = 6.
    expect(i.muestrear(2_040 + RETARDO)!.x).toBeCloseTo(6, 5);
    // 50 ms más tarde, a mitad de camino del siguiente (x = 6,3).
    expect(i.muestrear(2_090 + RETARDO)!.x).toBeCloseTo(6.3, 5);
  });

  it('el movimiento es continuo aunque los mensajes lleguen a trompicones', () => {
    const i = rival([0, 30, 0, 60, 10, 0, 45, 0, 0, 20, 0, 70, 0, 0, 15, 0, 0, 0, 0, 0]);
    let anterior = i.muestrear(1_500)!.x;
    for (let ahora = 1_516; ahora < 2_800; ahora += 16) {
      const x = i.muestrear(ahora)!.x;
      expect(x - anterior).toBeGreaterThanOrEqual(-1e-9); // nunca va hacia atrás
      expect(x - anterior).toBeLessThan(0.2); // ni pega saltos (6 m/s × 16 ms ≈ 0,1 m)
      anterior = x;
    }
  });

  it('si dejan de llegar mensajes, se queda quieto en el último sitio', () => {
    const i = rival();
    const e = i.muestrear(10_000)!;
    expect(e.x).toBeCloseTo(19 * 0.6, 5);
    expect(e.rapidez).toBe(0);
  });

  it('gira por el camino corto (de 179° a −179° son 2°, no 358°)', () => {
    const i = new Interpolador();
    i.anadir(estado(0, 0, { orientacion: Math.PI - 0.01 }), 1000);
    i.anadir(estado(100, 0, { orientacion: -Math.PI + 0.01 }), 1100);
    const medio = i.muestrear(1050 + RETARDO)!.orientacion;
    expect(Math.abs(Math.abs(medio) - Math.PI)).toBeLessThan(0.02);
  });

  it('descarta estados repetidos o que llegan desordenados', () => {
    const i = new Interpolador();
    i.anadir(estado(100, 1), 1000);
    i.anadir(estado(50, 99), 1010);
    i.anadir(estado(100, 99), 1020);
    expect(i.muestrear(5000)!.x).toBe(1);
  });
});

describe('aspecto (escalador o escaladora)', () => {
  it('lee los dos aspectos que existen', () => {
    expect(leerAspecto('escalador')).toBe('escalador');
    expect(leerAspecto('escaladora')).toBe('escaladora');
  });

  it('lo que no vale (versión antigua sin aspecto, URL mal escrita, datos raros) es escalador', () => {
    for (const raro of [undefined, null, '', 'ESCALADORA', 'robot', 3, {}]) expect(leerAspecto(raro)).toBe('escalador');
  });
});

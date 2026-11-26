/*
 * Las reglas de la partida (modo solo). LÓGICA PURA: sin Three.js, sin DOM y
 * sin red. Reciben el estado, dónde está el escalador y el tiempo, y devuelven
 * las JUGADAS que han ocurrido. Lo que se ve y lo que suena reacciona a esas
 * jugadas; las reglas no saben nada de pantallas.
 *
 * Números del Vía al Cielo 2D (v73): vida 100, +25 al coger los 3 fragmentos
 * de un tramo, murciélago −10, caída de más de 90 m −30, invulnerable 1,5 s
 * (90 fotogramas) tras un golpe.
 */
import { crearAzar, derivarSemilla, entre } from './azar.ts';
import { RADIO_PARED, puntoEnAngulo, type Tramo } from './torre.ts';

export const REGLAS = {
  vidaInicial: 100,
  vidaMaxima: 100,
  fragmentosPorTramo: 3,
  vidaPorFragmentos: 25,
  caidaPeligrosa: 90,
  danioCaida: 30,
  danioMurcielago: 10,
  invulnerabilidad: 1.5,
  /**
   * Murciélagos en el tramo de la cueva. El 2D tenía 25, pero la pared del
   * pozo (12 m de radio) da 2,4 veces más vuelta que la columna: con 25 el
   * escalador del ordenador (que no esquiva) recibía 0,7 golpes por subida.
   * Con 40 vuelve a ~2 (200 torres simuladas): un primer tramo suave.
   */
  murcielagosCueva: 40,
  /** Distancia (m) al centro del cuerpo para coger un fragmento. */
  radioRecoger: 1.1,
  /** Distancia (m) entre el murciélago y el centro del cuerpo para que golpee. */
  radioGolpe: 0.8,
  /** Altura del centro del cuerpo sobre los pies (m). */
  centroCuerpo: 0.9,
} as const;

export interface Punto {
  x: number;
  y: number;
  z: number;
}

export interface Fragmento extends Punto {
  id: number;
}

export interface Murcielago {
  id: number;
  /** Altura media de vuelo (m). */
  y: number;
  /** Radio de su vuelta alrededor del pozo (m). */
  radio: number;
  fase: number;
  /** Velocidad angular (rad/s); el signo es el sentido. */
  velocidad: number;
  /** Cuánto sube y baja mientras vuela (m). */
  vaiven: number;
}

/**
 * Un fragmento por cada tercio del tramo, flotando sobre un saliente al azar
 * de ese tercio. Misma semilla → mismos fragmentos (también en la carrera).
 */
export function generarFragmentos(semilla: number, tramo: Tramo): Fragmento[] {
  const azar = crearAzar(derivarSemilla(semilla, 1000 + tramo.indice));
  const n = REGLAS.fragmentosPorTramo;
  const alto = tramo.rellano - tramo.base;
  const fragmentos: Fragmento[] = [];
  for (let i = 0; i < n; i++) {
    const desde = tramo.base + (alto * i) / n;
    const hasta = tramo.base + (alto * (i + 1)) / n;
    const candidatos = tramo.salientes.filter((s) => s.y > desde + 5 && s.y < hasta);
    if (candidatos.length === 0) continue;
    const s = candidatos[Math.floor(azar() * candidatos.length)]!;
    fragmentos.push({
      id: tramo.indice * 10 + i,
      ...puntoEnAngulo(s.angulo, RADIO_PARED - 0.8),
      y: s.y + 1.2,
    });
  }
  return fragmentos;
}

/** Murciélagos dando vueltas al pozo pegados a la pared, repartidos por la altura del tramo. */
export function generarMurcielagos(semilla: number, tramo: Tramo, cantidad: number): Murcielago[] {
  const azar = crearAzar(derivarSemilla(semilla, 2000 + tramo.indice));
  const desde = tramo.base + 12; // el suelo de salida, tranquilo
  const hasta = tramo.rellano - 6;
  return Array.from({ length: cantidad }, (_, i) => {
    // Repartidos a lo alto (una franja cada uno) para que no se amontonen.
    const y = desde + ((hasta - desde) * (i + azar())) / cantidad;
    // Vuelan pegados a la pared, por donde pasa el escalador (que pisa el
    // saliente a ~1 m de la roca). Si pasan lejos casi nunca tocan.
    const radio = entre(azar, RADIO_PARED - 1.6, RADIO_PARED - 0.4);
    const fase = azar() * Math.PI * 2;
    // Se elige la rapidez en m/s y se pasa a vueltas: a 11 m del eje, los
    // rad/s de la columna (a 4 m) les hacían ir al triple.
    const rapidez = entre(azar, 2, 4);
    const sentido = azar() < 0.5 ? -1 : 1;
    return { id: tramo.indice * 100 + i, y, radio, fase, velocidad: (sentido * rapidez) / radio, vaiven: entre(azar, 0.3, 0.9) };
  });
}

export function posicionMurcielago(m: Murcielago, tiempo: number): Punto {
  const a = m.fase + m.velocidad * tiempo;
  return {
    x: Math.cos(a) * m.radio,
    y: m.y + Math.sin(tiempo * 2.1 + m.fase) * m.vaiven,
    z: Math.sin(a) * m.radio,
  };
}

export interface Partida {
  vida: number;
  /** Segundos de invulnerabilidad que quedan tras un golpe. */
  invulnerable: number;
  tiempo: number;
  alturaMaxima: number;
  recogidos: number[];
  /** Tramos en los que ya se dio la vida por los 3 fragmentos. */
  bonusDados: number[];
  golpes: number;
  terminada: boolean;
}

export type Jugada =
  | { tipo: 'fragmento'; id: number; enTramo: number }
  | { tipo: 'vidaExtra'; cantidad: number }
  | { tipo: 'golpe'; danio: number }
  | { tipo: 'caida'; metros: number; danio: number }
  | { tipo: 'fin' };

/** Dónde está el escalador en este paso y si acaba de aterrizar. */
export interface Situacion extends Punto {
  /** Metros que ha caído si acaba de aterrizar; 0 si no. */
  aterrizaje: number;
}

export interface Peligros {
  fragmentos: Fragmento[];
  murcielagos: Murcielago[];
}

export function crearPartida(): Partida {
  return {
    vida: REGLAS.vidaInicial,
    invulnerable: 0,
    tiempo: 0,
    alturaMaxima: 0,
    recogidos: [],
    bonusDados: [],
    golpes: 0,
    terminada: false,
  };
}

const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function danar(p: Partida, danio: number) {
  p.vida = Math.max(p.vida - danio, 0);
}

export function pasoPartida(p: Partida, s: Situacion, mundo: Peligros, paso: number): Jugada[] {
  if (p.terminada) return [];
  const jugadas: Jugada[] = [];
  p.tiempo += paso;
  // 1,5 − 90 × (1/60) no da 0 exacto en coma flotante: lo que sobre de
  // menos de una milésima de paso cuenta como 0 (si no, el golpe 91 no llega).
  p.invulnerable = p.invulnerable - paso < 1e-9 ? 0 : p.invulnerable - paso;
  p.alturaMaxima = Math.max(p.alturaMaxima, s.y);
  const cuerpo = { x: s.x, y: s.y + REGLAS.centroCuerpo, z: s.z };

  // Fragmentos: se cogen al pasar cerca (también saltando).
  for (const f of mundo.fragmentos) {
    if (p.recogidos.includes(f.id) || distancia(cuerpo, f) > REGLAS.radioRecoger) continue;
    p.recogidos.push(f.id);
    const tramo = Math.floor(f.id / 10);
    const enTramo = p.recogidos.filter((id) => Math.floor(id / 10) === tramo).length;
    jugadas.push({ tipo: 'fragmento', id: f.id, enTramo });
    if (enTramo === REGLAS.fragmentosPorTramo && !p.bonusDados.includes(tramo)) {
      p.bonusDados.push(tramo);
      const antes = p.vida;
      p.vida = Math.min(p.vida + REGLAS.vidaPorFragmentos, REGLAS.vidaMaxima);
      jugadas.push({ tipo: 'vidaExtra', cantidad: p.vida - antes });
    }
  }

  // Caída: no depende de la invulnerabilidad.
  if (s.aterrizaje > REGLAS.caidaPeligrosa) {
    danar(p, REGLAS.danioCaida);
    jugadas.push({ tipo: 'caida', metros: s.aterrizaje, danio: REGLAS.danioCaida });
  }

  // Murciélagos: un golpe y 1,5 s de invulnerabilidad.
  if (p.invulnerable === 0) {
    for (const m of mundo.murcielagos) {
      if (Math.abs(m.y - cuerpo.y) > 3) continue; // lejos en altura: ni se calcula
      if (distancia(cuerpo, posicionMurcielago(m, p.tiempo)) <= REGLAS.radioGolpe) {
        danar(p, REGLAS.danioMurcielago);
        p.invulnerable = REGLAS.invulnerabilidad;
        p.golpes++;
        jugadas.push({ tipo: 'golpe', danio: REGLAS.danioMurcielago });
        break;
      }
    }
  }

  if (p.vida <= 0) {
    p.terminada = true;
    jugadas.push({ tipo: 'fin' });
  }
  return jugadas;
}

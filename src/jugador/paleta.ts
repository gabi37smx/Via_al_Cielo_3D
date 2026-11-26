/*
 * Cambiar el color de la ropa de un personaje de Kenney SIN tocar sus
 * archivos. LÓGICA PURA (sin Three.js): solo cuentas con coordenadas.
 *
 * Todos los personajes de Mini Characters comparten una textura de 512 px
 * que es una PALETA: casillas de 32 × 128 px (16 columnas × 4 filas), cada
 * una un degradado de un color. Cada vértice del modelo apunta a un punto de
 * una casilla. Para cambiar un color basta con que los vértices de la ropa
 * apunten al mismo punto de OTRA casilla: la textura y el archivo .glb se
 * quedan como los hizo Kenney y los demás personajes no cambian.
 */

export const COLUMNAS_PALETA = 16;
export const FILAS_PALETA = 4;

export interface Casilla {
  columna: number;
  fila: number;
}

/** Una regla: en estos huesos, lo que use la casilla `de` pasa a usar la casilla `a`. */
export interface CambioColor {
  huesos: readonly string[];
  de: Casilla;
  a: Casilla;
}

/** La casilla de la paleta en la que cae la coordenada de textura (u, v). */
export function casillaDe(u: number, v: number): Casilla {
  const dentro = (x: number, n: number) => Math.min(Math.max(Math.floor(x * n), 0), n - 1);
  return { columna: dentro(u, COLUMNAS_PALETA), fila: dentro(v, FILAS_PALETA) };
}

/**
 * Dónde tiene que apuntar ahora un vértice del hueso `hueso` que apuntaba a
 * (u, v). Si ninguna regla le toca, se queda igual. Se mantiene el mismo
 * punto dentro de la casilla para conservar el degradado (luces y sombras).
 */
export function recolocarEnPaleta(u: number, v: number, hueso: string, cambios: readonly CambioColor[]): [number, number] {
  const c = casillaDe(u, v);
  for (const cambio of cambios) {
    if (!cambio.huesos.includes(hueso) || cambio.de.columna !== c.columna || cambio.de.fila !== c.fila) continue;
    return [u + (cambio.a.columna - c.columna) / COLUMNAS_PALETA, v + (cambio.a.fila - c.fila) / FILAS_PALETA];
  }
  return [u, v];
}

/**
 * La escaladora (`character-female-f`, la única con pelo largo) viste un
 * top gris morado con tirantes amarillos y mangas oscuras. Se le pone ROSA
 * (petición de Gabi, idea I5): top rosa, tirantes rosa claro y mangas
 * magenta. Los pantalones vaqueros, la piel y el pelo no se tocan.
 */
const ARRIBA = ['torso', 'arm-left', 'arm-right'] as const;
export const ROPA_ESCALADORA: readonly CambioColor[] = [
  { huesos: ARRIBA, de: { columna: 3, fila: 3 }, a: { columna: 6, fila: 1 } },
  { huesos: ARRIBA, de: { columna: 1, fila: 3 }, a: { columna: 8, fila: 1 } },
  { huesos: ARRIBA, de: { columna: 7, fila: 3 }, a: { columna: 7, fila: 1 } },
];

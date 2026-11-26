/*
 * Todos los números que se ajustan jugando, en un solo sitio.
 * Unidades: metros, segundos y radianes.
 */
export const CONFIG = {
  escalador: {
    /** Radio de la cápsula (para no meterse en la columna). */
    radio: 0.35,
    /** Velocidad máxima corriendo (m/s). */
    velocidad: 6,
    /** Cuánto gana velocidad al pulsar (m/s²) y cuánto la pierde al soltar. */
    aceleracion: 45,
    frenado: 60,
    /** En el aire se controla menos (fracción de la aceleración). */
    controlAire: 0.55,
    gravedad: 28,
    /** Altura del salto normal (m). Los salientes están a 2-3 m: siempre llega. */
    alturaSalto: 3.5,
    /** Lo que añade el doble salto (m). */
    alturaDobleSalto: 2,
    velocidadMaxCaida: 40,
    /** «Tiempo coyote»: aún se puede saltar justo después de salir de un borde (s). */
    coyote: 0.1,
    /** Un salto pulsado justo antes de aterrizar se guarda y salta al tocar (s). */
    bufferSalto: 0.12,
    /** Velocidad a la que se gira hacia donde va (rad/s). */
    giro: 12,
    /** Duración de la voltereta del doble salto (s). */
    voltereta: 0.45,
  },
  camara: {
    distancia: 7,
    /** Inclinación inicial y límites (rad; 0 = horizontal, positivo = desde arriba). */
    inclinacion: 0.35,
    inclinacionMin: -0.15,
    inclinacionMax: 1.2,
    /** A qué altura sobre los pies mira (m). */
    alturaMira: 1.2,
    /** Rapidez con la que alcanza al escalador (más = menos retardo). */
    seguimiento: 10,
    sensibilidadRaton: 0.0025,
    /** Giro con Q/E o el stick derecho (rad/s). */
    velocidadGiro: 2.5,
    /** Distancia mínima a la columna para no meterse dentro (m). */
    margenColumna: 0.4,
  },
} as const;

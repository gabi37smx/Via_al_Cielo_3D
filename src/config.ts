/*
 * Todos los números que se ajustan jugando, en un solo sitio.
 * Unidades: metros, segundos y radianes.
 */
export const CONFIG = {
  escalador: {
    /** Radio de la cápsula (para no meterse en la pared). */
    radio: 0.35,
    /** Velocidad máxima corriendo (m/s). */
    velocidad: 6,
    /**
     * CORRER SOLO (Gabi, 28-nov): con 3 toques seguidos de W, A o D (o las
     * flechas) sale corriendo hacia ese lado a esta velocidad sin mantener
     * nada pulsado, hasta pulsar cualquier tecla. Solo por el suelo: en el
     * aire, la velocidad de siempre.
     */
    velocidadCorrerSolo: 10,
    toquesCorrer: 3,
    /** Como mucho, tiempo entre un toque y el siguiente (s). */
    separacionToques: 0.4,
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
    /*
     * El hielo de los salientes de la montaña (decisión 041): su cara de
     * arriba baja un poco hacia la pared y quien está encima se desliza hacia
     * ella. Velocidad por cada metro de bajada por metro: con la cuesta de
     * 0,12 de reglas/ladera.ts son ~2,6 m/s sin crampones y ~1 m/s con ellos.
     */
    deslizarHielo: 22,
    /** Con crampones se desliza solo esta parte. */
    deslizarConCrampones: 0.4,
    /** Bajando una cuesta se queda pegado al suelo si está a menos de esto por debajo (m). */
    pegarseAlSuelo: 0.12,
    /*
     * Agarrarse al borde y trepar (idea I3). Si en el aire el borde de un
     * saliente queda delante y a la altura de las manos, se agarra.
     */
    /** El borde tiene que quedar entre estas alturas sobre los pies (m). */
    agarreMin: 1,
    agarreMax: 1.7,
    /**
     * Colgado, los pies quedan a esta distancia por debajo del borde (m). El
     * modelo es cabezón y de brazos cortos: con los brazos arriba las manos
     * quedan a ~1,25 m de los pies (la cabeza asoma por encima del borde).
     */
    alturaManos: 1.25,
    /** Hasta dónde llegan las manos por delante del cuerpo (m). */
    alcance: 0.8,
    /** Subiendo solo se agarra casi en lo más alto del salto (m/s). */
    agarreSubiendo: 1.5,
    /** Cayendo más rápido que esto ya no se agarra (m/s): no salva las caídas largas. */
    agarreCayendo: 15,
    /** Lo que tarda en subir al saliente (s). */
    trepar: 0.5,
    /** Tras soltarse, tiempo sin poder agarrarse otra vez (s). */
    esperaReagarre: 0.35,
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
    /** Distancia mínima a la pared para no meterse dentro (m). */
    margenPared: 0.3,
    /**
     * Recolocación sola: si no se toca la cámara durante `esperaRecolocar` s,
     * vuelve poco a poco a ponerse entre el centro del pozo y el escalador,
     * mirando a la pared (`recolocar` = rapidez; 0 = nunca).
     */
    recolocar: 1.5,
    esperaRecolocar: 1.2,
    /** Fuera (la ladera), la cámara mira más de frente para ver la montaña y el cielo (rad). */
    inclinacionFuera: 0.08,
  },
  sonido: {
    /** Volumen general (0-1) y del fondo de la cueva respecto a los efectos. */
    volumen: 0.7,
    ambiente: 0.5,
    /** Metros corriendo entre un paso y el siguiente (un paso suena cada zancada). */
    zancada: 1.6,
    /** Gotas que caen en la cueva, de media, por segundo (en la grieta, la mitad). */
    gotasPorSegundo: 0.35,
    /** Hasta qué frecuencia (Hz) se oye el rumor de fondo: grave en la cueva, más abierto en la grieta. */
    filtroCueva: 220,
    filtroGrieta: 480,
    filtroExterior: 1300,
    /** Con la pausa abierta (solo) el volumen baja a esta fracción. */
    enPausa: 0.25,
    /** Por debajo de esta caída (m) el aterrizaje no suena: es bajar un escalón. */
    aterrizajeMin: 0.5,
  },
} as const;

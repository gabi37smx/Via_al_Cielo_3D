# Sesión 4 · Reglas, peligros y fin de partida → hito 1

> 26-nov-2026 · etiqueta `sesion-04` · **Hito 1: «ya es un juego»**

Se puede jugar una partida completa del modo solo: subir la cueva cogiendo fragmentos, esquivar murciélagos, perder vida al caer y ver la pantalla final con el récord.

El curso añade aquí Rapier. En este juego no hace falta (decisión 019): cajas, un cilindro y plataformas de un sentido se resuelven con el suelo propio, que además es idéntico en todos los navegadores. **Pendiente de comentarlo con el profesor.**

## Qué queda hecho

- **Reglas** (`src/reglas/partida.ts`, lógica pura): vida 100, +25 al coger los 3 fragmentos del tramo, murciélago −10 con 1,5 s de invulnerabilidad, caída de más de 90 m −30 y fin con vida 0. Devuelven **jugadas** a las que reacciona lo que se ve. Los números son los del Vía al Cielo 2D (v73).
- **Fragmentos y murciélagos generados con la semilla**: un fragmento por tercio del tramo, flotando sobre un saliente; 25 murciélagos repartidos a lo alto dando vueltas a la torre.
- **El escalador del ordenador** (`src/bots/cerebro.ts`): mismas órdenes que el teclado, mismo movimiento.
- **Simulación** (`src/bots/simulacion.ts` y `npm run simular`): una subida entera en ~10 ms, sin navegador.
- **Dibujo** (`src/mundo/objetos.ts`): fragmentos `{ }` verdes que giran y flotan; murciélagos con alas que aletean y ojos rojos, todos en 3 mallas instanciadas.
- **Marcador** (`src/ui/hud.ts`): vida con color, altura, récord, fragmentos y tramo; avisos y destello rojo al recibir daño; el escalador parpadea mientras es invulnerable.
- **Fin de partida** (`src/ui/fin.ts`): resumen, récord en el navegador y «Volver a jugar» (botón o Enter).
- **Consola**: `juego.partida`, `juego.escalador`, `juego.danar(n)`. La captura acepta `--js`.

## Simulación (equilibrio)

`npm run simular -- 50 N` con el escalador del ordenador, que **no esquiva**:

| Murciélagos | Llegan arriba | Golpes de media | Vida final |
|---|---|---|---|
| 0 | 50/50 | 0 | 100 |
| 12 | 50/50 | 0,6 | 99 |
| 16 | 50/50 | 1,1 | 98 |
| 20 | 50/50 | 1,1 | 98 |
| **25 (elegido, como el 2D)** | **50/50** | **1,9** | **95** |

- Subir la cueva lleva **73 s** de media (3 m/s, lejos de los 14 m/s que rechazaría la API) y **sin ningún tropiezo**.
- La cueva es el primer tramo: que sea suave es lo que toca. Las pruebas de `src/bots/simulacion.test.ts` vigilan que siga así.

## Comprobaciones

- [x] 50 pruebas: reglas (13), movimiento, torre, cámara, bucle y **equilibrio** (5: todas las torres se suben, < 14 m/s, 40 s-2 min, fragmentos, 1-4 golpes sin morir).
- [x] Capturas: fragmento y murciélagos a la vista, caída de 110 m, fin de partida con «¡Récord nuevo!» y «Volver a jugar» que deja la vida a 100.
- [x] 29 llamadas de dibujo de 200 y ~16 000 triángulos.

## Qué se le pidió a la IA

1. «Sí, fusiona y sigue»: fusionar la PR #5, poner la etiqueta `sesion-03` y hacer la sesión 4 (hito 1).

## Qué falló y cómo se arregló

- **El escalador del ordenador no llegaba nunca arriba** (139 caídas por subida). Una traza paso a paso enseñó el motivo: en pleno salto, al pasar por encima del saliente al que iba, cambiaba de objetivo al siguiente y nunca se posaba. Ahora el objetivo sale del último sitio pisado. Resultado: 30/30 torres, cero tropiezos.
- **Los murciélagos no molestaban** (0,2 golpes por subida): volaban por fuera del camino del escalador. Se acercaron a la columna.
- **La invulnerabilidad no se acababa nunca del todo**: 1,5 − 90 × (1/60) no da 0 exacto en coma flotante y el golpe siguiente no llegaba. Lo encontró una prueba; ahora lo que queda por debajo de una milésima cuenta como 0.
- **Los murciélagos no se veían venir** a tamaño real (1,3 m de alas) en la oscuridad: se dibujan 1,5 veces más grandes, con ojos rojos que brillan.

## Cambios tras probar el hito 1 (26-nov)

Gabi lo probó y pidió dos cosas:

1. **Un escalador más real, con brazos y piernas.** Propuso Mixamo; se eligió el «trabajador» de **Kenney Mini Characters 2.0 (CC0)** porque Mixamo pide cuenta de Adobe, conversión desde FBX y su licencia no deja repartir los archivos en un repositorio público (decisión 023). Trae `idle`, `walk`, `sprint`, `jump` y `fall`; se carga con `GLTFLoader` y la postura elige la animación con un fundido de 0,15 s. Las llamadas de dibujo bajan de 29 a 17.
   - Tropiezo: la web de Kenney da el enlace de descarga con JavaScript; hubo que pedirlo igual que el botón «Continue without donating».
2. **Escenarios sin repetir**: una cueva oscura, una clara (la grieta) y luego exterior (decisión 024). Queda en el diseño; se construyen en la sesión 7.
3. **Intento de casco de escalada y arnés (deshecho).** Se probó otro personaje sin pelo con un casco y un arnés hechos por código enganchados a los huesos. Técnicamente funcionaba (y fundiendo piezas bajó de 77 a 25 llamadas de dibujo), pero a Gabi no le gustó cómo quedaban la cara y el casco, así que se volvió al «trabajador» con un `git revert` (el intento queda en el historial).

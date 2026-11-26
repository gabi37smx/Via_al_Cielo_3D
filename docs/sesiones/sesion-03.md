# Sesión 3 · El protagonista: control, cámara y animación

> 26-nov-2026 · etiqueta `sesion-03`

Como en el curso, el escalador corre, salta y tiene la cámara detrás; las físicas completas quedan para la sesión 4. Dos diferencias (decisiones 016 y 017): el personaje está **hecho con piezas por código** en vez de un modelo descargado, y en lugar de un «suelo imaginario» ya **se posa sobre los salientes**, porque sin eso no se puede probar una torre.

## Qué queda hecho

- **`src/config.ts`**: todos los números del escalador y de la cámara en un sitio.
- **Movimiento** (`src/jugador/control.ts`, lógica pura): relativo a la cámara, con aceleración y frenado, salto de 3,5 m, doble salto de +2 m, tiempo coyote (0,1 s), salto guardado (0,12 s), giro hacia donde va y sin meterse en la columna ni salir de la cueva. Devuelve los sucesos del paso (salto, doble salto, metros caídos al aterrizar) para la sesión 4.
- **Suelo** (`alturaSuelo` en `src/reglas/torre.ts`): salientes de un sentido y rellano en anillo. Dibujo y suelo usan la misma caja.
- **Entrada** (`src/nucleo/entrada.ts`): teclado, ratón capturado y mando acaban en la misma estructura `Mando`. Saltar es una pulsación que solo vale en un paso.
- **Cámara en tercera persona** (`src/mundo/camara.ts`): gira con el ratón, Q/E o el stick derecho; sigue con retardo independiente de los fps; se acerca si la columna queda en medio y no atraviesa las paredes.
- **El escalador** (`src/jugador/personaje.ts`): cápsula roja, casco amarillo con linterna, gafas y mochila con cuerda. Animación por postura: respira quieto, bota y se inclina al correr, se estira al subir, voltereta en el doble salto y aplastamiento al aterrizar.
- **Sombra redonda** (`src/mundo/sombra.ts`) bajo el escalador: dice dónde va a caer.
- **Captura con teclas**: `--teclas "Space:60,_:400,Space:60"`.

## Comprobaciones

- [x] **En diagonal corre igual de rápido que en recto** (prueba).
- [x] **Al soltar frena en un instante, no en seco**: sigue moviéndose el primer paso y está parado en 0,2 s (prueba).
- [x] El salto llega a 3,3-3,6 m (más que los 3 m del hueco máximo) y el doble salto a 5,2-5,6 m (pruebas).
- [x] Aterriza sobre un saliente, lo atraviesa desde abajo y no se cuela cayendo a 40 m/s (pruebas).
- [x] «Adelante» es hacia donde mira la cámara y no se mete en la columna (pruebas).
- [x] En el navegador (capturas): quieto, saltando (postura «subiendo», 1,9 m), corriendo de lado, doble salto con voltereta (5,2 m), de pie en un saliente a 110 m y sombra redonda en el suelo.
- [x] 32 pruebas en total; 22 llamadas de dibujo de 200.

## Qué se le pidió a la IA

1. «Sí, fusiona y sigue»: fusionar la PR #4, poner la etiqueta `sesion-02` y hacer la sesión 3.

## Qué falló y cómo se arregló

- **Empezaba mirando de lado** en vez de hacia la columna: se le da la orientación inicial hacia el eje.
- **La cabeza salía quemada de luz**: la linterna estaba justo encima. Se subió y se llevó hacia la cámara.
- **La sombra redonda casi no se veía** sobre el suelo oscuro de la cueva: se hizo más negra y más grande.
- **La inclinación del cuerpo se liaba con la voltereta** (el giro de 360° se sumaba a la inclinación al acabar): se separó la inclinación en su propia variable.
- **En la captura no se podía comprobar el salto**: se añadió `--teclas` a la herramienta.
- Las 29 primeras pruebas del movimiento pasaron a la primera; los fallos fueron todos visuales y salieron en las capturas.

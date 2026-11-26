# Sesión 6 · La carrera completa

> 26-nov-2026 · etiqueta `sesion-06`

La página de esta sesión del curso aún no está publicada (da 404, como la 5), así que se ha hecho a partir de `docs/diseno.md` («Modo carrera»).

Antes de la sesión se hicieron, cada una en su rama, las ideas de Gabi tras probar: la pared de la cueva (I2), agarrarse y trepar (I3), salientes variados (I7) y elegir escaladora o escalador (I5). La carrera ya se apoya en todo eso.

## Qué queda hecho

- **Reglas de la carrera** (`src/reglas/carrera.ts`, lógica pura): fases (esperando → cuenta atrás → en curso → terminada), cuenta atrás de 3 s, meta en el rellano de los 220 m, puntos de control cada 55 m, reaparición a los 3 s con la vida llena, clasificación y cuándo se da por acabada.
- **Un «corredor» común** (`pasoCorredor`): el jugador y los rivales del ordenador pasan por el mismo movimiento, las mismas reglas (fragmentos, murciélagos, caídas), la misma reaparición y la misma meta. El modo solo también lo usa (sin reaparecer).
- **Rivales del ordenador** (`src/bots/rivalesOrdenador.ts`): Roca, Grieta y Pico rellenan la sala hasta 4. No viajan por la red: cada navegador los simula igual con la semilla. Cada uno tiene su ritmo (pausas al azar con semilla tras cada aterrizaje), y en la revancha las pausas cambian.
- **Mensajes de carrera** (`src/red/protocolo.ts` y `sala.ts`): `salida` (ronda y cuántos del ordenador), `meta` (tiempo de llegada) y `fin`. Lo que llega se valida: una llegada en menos de 220 m / 14 m/s se tira.
- **El modo carrera** (`src/modos/carrera.ts`): une reglas, red, rivales y pantalla. Todos apuntan las mismas llegadas y el anfitrión decide cuándo se acaba (han llegado todas las personas, o han pasado 90 s desde el primero).
- **Pantalla de la carrera** (`src/ui/carrera.ts`): sala de espera con «Empezar carrera» (o Intro) y la casilla de rivales del ordenador, cuenta atrás grande, reloj, «Reapareces en…» y resultados con «Otra carrera».
- **Lista de la sala** con los rivales del ordenador, marcados «(CPU)».

## Comprobaciones

- [x] 103 pruebas (24 nuevas): cuenta atrás 3-2-1 en 3 s exactos, reloj, puntos de control, sitio de reaparición, reaparecer tras una caída mortal, meta una sola vez, clasificación, desempate, cuándo se acaba, mensajes de carrera (y los raros), y rivales del ordenador (llegan todos, cada uno a su ritmo, deterministas, revancha distinta).
- [x] **Carrera entera con dos navegadores contra Supabase** (`npm run prueba-red`), dos veces seguidas sin fallos: los dos cuentan y salen, los mismos 4 corredores (2 personas + 2 del ordenador), Ana se entera de la llegada de Beto, la carrera se acaba al llegar las dos personas y gana Beto en los dos navegadores.
- [x] Capturas: sala de espera, salida con los rivales del ordenador y resultados.
- [x] El modo solo sigue igual: la caída mortal saca la pantalla de fin.
- [x] `npm run simular -- 100`: 100/100 subidas.

## Qué se le pidió a la IA

1. «Fusiona #15 y #16 y sigue con la sesión 6».

## Qué falló y cómo se arregló

- **El escalador del ordenador no hacía el doble salto justo debajo de un saliente alto** (salió en la I7, antes de esta sesión): ahora lo hace aunque ya esté en su sitio en horizontal.
- **«Misma torre» fallaba a veces en la prueba de red** (fallo de la sesión 5): el que entraba podía verse a sí mismo antes de saber quién estaba ya. Ahora espera 1 s a la lista (PR #16).
- **La captura pulsaba Intro antes de tiempo**: con `?sala=` se da por lista en cuanto sale «Conectando…». Para capturar la cuenta atrás hay que esperar antes: `--teclas "_:5000,Enter:60"`.
- **Desde la consola se podía dar otra salida a mitad de carrera**: ahora solo se puede empezar en la espera o con la carrera acabada.

## Limitaciones que quedan

- Quien entra en la sala con una carrera en marcha espera a la siguiente.
- Cada uno empieza la cuenta atrás al recibir la salida: el anfitrión sale unos milisegundos antes (lo que tarda el mensaje).
- Los tiempos los manda cada jugador; se tiran los imposibles, pero no hay árbitro que lo compruebe todo.

## Pendiente para la sesión 7

Sonido, partículas, la grieta y el aire libre, ranking mundial en modo solo, controles táctiles, ayuda y ajustes.

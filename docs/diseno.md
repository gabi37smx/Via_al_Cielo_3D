# Vía al Cielo 3D · Diseño en una página

> Borrador 2 · 26-nov-2026 (con las respuestas del profesor). Este documento manda: si el código y el diseño no coinciden, se corrige uno de los dos y se apunta en «Decisiones».

## La idea en una frase

Escalas una torre vertical saltando de saliente en saliente: **solo**, para llegar lo más alto posible, o **en carrera** contra 2-4 jugadores (o el ordenador), para llegar el primero a la meta.

## De dónde viene

Es la versión 3D de *Vía al Cielo* (2D, canvas, v73). De aquel juego se conservan **las reglas, los números y el servidor del ranking**; el código se escribe de nuevo.

| Se conserva | Se rehace |
|---|---|
| Doble salto, vida 100 %, 3 fragmentos por tramo, daño por caída y por animales | Todo el dibujo (Three.js) y las físicas (Rapier) |
| Tramos de 220 m con escenario propio (cueva → grieta → aire libre → ciudades) | El personaje: **propio**, nada de Minecraft (ni Steve ni su aspecto) |
| API del ranking (`api-via-al-cielo`: token al empezar + validación de metros) | Menús, HUD y controles |
| Textos en es / ca / en | Estructura del código (TypeScript, por carpetas) |

## Cómo se juega

- **Mover:** WASD o flechas, relativo a la cámara. **Saltar:** espacio; en el aire, otra vez = **doble salto** (con voltereta). Con **mando**: stick izquierdo, stick derecho y botón A.
- **Cámara:** tercera persona, detrás y algo por encima, sigue con un pequeño retardo; el ratón la gira (clic para capturarlo, Esc lo suelta) y también Q/E. Si la columna queda en medio, se acerca al escalador.
- **Salientes de un sentido:** se atraviesan desde abajo al saltar y frenan al caer encima, como en el 2D.
- **Sombra redonda** bajo el escalador siempre visible: en 3D es lo que permite calcular dónde vas a caer.
- **El mundo:** salientes apilados en espiral alrededor de una columna central (la «torre»). Cada 220 m cambia el tramo y el escenario, **sin repetir ninguno**:

  | Tramo | Altura | Escenario | Peligro |
  |---|---|---|---|
  | 1 | 0-220 m | **Cueva oscura** | murciélagos |
  | 2 | 220-440 m | **Grieta**: cueva clara, con luz que entra desde arriba | murciélagos (menos) |
  | 3 | 440-660 m | **Aire libre**: se sale al exterior, cielo y nubes | águilas |
  | 4… | 660 m → | **Ciudades** (1-2 en la versión 1.0) | según la ciudad |

  Solo hay **una cueva oscura y una clara**; después siempre se está fuera (en el 2D la cueva oscura volvía a salir y se repetía demasiado).
- **Fragmentos de código:** 3 por tramo. Coger los 3 devuelve vida.
- **Vida:** empiezas con 100 %. Animal que te toca → pierdes vida y eres invulnerable 1,5 s. Caída de más de 90 m → −30 %. No se regenera sola.

### Modo solo
Igual que el original: subir lo más alto posible. Vida a 0 → fin de partida → si entras en el top 10, iniciales y **ranking mundial** (API actual).

### Modo carrera (multijugador, obligatorio)
- **Sala** de 2 a 4 jugadores con un código de 4 letras. Huecos vacíos → rivales del ordenador (opcional).
- Todos escalan **la misma torre**: el anfitrión reparte una **semilla** y cada navegador genera los mismos salientes.
- Cuenta atrás 3-2-1 y salida a la vez. **Meta: 220 m** (un tramo) en la versión 1; más tramos después.
- Los escaladores **se atraviesan** (no se empujan): evita peleas de físicas por la red.
- Vida a 0 → **no se acaba la partida**: reapareces en el último punto de control (cada 55 m) tras 3 s.
- Gana quien cruza la meta primero. Empate imposible: decide el anfitrión con el orden de llegada.
- Se ve a los rivales escalando, su nombre encima y una barra lateral con la altura de cada uno.

## Reglas en números (a ajustar jugando)

| Concepto | Original 2D | Propuesta 3D |
|---|---|---|
| Unidad | 20 px = 1 m | 1 unidad Three.js = 1 m |
| Tramo / pantalla | 220 m | 220 m (la API lo valida: `METROS_POR_PANTALLA`) |
| Altura del salto | ~8 m | 3,5 m + 2 m el doble salto (gravedad 28 m/s² → sale a 14 m/s) |
| Carrera | — | 6 m/s; acelera a 45 m/s², frena a 60 m/s²; en el aire, 55 % de control |
| Ayudas al salto | — | tiempo coyote 0,1 s y salto guardado 0,12 s |
| Separación entre salientes | — | 2-3 m en vertical, 30-50° de giro (2-3,4 m entre centros) |
| Columna / salientes | — | columna de 3 m de radio; salientes de 1,6-2,2 × 2,2 m; ~90 por tramo |
| Final de cada tramo | — | rellano: anillo completo alrededor de la columna |
| Caída que hace daño | > 90 m → −30 % | igual |
| Daño de animales | 10-20 % | igual (murciélago 10, águila 15…) |
| Murciélagos en la cueva | 25 por pantalla | 25 por tramo, dando vueltas por encima de los salientes (~2 golpes por subida simulada) |
| Fragmentos | 3 por pantalla, +25 % de vida | igual: uno por tercio del tramo, flotando sobre un saliente |
| Invulnerable tras golpe | 90 fotogramas | 1,5 s |
| Velocidad máxima creíble | 14 m/s (API) | no superarla o el ranking rechaza la partida |

## Filtro de alcance

**Hito 1 (sesión 4): «ya es un juego»**, solo modo solo · ✅ conseguido el 26-nov
- Escalador (cápsula) que corre, salta y hace doble salto, con cámara en tercera persona.
- Torre de salientes generada con semilla, **un escenario: la cueva**.
- Fragmentos, vida, daño por caída, murciélagos y fin de partida.

**Versión 1.0 (sesión 8)**
- Modo carrera en red con salas, cuenta atrás, meta y resultados.
- Grieta y aire libre, ranking mundial en modo solo, sonido, controles táctiles, ayuda y ajustes.

**Fuera (de momento):** las 12 ciudades (como mucho 1-2 al final), chat, personalizar el escalador más allá del color, espectadores, empujones entre jugadores, servidor de juego propio.

## Cómo está hecho

- **Vite + TypeScript + Three.js + Rapier.** Sin motor de juego.
- **Bucle de paso fijo** de 1/60 s para la lógica y otro para pintar.
- **Las reglas son lógica pura** (`src/reglas/`): sin Three.js, sin DOM y sin red. Así se prueban solas y se mide el equilibrio simulando partidas.
- **Red de la carrera:** cada jugador simula su escalador y envía su posición ~10 veces por segundo; los demás se ven interpolados con **150 ms** de retardo. El anfitrión (el más antiguo de la sala) reparte la semilla, da la salida y decide el orden de llegada; si se va, lo hereda el siguiente. Sin servidor de juego propio ni tablas: **Supabase Realtime**, como en el curso (confirmado por el profesor), con un canal `sala:ABCD` por sala: **presencia** para saber quién está y **difusión** para los estados.
- **Ranking:** modo solo → `api-via-al-cielo` (Render + MongoDB). Resultados de carrera → solo en la sala en la v1. La API solo acepta las webs de su lista: hay que añadir la dirección del juego a `ORIGENES_PERMITIDOS` en Render.
- **Publicación:** en el **servidor del centro** (el mismo de la IA del centro). Vite genera una carpeta `dist/` con archivos estáticos que se sube allí. Pendiente: cómo se sube y qué dirección tendrá.
- **Herramientas para que la IA vea:** captura del juego en Chromium sin pantalla (`herramientas/captura.mjs`) y panel **F3** con FPS, llamadas de dibujo, triángulos y estado de la red.
- **Presupuesto:** 16 ms por fotograma, < 200 llamadas de dibujo, ~300 000 triángulos, texturas de 1024 px. Los salientes, con *instancing*.
- **Créditos:** todo modelo, textura o sonido de fuera se apunta en `docs/creditos.md` con su origen y licencia.

```
src/
  nucleo/    bucle de paso fijo, entrada (teclado/ratón/táctil)
  reglas/    vida, fragmentos, tramos, carrera… (lógica pura)
  mundo/     escena, luces, cámara, torre, escenarios
  fisicas/   mundo Rapier, cápsula del escalador
  red/       salas, mensajes, interpolación
  ui/        menús, HUD, ranking
herramientas/  captura.mjs
docs/          diseno.md, decisiones.md, creditos.md, sesiones/
```

## Plan por sesiones

| Sesión | Qué queda hecho | Etiqueta |
|---|---|---|
| 1 | Diseño, proyecto Vite + TS + Three.js, AGENTS.md, escena mínima, bucle, captura, publicar | `sesion-01` |
| 2 | El mundo: torre de salientes con semilla, luces, cueva | `sesion-02` |
| 3 | El protagonista: cápsula, movimiento, saltos, cámara en tercera persona | `sesion-03` |
| 4 | Físicas y reglas: fragmentos, vida, caídas, murciélagos, fin de partida → **hito 1** | `sesion-04` |
| 5 | Red: salas, semilla compartida, ver a los rivales (**prueba con dos navegadores el primer día**) | `sesion-05` |
| 6 | Carrera completa: cuenta atrás, meta, reaparición, resultados, rivales del ordenador | `sesion-06` |
| 7 | Sonido, partículas, más escenarios, ranking, móvil, ayuda y ajustes | `sesion-07` |
| 8 | Release 1.0, publicación en el servidor del centro y defensa | `v1.0.0` |

Cada sesión deja en `docs/sesiones/` qué se hizo, qué se le pidió a la IA y qué falló.

## Decisiones

- **001** · Vite + TypeScript + Three.js + Rapier, como el caso «Chispa» del curso.
- **002** · Torre en espiral con cámara en tercera persona (no pared plana en 2,5D): aprovecha el 3D sin perder la escalada.
- **003** · En carrera los jugadores se atraviesan y se reaparece en lugar de morir.
- **004** · Se reutiliza la API del ranking para el modo solo; los metros siguen la misma escala (220 m por tramo).
- **005** · El multijugador en red es obligatorio: modo carrera de 2 a 4 jugadores (respuesta del profesor, 26-nov).
- **006** · Se puede partir del Vía al Cielo 2D: sus reglas y la API del ranking (profesor, 26-nov).
- **007** · La red va con **Supabase** (profesor, 26-nov).
- **008** · Se publica en el **servidor del centro** (profesor, 26-nov).
- **009** · Vale OpenCode o Claude Code; se usa **Claude Code** y el `AGENTS.md` sirve para los dos.
- **010** · Pruebas con **Vitest** y captura con **Playwright** (Chromium sin pantalla, SwiftShader si no hay tarjeta gráfica). La captura arranca su propio Vite para no depender de tener `npm run dev` abierto.
- **011** · `base: './'` en `vite.config.ts`: el juego vivirá en una subcarpeta del servidor del centro.
- **012** · La torre se **genera con código a partir de la semilla**, no con un guion de Blender como el escenario del curso: en la carrera todos los navegadores tienen que construir la misma torre recibiendo solo un número. Cada tramo tiene su propia semilla derivada (`derivarSemilla`), así se puede generar el tramo 3 sin los anteriores.
- **013** · Cada tramo **acaba en un rellano** (anillo completo): une un tramo con el siguiente desde cualquier lado y garantiza que también el último hueco mide 2-3 m. Las pruebas lo comprueban con 60 semillas.
- **014** · **Texturas pintadas en canvas** (color, normales y rugosidad del mismo ruido periódico): nada que descargar ni acreditar. Los salientes usan una piedra **más clara** que la columna para que se vea de un vistazo dónde se puede pisar.
- **015** · El sol proyecta sombras solo en una caja de 28 m que **sigue a la cámara**: una sombra que cubriera los 220 m saldría borrosa.
- **016** · El **escalador se construye con piezas por código** (cápsula, casco con linterna, gafas, mochila con cuerda) en vez de cargar un modelo como el robot del curso: es propio, no hay que acreditar nada y está lejos de Minecraft. La animación también es por código y **la decide la postura** (quieto, corriendo, subiendo, cayendo, doble salto), no las teclas: servirá igual para los rivales de la red.
- **017** · En vez del «suelo imaginario» del curso, el escalador ya **se posa sobre los salientes** con `alturaSuelo` (lógica pura, la misma caja que se dibuja): sin eso no se puede probar una torre. Los salientes son **de un sentido**. Se decide en la sesión 4 si Rapier sigue haciendo falta.
- **018** · El movimiento (`src/jugador/control.ts`) es lógica pura con pruebas: altura de los saltos, doble salto, coyote, salto guardado, diagonal, frenado y columna.
- **019** · **Sin Rapier por ahora** (cambia la decisión 001). El mundo son cajas, un cilindro y plataformas de un sentido: el suelo propio lo resuelve en pocas líneas, con pruebas, sin 2 MB de WebAssembly y siendo **idéntico en todos los navegadores** (importante para la carrera). Rapier vuelve si hace falta algo que no sea esto (objetos que rueden, empujones). *Pendiente de comentarlo con el profesor.*
- **020** · Las reglas de la partida (`src/reglas/partida.ts`) son lógica pura: reciben dónde está el escalador y devuelven **jugadas** (fragmento, vida extra, golpe, caída, fin); el HUD y la pantalla final reaccionan a ellas.
- **021** · Un **escalador del ordenador** (`src/bots/cerebro.ts`) da las mismas órdenes que el teclado y pasa por el mismo movimiento. Con él se **simula** la cueva (`npm run simular`) y las pruebas vigilan el equilibrio: las 20 torres se suben enteras, a menos de 14 m/s, cogiendo los fragmentos, con 1-4 golpes de murciélago. En la sesión 6 será el rival del ordenador.
- **022** · El récord se guarda en el navegador (`localStorage`); el ranking mundial llega en la 1.0. «Volver a jugar» repite la misma torre.
- **023** · **El escalador es el «trabajador» de Kenney Mini Characters 2.0 (CC0)** (cambia la 016): cuerpo entero con casco, brazos y piernas y sus animaciones (`idle`, `walk`, `sprint`, `jump`, `fall`), 260 kB y ~900 triángulos. Más real y menos código que construir extremidades a mano. **Mixamo descartado**: pide cuenta de Adobe, hay que convertir de FBX y su licencia no deja repartir los archivos sueltos (el repositorio es público); el curso lo descartó por lo mismo. La animación sigue la postura; encima se mantienen la voltereta del doble salto y el aplastamiento.
- **024** · **Escenarios sin repetir** (petición de Gabi tras probar el hito 1): cueva oscura → grieta (cueva clara) → aire libre → ciudades. Una sola cueva oscura y una sola clara.
- **025** · **Red sin tablas**: solo presencia y difusión de Supabase Realtime. La presencia lleva nombre, hora de entrada y semilla de cada jugador: de ahí salen el anfitrión (el más antiguo) y la torre (la semilla del anfitrión, que todos vuelven a publicar para que el siguiente anfitrión la tenga). No hay nada que guardar ni que proteger con RLS; la clave es la *publishable* (pública) y va en `.env`, nunca la secreta.
- **026** · **Estado compacto, 10 veces por segundo**: 8 números redondeados (cm y milésimas) por mensaje. Lo que llega se valida (`decodificar`) y lo que no tiene buena pinta se tira.
- **027** · **Interpolación con 150 ms de retardo** y sin sincronizar relojes: se estima la diferencia de reloj con el mensaje más rápido visto (el mínimo de «llegada − salida»). Con 10 envíos/s, 150 ms garantizan casi siempre un estado a cada lado.
- **028** · **Prueba con dos navegadores** automatizada (`npm run prueba-red`): dos Chromium sin pantalla en la misma sala contra Supabase de verdad comprueban que se ven, la semilla, el anfitrión, la posición del rival y el relevo del anfitrión.

## Pendiente

- **Rúbrica de la sesión 8** (release y defensa): aún no está publicada. La semana que viene el profesor publicará una guía y la rúbrica irá saliendo poco a poco, como en los otros proyectos.
- **Servidor del centro:** cómo se suben los archivos y qué dirección tendrá el juego.
- **Rapier:** preguntar al profesor si es obligatorio usar un motor de físicas o vale el suelo propio (decisión 019).

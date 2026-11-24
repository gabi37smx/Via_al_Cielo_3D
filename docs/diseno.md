# Vía al Cielo 3D · Diseño en una página

> Borrador 1 · 24-nov-2026. Este documento manda: si el código y el diseño no coinciden, se corrige uno de los dos y se apunta en «Decisiones».

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

- **Mover:** WASD o flechas, relativo a la cámara. **Saltar:** espacio; en el aire, otra vez = **doble salto**.
- **Cámara:** tercera persona, detrás y algo por encima, sigue con un pequeño retardo; el ratón la gira.
- **Sombra redonda** bajo el escalador siempre visible: en 3D es lo que permite calcular dónde vas a caer.
- **El mundo:** salientes apilados en espiral alrededor de una columna central (la «torre»). Cada 220 m cambia el tramo y el escenario.
- **Fragmentos de código:** 3 por tramo. Coger los 3 devuelve vida.
- **Vida:** empiezas con 100 %. Animal que te toca → pierdes vida y eres invulnerable 1,5 s. Caída de más de 90 m → −30 %. No se regenera sola.

### Modo solo
Igual que el original: subir lo más alto posible. Vida a 0 → fin de partida → si entras en el top 10, iniciales y **ranking mundial** (API actual).

### Modo carrera (multijugador)
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
| Altura del salto | ~8 m | ~3,5 m + ~2 m el doble salto |
| Separación entre salientes | — | 2-3 m en vertical |
| Caída que hace daño | > 90 m → −30 % | igual |
| Daño de animales | 10-20 % | igual (murciélago 10, águila 15…) |
| Invulnerable tras golpe | 90 fotogramas | 1,5 s |
| Velocidad máxima creíble | 14 m/s (API) | no superarla o el ranking rechaza la partida |

## Filtro de alcance

**Hito 1 (sesión 4): «ya es un juego»**, solo modo solo
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
- **Red de la carrera:** cada jugador simula su escalador y envía su posición ~10 veces por segundo; los demás se ven interpolados con ~100 ms de retardo. El anfitrión (el más antiguo de la sala) reparte la semilla, da la salida y decide el orden de llegada; si se va, lo hereda el siguiente. Sin servidor propio: **Supabase Realtime** (como el curso), pendiente de confirmar.
- **Ranking:** modo solo → `api-via-al-cielo` (Render + MongoDB). Resultados de carrera → solo en la sala en la v1.
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
| 8 | Release 1.0, publicación y defensa | `v1.0.0` |

Cada sesión deja en `docs/sesiones/` qué se hizo, qué se le pidió a la IA y qué falló.

## Decisiones

- **001** · Vite + TypeScript + Three.js + Rapier, como el caso «Chispa» del curso.
- **002** · Torre en espiral con cámara en tercera persona (no pared plana en 2,5D): aprovecha el 3D sin perder la escalada.
- **003** · En carrera los jugadores se atraviesan y se reaparece en lugar de morir.
- **004** · Se reutiliza la API del ranking para el modo solo; los metros siguen la misma escala (220 m por tramo).

## Pendiente de preguntar al profesor

1. ¿El multijugador en red es obligatorio? ¿Vale una carrera de 2-4?
2. ¿Se puede partir de un proyecto anterior (reglas y API del ranking)?
3. ¿Hay que usar Supabase del curso o vale otro servicio? ¿Dónde se publica?
4. ¿La IA tiene que ser OpenCode o vale Claude Code?
5. ¿Dónde está la rúbrica de la sesión 8 «Release y defensa»?

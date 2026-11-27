# AGENTS.md · Vía al Cielo 3D

Lo lee el agente de IA (Claude Code u OpenCode) al empezar cada conversación. **Antes de tocar nada, lee `docs/diseno.md`**: el diseño manda. Si el código y el diseño no coinciden, se corrige uno de los dos y se apunta en «Decisiones».

Todo en **español**: código (variables, funciones, archivos), comentarios, commits y documentación. Los nombres de las librerías se quedan como son.

## El stack

- **Vite** sirve y compila. **TypeScript** estricto (`strict: true`). **Three.js** dibuja.
- **Supabase Realtime** (`@supabase/supabase-js`) para la carrera: solo presencia y difusión en un canal por sala, sin tablas.
- **Sin Rapier** de momento (decisión 019): el suelo y las colisiones son lógica propia en `src/reglas/torre.ts` y `src/jugador/control.ts`.
- **Vitest** para las pruebas de la lógica y **Playwright** (Chromium sin pantalla) para la captura.
- Sin motor de juego ni framework de interfaz (nada de React, Babylon.js, etc.).
- 1 unidad de Three.js = 1 metro.

## Cómo se organiza

```
src/
  main.ts    arranque: une escena, bucle e interfaz (poca lógica aquí)
  config.ts  TODOS los números que se ajustan jugando (velocidades, saltos, cámara…)
  nucleo/    bucle de paso fijo, entrada (teclado/ratón/mando → una misma estructura)
  jugador/   control.ts (movimiento, LÓGICA PURA) y personaje.ts (dibujo y animación)
  reglas/    torre, partida (vida, fragmentos, murciélagos), carrera… LÓGICA PURA: sin Three.js, sin DOM, sin red
  bots/      cerebro del escalador del ordenador y simulación de partidas (lógica pura)
  mundo/     escena (luces y ambiente de cada escenario), cámara, torre, cueva.ts y grieta.ts (Three.js)
  fisicas/   mundo Rapier, cápsula del escalador
  red/       protocolo.ts e interpolacion.ts (LÓGICA PURA) y sala.ts (Supabase)
  sonido/    sucesos.ts (qué suena en cada paso, LÓGICA PURA), sintetizador.ts (cómo suena, Web Audio) y audio.ts (volumen, M, fondo)
  modos/     cada modo de juego une reglas, red y pantalla (carrera.ts: la carrera en una sala)
  ui/        menús, HUD, ranking, contador de fps
public/modelos/ escalador.glb y escaladora.glb (Kenney, CC0) y su textura
herramientas/  captura.mjs, simular.ts, prueba-red.mjs, sonidos.mjs
docs/          diseno.md, creditos.md, sesiones/
```

- La **lógica avanza a paso fijo** de 1/60 s (`src/nucleo/bucle.ts`). Nunca se mueve nada con «velocidad × dt del fotograma»: se usa el `paso` que recibe `actualizar`, y en `pintar` solo se interpola con `alfa`.
- Las pruebas van junto al archivo que prueban: `algo.ts` → `algo.test.ts`. Todo lo de `src/reglas/` lleva pruebas.
- Presupuesto: 16 ms por fotograma, < 200 llamadas de dibujo, ~300 000 triángulos, texturas de 1024 px.

## Las órdenes

| Orden | Para qué |
|---|---|
| `npm install` | Instalar dependencias (y la primera vez: `npx playwright install chromium`) |
| `npm run dev` | Jugar en local con recarga automática |
| `npm run comprobar` | Comprobar los tipos de TypeScript |
| `npm test` | Pasar las pruebas |
| `npm run build` | Comprobar tipos y generar `dist/` para publicar |
| `npm run captura` | **Ver el juego**: abre Chromium sin pantalla y deja `capturas/captura.png`. Opciones: `--salida`, `--ancho`, `--alto`, `--espera` (ms), `--ruta` (por defecto `"?semilla=1&panel=1"`) y `--teclas` (pulsar antes de capturar: `"Space:60,_:400,Space:60"` = doble salto; `_` espera) |
| `npm run simular` | Simula subidas de la cueva con el escalador del ordenador y enseña una tabla (`npm run simular -- 50 20`: 50 torres, 20 murciélagos; `npm run simular -- 20 - 2`: la grieta, tramo 2, con sus murciélagos). **Después de tocar números de `config.ts` o `REGLAS`, simula** |
| `npm run prueba-red` | **Prueba con dos navegadores** contra Supabase (Ana con la escaladora y Beto con el escalador): se ven, misma semilla, anfitrión, cada uno ve al otro con su aspecto, posición del rival, **una carrera entera** (salida, llegadas, fin y ganador) y relevo del anfitrión. Tarda ~2 minutos. Deja `capturas/red-ana.png`, `capturas/red-beto.png` y `capturas/red-carrera.png`. Necesita el `.env` |
| `npm run sonidos` | Graba cada sonido del juego en `capturas/sonidos/*.wav` (con el mismo código del juego) y enseña su duración, pico y volumen. Falla si alguno sale mudo, saturado o cortado. **Después de tocar `src/sonido/sintetizador.ts`, pásalo** (la IA no puede oír: lo mide) |
| `npm run desplegar` | *Pendiente*: subir `dist/` al servidor del centro (falta saber cómo) |

Parámetros de la dirección del juego: `?semilla=N` (torre concreta), `?altura=M` (empieza en el primer saliente desde esa altura), `?aspecto=escaladora` (o `escalador`; sin él, el último elegido en el menú), `?panel=1` (panel de datos, también con **F3**: llamadas de dibujo, triángulos, semilla, altura y postura).

- En la consola del navegador (y en la captura con `--js "…"`) está `juego`: `juego.partida`, `juego.escalador`, `juego.sonido` (`running` = ya suena; antes del primer clic o tecla es `sin crear`), `juego.girarCamara(giro, inclinacion)` (rad, para capturas), `juego.danar(50)`, `juego.teletransportar(x, y, z)`, `juego.red`, `juego.carrera` y `juego.empezarCarrera()` (el anfitrión).
- Con `?sala=` la captura se da por lista en cuanto sale «Conectando…»: para pulsar algo en la sala de espera, espera antes (`--teclas "_:5000,Enter:60"`).
- Las pulsaciones (saltar) solo valen en el paso en que se leen; los números van a `src/config.ts`, nunca sueltos por el código.
- SwiftShader (la captura) va a 5-10 fps: el juego va «a cámara lenta» porque el bucle no recupera más de 5 pasos por fotograma. No sirve para medir rendimiento. Para mirar otra zona: `npm run captura -- --ruta "?semilla=1&altura=110&panel=1" --salida capturas/alto.png` (la grieta empieza en `altura=220`).
- La cámara del juego no mira mucho hacia arriba. Para ver un escenario desde el centro del pozo sirve una página temporal en la raíz servida por Vite (escena + `crearGrieta`/`crearCueva` + cámara colocada a mano) y una captura con Playwright; **se borra después**.

**Después de cada cambio visible, haz una captura y mírala** antes de decir que está hecho. Si la captura avisa de errores en la consola, arréglalos primero.

## Cómo se trabaja

- Una rama por tarea y una PR a `main`; nunca se trabaja directamente en `main`. Al cerrar cada sesión, etiqueta `sesion-0N` en `main`.
- Antes de la PR: `npm run build`, `npm test` y `npm run captura` sin errores.
- Cada sesión deja `docs/sesiones/sesion-0N.md`: qué se hizo, qué se le pidió a la IA y qué falló.
- Todo modelo, textura o sonido de fuera se apunta en `docs/creditos.md` con su origen y licencia.

## Lo que no se toca

- **Nada de Minecraft**: ni Steve, ni su aspecto, ni sus texturas o sonidos.
- **Recursos de fuera, solo con licencia libre (CC0)** y apuntados en `docs/creditos.md`. Nada de Mixamo (decisión 023).
- **Escenarios sin repetir**: una cueva oscura, una clara y luego exterior (decisión 024).
- **No se recrea otro juego existente** (nombre, personajes, arte, música, niveles).
- **La escala de metros y la velocidad máxima** (220 m por tramo, < 14 m/s): la API del ranking (`api-via-al-cielo`) las valida y rechazaría la partida.
- **Nada de claves en el repositorio**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_CLAVE` (la *publishable*) van en `.env`, que git ignora. **La secret key no se usa nunca en el juego.** Sin `.env` el juego funciona en modo solo y la carrera sale desactivada.
- No añadir dependencias nuevas sin apuntar por qué en las decisiones de `docs/diseno.md`.

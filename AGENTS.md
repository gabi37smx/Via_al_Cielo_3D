# AGENTS.md · Vía al Cielo 3D

Lo lee el agente de IA (Claude Code u OpenCode) al empezar cada conversación. **Antes de tocar nada, lee `docs/diseno.md`**: el diseño manda. Si el código y el diseño no coinciden, se corrige uno de los dos y se apunta en «Decisiones».

Todo en **español**: código (variables, funciones, archivos), comentarios, commits y documentación. Los nombres de las librerías se quedan como son.

## El stack

- **Vite** sirve y compila. **TypeScript** estricto (`strict: true`). **Three.js** dibuja.
- **Rapier** (físicas) y **Supabase Realtime** (red de la carrera) llegarán en sus sesiones; no se añaden antes.
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
  reglas/    vida, fragmentos, tramos, carrera… LÓGICA PURA: sin Three.js, sin DOM, sin red
  mundo/     escena, luces, cámara, torre, escenarios (Three.js)
  fisicas/   mundo Rapier, cápsula del escalador
  red/       salas, mensajes, interpolación (Supabase)
  ui/        menús, HUD, ranking, contador de fps
herramientas/  captura.mjs
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
| `npm run desplegar` | *Pendiente*: subir `dist/` al servidor del centro (falta saber cómo) |

Parámetros de la dirección del juego: `?semilla=N` (torre concreta), `?altura=M` (empieza en el primer saliente desde esa altura), `?panel=1` (panel de datos, también con **F3**: llamadas de dibujo, triángulos, semilla, altura y postura).

- Las pulsaciones (saltar) solo valen en el paso en que se leen; los números van a `src/config.ts`, nunca sueltos por el código.
- SwiftShader (la captura) va a 5-10 fps: el juego va «a cámara lenta» porque el bucle no recupera más de 5 pasos por fotograma. No sirve para medir rendimiento. Para mirar otra zona: `npm run captura -- --ruta "?semilla=1&altura=110&panel=1" --salida capturas/alto.png`.

**Después de cada cambio visible, haz una captura y mírala** antes de decir que está hecho. Si la captura avisa de errores en la consola, arréglalos primero.

## Cómo se trabaja

- Una rama por tarea y una PR a `main`; nunca se trabaja directamente en `main`. Al cerrar cada sesión, etiqueta `sesion-0N` en `main`.
- Antes de la PR: `npm run build`, `npm test` y `npm run captura` sin errores.
- Cada sesión deja `docs/sesiones/sesion-0N.md`: qué se hizo, qué se le pidió a la IA y qué falló.
- Todo modelo, textura o sonido de fuera se apunta en `docs/creditos.md` con su origen y licencia.

## Lo que no se toca

- **Nada de Minecraft**: ni Steve, ni su aspecto, ni sus texturas o sonidos. El escalador es propio.
- **No se recrea otro juego existente** (nombre, personajes, arte, música, niveles).
- **La escala de metros y la velocidad máxima** (220 m por tramo, < 14 m/s): la API del ranking (`api-via-al-cielo`) las valida y rechazaría la partida.
- **Nada de claves en el repositorio**: las de Supabase van en `.env` (ignorado por git), con un `.env.example` de muestra.
- No añadir dependencias nuevas sin apuntar por qué en las decisiones de `docs/diseno.md`.

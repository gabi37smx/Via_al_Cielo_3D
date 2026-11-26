# Sesión 1 · La idea, la escena y el bucle

> 26-nov-2026 · etiqueta `sesion-01`

## Qué queda hecho

- **Diseño** en una página (`docs/diseno.md`, borrador 2) con las respuestas del profesor.
- **Proyecto** Vite 8 + TypeScript 7 (estricto) + Three.js 0.187, partiendo de la plantilla oficial `vanilla-ts`.
- **`AGENTS.md`** con el stack, cómo se organiza, las órdenes y lo que no se toca. `CLAUDE.md` solo lo importa.
- **Escena mínima** (`src/mundo/escena.ts`): renderer con sombras, cámara en perspectiva con OrbitControls, luz de relleno, sol direccional, suelo con rejilla de 1 m y un cubo de 1 m que gira.
- **Bucle de paso fijo** (`src/nucleo/bucle.ts`): la lógica avanza siempre 1/60 s; el dibujo va aparte e interpola con `alfa`. Lleva un comentario que explica por qué.
- **Contador de fps** (`src/ui/fps.ts`), que mide el dibujo.
- **Herramienta de captura** (`herramientas/captura.mjs`): arranca su propio Vite, abre Chromium sin pantalla, espera a que el juego avise (`body[data-listo]`), guarda `capturas/captura.png` y enseña los errores de la consola.
- **Pruebas** del reparto del tiempo (Vitest) y **CI** en GitHub Actions (pruebas + build).

## Comprobaciones

- [x] **El cubo gira igual aunque baje el fps:** la prueba `la lógica avanza lo mismo a 30, 60 y 144 fps` simula 2 s a cada frecuencia y da 120 pasos en todos los casos (±1 a 144 fps).
- [x] **No se deforma al cambiar el tamaño:** capturas a 1280×720 y a 500×800; el cubo sigue siendo cuadrado.
- [x] La captura funciona sin tarjeta gráfica (SwiftShader, ~31 fps).

## Qué se le pidió a la IA

1. «Lee el proyecto de Vía al Cielo 3D» y actualizar el diseño con las respuestas del profesor (PR #2).
2. «Sigue»: montar la sesión 1 tal como la plantea el curso (caso «Chispa»), adaptada a este juego.

## Qué falló y cómo se arregló

- **`PCFSoftShadowMap` ya no existe** en three 0.187: Three.js avisaba por consola y usaba `PCFShadowMap`. Se cambió a `PCFShadowMap`. Lo detectó la herramienta de captura en su primera ejecución.
- **Ruido en la consola:** SwiftShader escribe «GL Driver Message … ReadPixels» al hacer la captura. La herramienta ignora ese mensaje.
- **El cubo flotaba** 25 cm sobre el suelo (`y = 0.75` con 1 m de lado), aunque el comentario decía que estaba apoyado. Se vio en la captura y se bajó a `y = 0.5`.
- **Aviso de tamaño al compilar:** Three.js ocupa unos 550 kB y Vite avisa por encima de 500 kB. Se subió el límite a 1000 kB en `vite.config.ts`.

## Pendiente

- `npm run desplegar`: falta saber cómo se sube al servidor del centro y qué dirección tendrá (en el caso «Chispa» del curso es `https://titan/juegos/chispa/`, que solo se ve desde la red del instituto). `base: './'` ya está puesto para que funcione en una subcarpeta.

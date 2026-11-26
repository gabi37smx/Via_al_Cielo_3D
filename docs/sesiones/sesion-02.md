# Sesión 2 · El mundo: la torre, la cueva y la luz

> 26-nov-2026 · etiqueta `sesion-02`

En el curso (caso «Chispa») esta sesión construye un escenario fijo con un guion de Blender. Aquí el escenario es una torre que **sale de una semilla** (decisión 012), así que se genera con código; las técnicas del curso se mantienen: *instancing*, texturas en canvas, niebla, tipos de luz y panel de llamadas y triángulos.

## Qué queda hecho

- **Azar con semilla** (`src/reglas/azar.ts`): mulberry32 y `derivarSemilla` para que cada tramo tenga la suya.
- **Generación de la torre** (`src/reglas/torre.ts`, lógica pura): salientes en espiral alrededor de una columna de 3 m de radio, a 2-3 m en vertical y girando 30-50°. Cada tramo de 220 m acaba en un **rellano** (decisión 013).
- **Dibujo de la torre** (`src/mundo/torre.ts`): columna, rellano y los ~90 salientes de un tramo en **una sola malla instanciada** (1 llamada de dibujo).
- **Texturas de roca en canvas** (`src/mundo/texturas.ts`): color, normales y rugosidad sacadas del mismo ruido periódico (sin costuras). Dos rocas: oscura para columna y paredes, clara para lo que se pisa.
- **La cueva** (`src/mundo/cueva.ts`): paredes vistas por dentro, suelo, niebla del color del fondo y 140 cristales emisivos instanciados (1 llamada, sin coste de luces).
- **Luces** (`src/mundo/escena.ts`): relleno hemisférico, sol inclinado con sombras que sigue a la cámara (decisión 015) y un farol puntual cálido sin sombras.
- **Entrada de teclado** (`src/nucleo/entrada.ts`) y **vista libre**: W/S o flechas suben y bajan la cámara a paso fijo.
- **Panel F3** (`src/ui/panel.ts`): llamadas de dibujo, triángulos, semilla y altura.
- **Captura** con `--ruta` para elegir semilla, altura y panel.

## Comprobaciones

- [x] **Misma semilla → misma torre**, semillas distintas → torres distintas (pruebas).
- [x] **Todos los huecos verticales miden 2-3 m**, incluidos suelo → primer saliente y último saliente → rellano: 60 semillas × 4 tramos (pruebas).
- [x] Giro de 30-50° y 2-3,6 m entre centros de salientes seguidos; 73-110 salientes por tramo (pruebas).
- [x] **Presupuesto:** 6-7 llamadas de dibujo (de 200) y ~3 600 triángulos (de 300 000), con sombras incluidas.
- [x] Capturas a 1,5 m y a 110 m de altura sin errores en la consola.

## Qué se le pidió a la IA

1. «Ok, adelante»: poner la etiqueta `sesion-01` y hacer la sesión 2 del plan (torre con semilla, luces y cueva).

## Qué falló y cómo se arregló

- **Demasiado oscuro** en la primera captura: el sol caía casi vertical y solo iluminaba las caras de arriba. Se inclinó a ~45° y se subió el relleno.
- **Los cristales salían blancos** en vez de azules: con mucha intensidad emisiva, el mapeo de tonos (ACES) los desatura. Se bajó la intensidad y se oscureció el color.
- **Los salientes se confundían con la columna** (misma roca). Se creó una segunda roca más clara para lo que se pisa (decisión 014).
- **Repartir los últimos metros**: si al final del tramo quedaban, por ejemplo, 3,5 m, no se podían partir en huecos de 2-3 m. El generador acota la separación cuando quedan menos de 7 m para que el último hueco siempre cumpla la regla.
- **Los fps de la captura (6-11)** son de SwiftShader, que dibuja por software: no sirven para medir rendimiento. Para eso, el panel F3 en un navegador normal.

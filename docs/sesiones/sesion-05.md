# Sesión 5 · La red: salas, semilla compartida y ver a los rivales

> 26-nov-2026 · etiqueta `sesion-05`

La página de esta sesión del curso aún no está publicada (da 404), así que se ha hecho a partir de `docs/diseno.md`.

## Qué queda hecho

- **Menú de inicio** (`src/ui/menu.ts`): jugar solo, crear sala o unirse con un código; el nombre se recuerda en el navegador.
- **Protocolo** (`src/red/protocolo.ts`, lógica pura): códigos de 4 letras sin I ni O, nombres limpios, anfitrión = el más antiguo, máximo 4 jugadores, estado empaquetado en 8 números.
- **Interpolación** (`src/red/interpolacion.ts`, lógica pura): los rivales se pintan donde estaban hace 150 ms, mezclando los dos estados de alrededor; la diferencia de reloj se estima sola.
- **Sala sobre Supabase Realtime** (`src/red/sala.ts`): un canal `sala:ABCD` con presencia (quién está, anfitrión y semilla) y difusión (estados 10 veces por segundo). Sin tablas y sin servidor propio.
- **Rivales** (`src/mundo/rivales.ts`): un escalador por rival, clonado con su esqueleto, con el nombre encima en su color.
- **Lista de la sala** (`src/ui/jugadores.ts`): código, jugadores ordenados por altura, ★ para el anfitrión.
- **Cada uno sale desde un sitio distinto** según su puesto en la sala.
- **Prueba con dos navegadores** (`npm run prueba-red`).

## Comprobaciones

- [x] 14 pruebas nuevas (64 en total): códigos, nombres, anfitrión y relevo, sala llena, codificar/decodificar, mensajes raros, interpolación continua con mensajes a trompicones, sin mensajes, giro por el camino corto y desordenados.
- [x] **Dos navegadores contra Supabase de verdad** (`npm run prueba-red`), todo a la primera:
  - Ana crea la sala y Beto entra: los dos ven a los dos.
  - Misma semilla (misma torre) y Ana es la anfitriona para los dos.
  - Beto corre 1,5 s: Ana le ve **a 0,00 m** de donde está de verdad cuando para.
  - Ana cierra el navegador: Beto se queda solo y **pasa a ser el anfitrión**.
- [x] Capturas de los dos lados con los nombres encima y la lista de la sala; captura del menú.
- [x] El modo solo y la captura de siempre siguen funcionando (con `?semilla=` no sale el menú).

## Qué se le pidió a la IA

1. «Ahora creo el proyecto en Supabase y te paso los datos»: crear el proyecto (lo hizo Gabi) y pasar la URL y la *publishable key*.
2. Montar la sesión 5 con esos datos.

## Qué falló y cómo se arregló

- **Supabase ha cambiado los nombres de las claves**: la antigua «anon key» ahora es la *Publishable key* (`sb_publishable_…`) y la «service_role» es la *Secret key*. Se usa solo la publicable.
- **La URL venía con `/rest/v1/`** al final: `configuracionRed` lo quita.
- **Claude Code no puede crear archivos `.env`** (protección de seguridad para claves). Para probar se pasaron como variables de entorno `VITE_…`, que Vite también lee; el `.env` lo crea Gabi.
- **La captura esperaba a que el juego pintara**, y con el menú delante eso no pasa nunca: ahora también vale «menú visible».
- **Varios escaladores con un solo modelo**: se clona con `SkeletonUtils.clone` (con `clone()` normal compartirían los huesos; tropiezo avisado en la sesión 3 del curso) y el modelo se descarga una sola vez.

## Pendiente para la sesión 6

Cuenta atrás y salida a la vez, meta a 220 m, reaparición en vez de fin de partida, orden de llegada decidido por el anfitrión, resultados y rivales del ordenador para llenar huecos.

# Vía al Cielo 3D

Juego de escalada vertical en 3D con **modo carrera multijugador**, hecho sesión a sesión con un agente de IA.

Es la versión 3D de [Vía al Cielo](https://gabi37smx.github.io/mi-web/juego.html) (2D, canvas), para el Proyecto 3 «Juego 3D multijugador» del Curso de Programación con IA.

- **Diseño:** [docs/diseno.md](docs/diseno.md)
- **Instrucciones para la IA:** [AGENTS.md](AGENTS.md)
- **Diario de sesiones:** [docs/sesiones/](docs/sesiones/)
- **Tecnología:** Vite + TypeScript + Three.js (y más adelante Rapier y Supabase)
- **Autor:** Gabriel Vidal Badia · 1º DAM

## Probarlo en local

Hace falta Node 24.

```
npm install
npm run dev
```

Y abrir la dirección que sale (normalmente http://localhost:5173).

| Control | Teclado y ratón | Mando |
|---|---|---|
| Moverse | WASD o flechas | stick izquierdo |
| Saltar / doble salto | Espacio (otra vez en el aire) | A |
| Girar la cámara | ratón (clic para capturarlo, Esc lo suelta) o Q/E | stick derecho |
| Panel de datos | F3 | — |

### Carrera (2-4 jugadores)

En el menú, uno pulsa **Crear sala** y dicta el código de 4 letras que sale abajo a la izquierda; los demás lo escriben y pulsan **Unirse**. Todos escalan la misma torre y se ven en tiempo real.

Necesita un proyecto de [Supabase](https://supabase.com) (gratis). Crea en la raíz un archivo `.env` con:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_CLAVE=sb_publishable_xxxxxxxx
```

(la *Publishable key*, nunca la secreta). Sin `.env` se puede jugar solo.

Con `?semilla=1234` en la dirección se ve siempre la misma torre, y con `?altura=100` se empieza a esa altura.

| Orden | Para qué |
|---|---|
| `npm test` | Pasar las pruebas |
| `npm run build` | Comprobar tipos y generar `dist/` |
| `npm run prueba-red` | Probar la carrera con dos navegadores automáticos |
| `npm run simular` | Simular subidas con el escalador del ordenador (equilibrio) |
| `npm run captura` | Guardar una captura del juego en `capturas/captura.png` (la primera vez: `npx playwright install chromium`) |

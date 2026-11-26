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

| Orden | Para qué |
|---|---|
| `npm test` | Pasar las pruebas |
| `npm run build` | Comprobar tipos y generar `dist/` |
| `npm run captura` | Guardar una captura del juego en `capturas/captura.png` (la primera vez: `npx playwright install chromium`) |

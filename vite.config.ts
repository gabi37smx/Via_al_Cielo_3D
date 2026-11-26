import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el juego se publica en una subcarpeta del servidor del centro.
  // Sin esto, la página sale en blanco porque busca los archivos en la raíz.
  base: './',
  build: {
    // Three.js solo ya ocupa ~550 kB; el aviso por defecto (500 kB) no aporta nada.
    chunkSizeWarningLimit: 1000,
  },
});

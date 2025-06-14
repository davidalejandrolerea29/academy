import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: { // <-- Añade este bloque
    minify: false, // <-- Deshabilita la minificación
    sourcemap: true, // <-- Habilita los sourcemaps para depuración
  },
});
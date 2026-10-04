import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  define: { __APP_BUILD_ID__: JSON.stringify('test-build') },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    testTimeout: 20_000,
    env: { VITE_API_URL: '/api' },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      // Todo el código de la aplicación. La cámara, MediaPipe, jsQR y Google Maps se prueban con
      // dobles (getUserMedia, detector y SDK simulados) además de la prueba real en navegador.
      include: ['src/**/*.{ts,tsx}'],
      // Solo lo que no tiene lógica en tiempo de ejecución: pruebas, utilidades de prueba y tipos.
      // Pantallas, layouts, cámara, mapas y el arranque se prueban como todo lo demás.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts', 'src/types/**'],
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
});

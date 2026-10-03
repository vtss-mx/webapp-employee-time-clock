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
      // Lógica testeable en unidad. Lo que depende de cámara/WASM (MediaPipe, getUserMedia,
      // jsQR sobre video) se valida con pruebas E2E en navegador real.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
        'src/hooks/useCamera.ts',
        'src/hooks/useFaceDetection.ts',
        'src/hooks/useQrScanner.ts',
        'src/components/CameraCapture.tsx',
        'src/components/LiveFaceFlow.tsx',
        'src/components/QrScanPanel.tsx',
        'src/components/FaceGuide.tsx',
        // SDK de Google Maps (script externo, mapa y consultas reales): se validan en navegador.
        'src/services/maps/googleMaps.ts',
        'src/components/location/MapCanvas.tsx',
        'src/pages/**',
        // Fábricas de carga diferida: cada una solo importa una pantalla (las pantallas ya se excluyen).
        'src/routes/lazyPages.ts',
        'src/layouts/**',
      ],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});

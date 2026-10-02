import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// VITE_DEV_HTTPS=true  -> servidor de desarrollo en HTTPS (necesario para usar la cámara
//                         desde un teléfono en la red local: getUserMedia exige contexto seguro).
// VITE_PROXY_TARGET    -> backend al que se redirige /api (usar VITE_API_URL=/api).
// VITE_ALLOWED_HOSTS   -> hosts extra permitidos (separados por coma). Los dominios de ngrok
//                         ya están permitidos para poder exponer el servidor de desarrollo.
const NGROK_HOSTS = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'];

// Identificador de esta compilación. La app compara el suyo con /version.json (que se genera
// junto al build) para detectar que se publicó una versión nueva y actualizarse sola: una
// pestaña abierta desde antes de un despliegue nunca sigue ejecutando código anterior.
const BUILD_ID = process.env.APP_BUILD_ID || new Date().toISOString();

function appVersion(): Plugin {
  return {
    name: 'app-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
    },
  };
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const https = env.VITE_DEV_HTTPS === 'true';
  return {
    plugins: [react(), appVersion(), ...(https ? [basicSsl()] : [])],
    define: { __APP_BUILD_ID__: JSON.stringify(BUILD_ID) },
    server: {
      host: true,
      port: 5173,
      allowedHosts: [
        ...NGROK_HOSTS,
        ...(env.VITE_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean),
      ],
      proxy: {
        // ws: true → también reenvía el canal WebSocket de validación (/api/ws/...).
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true, ws: true },
      },
    },
    preview: { host: true, port: 4173, allowedHosts: NGROK_HOSTS },
    build: { sourcemap: false },
  };
});

import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { build, defineConfig, loadEnv, type Plugin, type Rolldown } from 'vite';

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
/**
 * Aviso «Actualiza tu navegador» (decisión D-C1, `docs/rd/compatibilidad-biometria.md` §7): el guion
 * `src/compat/browserSupport.ts` se compila APARTE del paquete de la app (una compilación anidada de Vite en
 * formato IIFE, objetivo ES2015, con lo único que importa: `i18n/negotiation.ts`) y se inserta en línea al final
 * del `<body>`, como script clásico. Así corre en cualquier navegador ANTES de que el módulo principal intente
 * interpretarse; si al navegador le falta una capacidad, muestra el aviso de `index.html` en su idioma. En
 * desarrollo se compila una vez por arranque del servidor (un cambio en el guion pide reiniciarlo).
 */
const BROWSER_SUPPORT_ENTRY = 'src/compat/browserSupport.ts';
/** El guion que sondea los navegadores antiguos nunca puede traer una expresión regular LITERAL con *lookbehind*: no la interpretarían. */
const LOOKBEHIND = /\(\?<[=!]/;
/** Las cadenas del guion (la sonda misma es `new RegExp('(?<=a)b')`, un texto inofensivo). */
const STRING_LITERALS = /`[^`]*`|'[^']*'|"[^"]*"/g;

async function compileBrowserSupport(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      write: false,
      minify: true,
      target: 'es2015',
      lib: { entry: BROWSER_SUPPORT_ENTRY, formats: ['iife'], name: 'browserSupport', fileName: () => 'browser-support.js' },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
  const chunk = outputs[0].output.find((item): item is Rolldown.OutputChunk => item.type === 'chunk');
  // Errores de la compilación (para quien desarrolla, con su código): sin código no hay aviso; con lookbehind no correría.
  if (!chunk) throw new Error('BROWSER_SUPPORT_EMPTY_BUILD');
  if (LOOKBEHIND.test(chunk.code.replace(STRING_LITERALS, '""'))) throw new Error('BROWSER_SUPPORT_LOOKBEHIND');
  // Todo queda dentro de una función: la variable del IIFE no se vuelve global y el guion se ejecuta al cargar.
  return `(function(){${chunk.code}\nbrowserSupport.checkBrowserSupport();})();`;
}

function browserSupportNotice(): Plugin {
  let compiled: Promise<string> | null = null;
  return {
    name: 'browser-support-notice',
    async transformIndexHtml() {
      compiled ??= compileBrowserSupport();
      return [{ tag: 'script', children: await compiled, injectTo: 'body' }];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const https = env.VITE_DEV_HTTPS === 'true';
  return {
    plugins: [react(), appVersion(), browserSupportNotice(), ...(https ? [basicSsl()] : [])],
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

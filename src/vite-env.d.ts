/// <reference types="vite/client" />

/** Identificador de la compilación (vite.config.ts); se compara con /version.json. */
declare const __APP_BUILD_ID__: string;

// Las variables VITE_* (frontend/.env) se leen y validan en src/utils/config.ts.
interface ImportMetaEnv {
  readonly [key: `VITE_${string}`]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

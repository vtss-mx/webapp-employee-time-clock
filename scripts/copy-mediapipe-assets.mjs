// Copia los archivos WASM de MediaPipe a public/ y descarga el modelo de detección
// facial, para servirlos desde el mismo origen (sin depender de CDNs en tiempo de ejecución).
//
// El modelo se verifica con su SHA-256: es el único artefacto de IA que se ejecuta en el
// navegador de cada persona, y hasta el 2026-10-10 viajaba sin comprobar su huella (riesgo R-34
// del registro de riesgos). Un modelo alterado decide qué rostro se encuadra y cuándo se captura,
// así que servirlo sin verificar es peor que no servirlo: el resto del flujo sigue funcionando sin
// él, porque la detección que cuenta para verificar una identidad la vuelve a hacer el servidor
// con YuNet. La política es la misma que ya aplica `app/speech/model_store.py` del backend a los
// cuatro archivos de Whisper.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'mediapipe');
const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
// Huella fijada el 2026-10-10 tras comprobar que la copia servida desde el 2026-09-30 y una
// descarga nueva del origen oficial son idénticas byte a byte (dos muestras independientes).
const MODEL_SHA256 = 'b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f';
const MODEL_BYTES = 229746;
const modelPath = join(target, 'blaze_face_short_range.tflite');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

mkdirSync(target, { recursive: true });

if (existsSync(wasmSource)) {
  cpSync(wasmSource, join(target, 'wasm'), { recursive: true });
  console.log('[mediapipe] WASM copiado a public/mediapipe/wasm');
} else {
  console.warn('[mediapipe] No se encontró', wasmSource);
}

// Un archivo que ya está pero no coincide con su huella no se reutiliza ni se "arregla": se borra.
if (existsSync(modelPath)) {
  const found = sha256(readFileSync(modelPath));
  if (found !== MODEL_SHA256) {
    rmSync(modelPath);
    console.error(
      `[mediapipe] El modelo local NO coincide con su huella (esperada ${MODEL_SHA256}, encontrada ${found}).` +
        ' Se eliminó: no se sirve un modelo alterado.',
    );
    process.exit(1);
  }
  console.log('[mediapipe] Modelo ya presente y verificado (SHA-256 correcto)');
} else {
  let downloaded;
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    downloaded = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    // Sin red o con el origen caído no se puede verificar nada, y tampoco hay nada que servir:
    // la app arranca sin la guía de captura y el servidor sigue verificando. No es una falla.
    console.warn('[mediapipe] No se pudo descargar el modelo:', error.message);
  }
  if (downloaded) {
    const found = sha256(downloaded);
    if (found !== MODEL_SHA256 || downloaded.length !== MODEL_BYTES) {
      // Aquí sí se falla: el origen respondió algo que no es lo que se auditó.
      console.error(
        `[mediapipe] La descarga NO coincide con lo auditado (SHA-256 esperado ${MODEL_SHA256},` +
          ` encontrado ${found}; ${MODEL_BYTES} bytes esperados, ${downloaded.length} recibidos).` +
          ' No se escribe el archivo.',
      );
      process.exit(1);
    }
    writeFileSync(modelPath, downloaded);
    console.log('[mediapipe] Modelo descargado y verificado en public/mediapipe');
  }
}

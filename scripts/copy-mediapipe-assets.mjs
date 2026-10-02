// Copia los archivos WASM de MediaPipe a public/ y descarga el modelo de detección
// facial, para servirlos desde el mismo origen (sin depender de CDNs en tiempo de ejecución).
// Si la descarga del modelo falla, la app usa la URL remota como respaldo.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'mediapipe');
const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const modelPath = join(target, 'blaze_face_short_range.tflite');

mkdirSync(target, { recursive: true });

if (existsSync(wasmSource)) {
  cpSync(wasmSource, join(target, 'wasm'), { recursive: true });
  console.log('[mediapipe] WASM copiado a public/mediapipe/wasm');
} else {
  console.warn('[mediapipe] No se encontró', wasmSource);
}

if (!existsSync(modelPath)) {
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    writeFileSync(modelPath, Buffer.from(await response.arrayBuffer()));
    console.log('[mediapipe] Modelo descargado en public/mediapipe');
  } catch (error) {
    console.warn('[mediapipe] No se pudo descargar el modelo (se usará la URL remota):', error.message);
  }
}

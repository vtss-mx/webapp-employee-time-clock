import { config } from '../../utils/config';
import { deviceProof } from '../../utils/deviceKey';
import type { FaceBurst } from '../../utils/faceBurst';
import { apiRequest } from '../apiClient';

/** Reto de prueba de vida respondido: su id y una captura por cada movimiento, en orden. */
export interface FaceChallengeCapture {
  id: string;
  images: Blob[];
}

/** Lo que la cámara entrega en un intento facial (registro, verificación o identificación). */
export interface FaceCaptures {
  frontal: Blob[];
  challenge?: FaceChallengeCapture;
  /** Una captura por cada color del destello del reto, en el orden en que se pintaron. */
  flash?: Blob[];
  /** Nombre de la cámara usada (el backend rechaza las cámaras virtuales). */
  camera?: string;
  /** Telemetría de la toma (JSON, `utils/captureTelemetry.ts`): señales del motor de riesgo, solo números. */
  telemetry?: string;
  /** Reto que firma la llave de este dispositivo (`device_nonce` del reto; solo del propio empleado, decisión D2). */
  deviceNonce?: string;
  /** Antifraude 2a: la hoja de la ráfaga de recortes del rostro y el comprobante del destello dictado por el servidor. */
  burst?: FaceBurst;
  flashReceipt?: string;
}

/**
 * Multipart con las capturas frontales, las del reto (una por movimiento), las del destello (una por
 * color; el orden importa: el servidor compara cada una con el color que se pintó, y con el destello dictado, con la
 * huella que se comprometió), la ráfaga, la cámara y la telemetría.
 */
export function buildFaceForm({ frontal, challenge, flash = [], camera, telemetry, burst, flashReceipt }: FaceCaptures, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  Object.entries(extra).forEach(([key, value]) => form.append(key, value));
  frontal.forEach((image, i) => form.append('images', image, `frontal-${i + 1}.jpg`));
  if (challenge) {
    form.append('challenge_id', challenge.id);
    challenge.images.forEach((image, i) => form.append('challenge_image', image, `challenge-${i + 1}.jpg`));
    flash.forEach((image, i) => form.append('flash_image', image, `flash-${i + 1}.jpg`));
    if (flashReceipt) form.append('flash_receipt', flashReceipt);
    if (burst) {
      form.append('burst', burst.image, 'burst.jpg');
      form.append('burst_meta', burst.meta);
    }
  }
  if (camera) form.append('camera_label', camera.slice(0, 200));
  if (telemetry) form.append('telemetry', telemetry);
  return form;
}

/**
 * La prueba del dispositivo: la llave no exportable de este navegador (la misma de los validadores) firma el reto.
 * Sin WebCrypto o sin IndexedDB (p. ej. una ventana privada) se envía sin ella: el servidor lo anota como señal y
 * el registro sigue (nunca se rechaza por la llave).
 */
async function deviceFields(nonce: string | undefined): Promise<Record<string, string>> {
  if (!nonce) return {};
  try {
    const proof = await deviceProof(nonce, '');
    return { device_key: proof.public_key, device_nonce: proof.nonce, device_signature: proof.signature };
  } catch {
    return {}; // accesorio: su ausencia ya es una señal del servidor (DEVICE_KEY_MISSING)
  }
}

/** Envío de capturas faciales (registro o verificación) con el tiempo límite de subida. */
export async function postFaceCaptures<T>(path: string, captures: FaceCaptures, validate: (data: unknown) => data is T, extra: Record<string, string> = {}): Promise<T> {
  const device = await deviceFields(captures.deviceNonce);
  return apiRequest<T>(path, {
    method: 'POST',
    body: buildFaceForm(captures, { ...extra, ...device }),
    timeoutMs: config.apiUploadTimeoutMs,
    validate,
  });
}

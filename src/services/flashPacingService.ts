/**
 * Destello dictado por el servidor (antifraude 2a; backend `app/services/flash_pacing.py`).
 *
 * El reto ya no trae los colores: con su token (`flash_pace.token`) la app pide el primero por el canal en vivo; pinta
 * la pantalla, captura el cuadro y responde con la HUELLA SHA-256 de esa captura, y el servidor revela el siguiente; tras
 * el último entrega un comprobante que viaja con las capturas. Así nadie puede preparar los fotogramas antes de conocer
 * su color. Sin canal (red que bloquea WebSocket) se piden los colores de siempre por HTTP: el intento sigue y el
 * servidor solo lo anota.
 */
import { isRecord } from '../utils/guards';
import { apiRequest } from './apiClient';
import { ApiError } from './http/envelope';
import { validationSocket } from './realtime/validationSocket';

/** El siguiente color a pintar (con el token para responderlo) o el comprobante final. */
export type FlashStep = { kind: 'color'; color: string; token: string; step: number; total: number } | { kind: 'done'; receipt: string };

const isColor = (data: unknown): data is { color: string; token: string; step: number; total: number } =>
  isRecord(data) && typeof data.color === 'string' && typeof data.token === 'string' && typeof data.step === 'number' && typeof data.total === 'number';
const isDone = (data: unknown): data is { receipt: string } => isRecord(data) && typeof data.receipt === 'string';
const isColors = (data: unknown): data is { flash: string[] } => isRecord(data) && Array.isArray(data.flash) && data.flash.every((c) => typeof c === 'string');

/** La huella SHA-256 (hexadecimal) de una captura: lo que se compromete por el canal (WebCrypto, contexto seguro). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const flashPacingService = {
  /** Un paso por el canal en vivo: sin huella, el primer color; con la huella del color en curso, el siguiente o el comprobante. */
  async step(token: string, digest?: string): Promise<FlashStep> {
    const envelope = await validationSocket.request({ type: 'flash', token, ...(digest ? { digest } : {}) });
    if (!envelope.success) throw new ApiError(envelope);
    const { data } = envelope;
    if (envelope.code === 'FLASH_COLOR' && isColor(data)) return { kind: 'color', ...data };
    if (envelope.code === 'FLASH_DONE' && isDone(data)) return { kind: 'done', receipt: data.receipt };
    throw new Error('Respuesta inesperada del destello');
  },

  /** Respaldo sin canal en vivo: los colores de siempre del reto (el servidor anota que no fueron dictados). */
  async fallbackColors(token: string): Promise<string[]> {
    const data = await apiRequest<{ flash: string[] }>('/face/challenge/flash', { method: 'POST', body: { token }, validate: isColors });
    return data.flash;
  },
};

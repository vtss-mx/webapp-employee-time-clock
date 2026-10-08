import { hasKeys } from '../utils/guards';
import { ApiError, apiRequest, type ApiEnvelope } from './apiClient';
import { validationSocket } from './realtime/validationSocket';

/**
 * Cliente del destello dictado por el servidor (antifraude 2a; `backend-employee-time-clock/app/services/flash_pacing.py`).
 *
 * Reutiliza el MISMO canal en vivo que la validación de campos (`validationSocket`, `/api/ws/validation`): tras el
 * saludo de autenticación, cada mensaje `{type:'flash', ...}` avanza la secuencia sin tocar la base (el estado va
 * sellado en el token, así cualquier réplica lo continúa). La app:
 *   1. pide el PRIMER color con el token del reto (`flash_pace.token`), sin huella;
 *   2. pinta ese color, captura UN cuadro y responde su huella SHA-256 (dentro de `window_ms`) con el token del paso
 *      anterior; el servidor revela el siguiente color (token nuevo);
 *   3. tras el último color, el servidor entrega el COMPROBANTE (`receipt`), que viaja con las capturas.
 *
 * Sin canal (un proxy que bloquea WebSocket, una red inestable) la app pide los colores de siempre por HTTP
 * (`POST /api/face/challenge/flash`) y los pinta en claro: el servidor marca el intento FLASH_UNPACED (lo mide, nunca
 * lo rechaza). Nunca se abre un segundo socket (regla 6): esta capa solo envía mensajes por el canal ya existente.
 */

/** Un color del destello que el servidor reveló: su posición, cuántos son, el color (#RRGGBB), el token siguiente y la ventana. */
export interface FlashColor {
  step: number;
  total: number;
  color: string;
  token: string;
  window_ms: number;
}

/** La respuesta a un mensaje del destello: el siguiente color o, tras el último, el comprobante. */
export type FlashStep = { done: false; color: FlashColor } | { done: true; receipt: string };

const isColor = hasKeys<FlashColor>('color', 'token', 'total', 'step');
const isReceipt = hasKeys<{ receipt: string }>('receipt');
const isColors = hasKeys<{ flash: string[] }>('flash');

/** El sobre del canal (`FLASH_COLOR`/`FLASH_DONE`) o su error (422 FLASH_TOKEN_INVALID, 403 FORBIDDEN...). */
function fromEnvelope(envelope: ApiEnvelope): FlashStep {
  if (!envelope.success) throw new ApiError(envelope);
  if (envelope.code === 'FLASH_DONE' && isReceipt(envelope.data)) return { done: true, receipt: envelope.data.receipt };
  if (envelope.code === 'FLASH_COLOR' && isColor(envelope.data)) return { done: false, color: envelope.data };
  throw new Error('FLASH_BAD_RESPONSE');
}

export const flashPacingService = {
  /** ¿Se puede dictar por el canal en vivo? (si no, el respaldo HTTP pinta los colores de siempre). */
  get available(): boolean {
    return validationSocket.available;
  },

  /**
   * Un paso de la secuencia por el canal: sin huella revela el PRIMER color; con la huella del color en curso lo
   * confirma y revela el siguiente (o entrega el comprobante tras el último). La promesa se rechaza ante cualquier
   * falla del canal (tiempo límite, cierre, token inválido): quien llama cae al respaldo HTTP.
   */
  async step(token: string, digest?: string): Promise<FlashStep> {
    const message = digest === undefined ? { type: 'flash', token } : { type: 'flash', token, digest };
    return fromEnvelope(await validationSocket.request(message));
  },

  /** Respaldo sin canal: los colores de siempre del token inicial (el intento se marca FLASH_UNPACED, nunca un rechazo). */
  async fallbackColors(token: string): Promise<string[]> {
    const data = await apiRequest<{ flash: string[] }>('/face/challenge/flash', {
      method: 'POST',
      body: { token },
      retries: 0,
      validate: isColors,
    });
    return data.flash;
  },
};

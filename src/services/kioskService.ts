/**
 * Kiosco de un sitio (antifraude 2b; pantalla pública `/kiosk`, sin sesión): la tableta se vincula UNA vez con el
 * código que generó la empresa y su llave pública (`utils/deviceKey.ts`, no exportable); después pide el código del
 * sitio firmando cada vez el reto del servidor. Sin sesión: nada viaja con `Authorization`.
 */
import type { KioskCode, KioskSession } from '../types';
import { devicePublicKey, signMessage } from '../utils/deviceKey';
import { isRecord } from '../utils/guards';
import { describeDevice } from '../utils/userAgent';
import { ApiError, apiRequest } from './apiClient';
import { errorDetail } from './http/requestSigning';

const isSession = (value: unknown): value is KioskSession =>
  isRecord(value) && typeof value.kiosk_id === 'number' && typeof value.site_name === 'string' && typeof value.company_name === 'string';

const isCode = (value: unknown): value is KioskCode =>
  isRecord(value) &&
  typeof value.code === 'string' &&
  typeof value.qr === 'string' &&
  typeof value.expires_in === 'number' &&
  typeof value.period_seconds === 'number' &&
  typeof value.site_name === 'string' &&
  typeof value.company_name === 'string';

/** El servidor pide (otra vez) la prueba: trae el reto nuevo en `details.nonce` y se firma sin avisar. */
const PROOF_CODES: ReadonlySet<string> = new Set(['KIOSK_PROOF_REQUIRED', 'KIOSK_PROOF_INVALID']);

/** La prueba de la tableta: su llave firma `"{reto}.kiosk.{kiosk_id}"`. Sin reto o sin llave, no hay prueba. */
async function proof(nonce: string | null, kioskId: number): Promise<{ nonce?: string; signature?: string }> {
  if (!nonce) return {};
  try {
    return { nonce, signature: (await signMessage(`${nonce}.kiosk.${kioskId}`)).signature };
  } catch {
    return {}; // sin llave: el servidor responde KIOSK_PROOF_REQUIRED y la pantalla reintenta con calma
  }
}

export const kioskService = {
  /**
   * Vincula esta tableta con el código de un solo uso (`XXXXX-XXXXX`). Sin llave del dispositivo (ventana privada,
   * sin IndexedDB) no se puede vincular: el error (`DeviceKeyError`) lo explica.
   */
  async pair(pairingCode: string): Promise<KioskSession> {
    const publicKey = await devicePublicKey();
    return apiRequest<KioskSession>('/kiosk/pair', {
      method: 'POST',
      auth: false,
      body: { pairing_code: pairingCode.trim().toUpperCase(), public_key: publicKey, name: describeDevice(navigator.userAgent).label },
      validate: isSession,
    });
  },

  /**
   * El código vigente del sitio. Firma el reto que se tiene; si el servidor pide la prueba (sin reto, o vencido o
   * alterado), firma el reto nuevo de su detalle y reintenta UNA vez sola, sin avisar.
   */
  async code(kioskId: number, nonce: string | null, signal?: AbortSignal): Promise<KioskCode> {
    const send = async (current: string | null) =>
      apiRequest<KioskCode>('/kiosk/code', { method: 'POST', auth: false, signal, body: { kiosk_id: kioskId, ...(await proof(current, kioskId)) }, validate: isCode });
    try {
      return await send(nonce);
    } catch (error) {
      const next = errorDetail(error, 'nonce');
      if (!next || !(error instanceof ApiError && PROOF_CODES.has(error.code))) throw error;
      return send(next);
    }
  },
};

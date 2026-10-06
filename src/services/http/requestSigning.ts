/**
 * Firma por petición del validador (antifraude 2b): cada identificación (rostro, QR y "de quién es este QR") viaja
 * firmada por la llave NO exportable del dispositivo con que el validador inició sesión (`utils/deviceKey.ts`). El
 * mensaje es `"{reto}.{acción}.{huella}"`: el reto lo da el servidor y sirve para varias identificaciones mientras no
 * vence; lo que hace única cada firma es la huella SHA-256 de lo que se envía (la primera captura frontal o el texto
 * del QR). Así nadie puede repetir una petición ni mandarla desde otro equipo con la sesión robada.
 *
 * El reto vive SOLO en memoria (nunca en Web Storage): llega con el perfil del punto de control, con cada respuesta y
 * con los errores de firma, y se renueva solo. Sin llave (ventana privada, sin IndexedDB) la petición sale sin firma:
 * el servidor la mide o la rechaza según la política; la app nunca bloquea ni avisa por eso.
 */
import { config } from '../../utils/config';
import { requestSignature, type RequestSignature } from '../../utils/deviceKey';
import { ApiError } from './envelope';

/** Qué se firma: `face` (identificar por rostro), `qr` (identificar por QR), `inspect` (de quién es un QR). */
export type SignedAction = 'face' | 'qr' | 'inspect';

/**
 * El reto vigente: `undefined` mientras el servidor no dice si pide firma (aún no llega el perfil), `null` si la
 * empresa no la pide y el texto del reto si la pide.
 */
let current: string | null | undefined;

/** Cuándo vence un reto (`{vence_epoch_segundos}.{sal}.{mac}`), en ms; sin una fecha legible, null. */
export function nonceExpiry(nonce: string): number | null {
  const seconds = Number(nonce.split('.', 1)[0]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/** Un dato de texto del detalle de un error del servidor (p. ej. el reto nuevo); null si no viene. */
export function errorDetail(error: unknown, key: string): string | null {
  const value = error instanceof ApiError ? error.details?.[key] : undefined;
  return typeof value === 'string' && value ? value : null;
}

export const signingNonce = {
  /** Lo que dijo el servidor: un reto nuevo, `null` (la empresa no pide firma) o nada (`undefined`: no cambia). */
  remember(nonce: unknown): void {
    if (typeof nonce === 'string' && nonce) current = nonce;
    else if (nonce === null) current = null;
  },

  /** Olvida el reto (otra sesión): el siguiente se pide al servidor. */
  reset(): void {
    current = undefined;
  },

  /** Hay que pedir uno antes de firmar: aún no se sabe si se firma o el vigente vence en menos del margen. */
  stale(now = Date.now()): boolean {
    if (current === undefined) return true;
    const expires = current === null ? null : nonceExpiry(current);
    return expires !== null && expires - now < config.checkpointNonceMarginMs;
  },

  /** El reto con que se firma ahora (null: sin firma). */
  value(): string | null {
    return current ?? null;
  },
};

/** Los campos de la firma de una petición, o ninguno si no hay reto o el dispositivo no puede firmar. */
async function signatureOf(nonce: string | null, action: SignedAction, digest: () => Promise<string>): Promise<Partial<RequestSignature>> {
  if (!nonce) return {};
  try {
    return await requestSignature(nonce, `${nonce}.${action}.${await digest()}`);
  } catch {
    return {}; // sin llave o sin WebCrypto: sale sin firma y el servidor lo mide (nunca se bloquea ni se avisa)
  }
}

/**
 * Envía una petición firmada. Antes, si hace falta, pide un reto fresco (`refresh`: el perfil del punto de control;
 * si falla, se firma con lo que haya: decide el servidor). Si el servidor responde que el reto venció (o que falta la
 * firma cuando no había reto que usar), reintenta UNA vez sola con el reto nuevo de su detalle, sin avisar: el error
 * llega antes de consumir el reto o el QR, así que la misma petición vale.
 */
export async function sendSigned<T>(
  action: SignedAction,
  digest: () => Promise<string>,
  refresh: () => Promise<unknown>,
  send: (signature: Partial<RequestSignature>) => Promise<T>,
): Promise<T> {
  if (signingNonce.stale()) await refresh().catch(() => undefined); // accesorio: sin perfil se firma con lo que haya
  const nonce = signingNonce.value();
  try {
    return await send(await signatureOf(nonce, action, digest));
  } catch (error) {
    const next = errorDetail(error, 'device_nonce');
    signingNonce.remember(next ?? undefined);
    // Se resuelve solo con el reto nuevo: venció, o faltaba la firma porque no había reto (la empresa empezó a pedirla).
    const code = error instanceof ApiError ? error.code : '';
    if (!next || !(code === 'SIGNATURE_STALE' || (code === 'SIGNATURE_REQUIRED' && nonce === null))) throw error;
    return send(await signatureOf(next, action, digest));
  }
}

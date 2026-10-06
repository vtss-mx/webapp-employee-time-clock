// Kioscos de los sitios (antifraude 2b): la tableta de un sitio muestra un código que cambia solo; el empleado lo
// escanea o lo escribe al checar su entrada y su salida. La empresa los administra desde sus sitios
// (`/company/sites/:id/kiosks`); la tableta usa la ruta pública `/kiosk` (sin sesión, con la llave del dispositivo).
import type { Page } from './index';
import type { SoftDeleted } from './trash';

/** Un kiosco de un sitio: si ya hay una tableta vinculada, cuál y cuándo se vio por última vez. */
export interface Kiosk extends SoftDeleted {
  id: number;
  site_id: number;
  name: string;
  paired: boolean;
  paired_at: string | null;
  /** Nombre de la tableta vinculada (navegador y sistema). */
  device_name: string | null;
  last_seen_at: string | null;
  /** Hasta cuándo sirve el código de vinculación pendiente (null si no hay uno). */
  pairing_expires_at: string | null;
  created_at: string;
}

export type KioskList = Page<Kiosk>;

/**
 * Kiosco recién creado o con un código de vinculación nuevo. El código se entrega UNA sola vez (en la BD solo
 * queda su huella): la pantalla lo muestra en un popup que solo se cierra confirmando que se guardó.
 */
export interface KioskCreated {
  kiosk: Kiosk;
  /** `XXXXX-XXXXX` (letras y números sin ambigüedad). */
  pairing_code: string;
  pairing_expires_at: string;
}

/** La tableta ya vinculada: a qué sitio y empresa pertenece y el reto que firma al pedir su primer código. */
export interface KioskSession {
  kiosk_id: number;
  site_name: string;
  company_name: string;
  device_nonce: string;
}

/** El código vigente del sitio: los 6 dígitos, el texto de su QR y cuándo cambia. */
export interface KioskCode {
  site_name: string;
  company_name: string;
  /** Seis dígitos ("123456"). */
  code: string;
  /** `TC-SITE:{site_id}:{code}`: lo que lee el teléfono del empleado. */
  qr: string;
  /** Vida completa de cada código (s). */
  period_seconds: number;
  /** Segundos para que cambie. */
  expires_in: number;
  /** El siguiente reto que firma la tableta. */
  device_nonce: string;
}

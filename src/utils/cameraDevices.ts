/**
 * Elección de cámara (reglas puras, sin MediaStream): qué cámara abrir, a cuál cambiar, cuál
 * recordar y cómo nombrarla. La usa el hook useCamera.
 */
import { t } from '../i18n/core';

export type CameraFacing = 'user' | 'environment';
export type CameraKind = 'front' | 'back' | 'unknown';

export interface CameraDevice {
  deviceId: string;
  label: string;
  rawLabel: string;
  kind: CameraKind;
}

/** Cámara a abrir: un dispositivo concreto o un lado (frontal/trasera) exacto. Vacío = la preferida. */
export interface CameraTarget {
  deviceId?: string;
  facing?: CameraFacing;
}

/** Cámara recordada para un propósito (rostro o QR). */
export interface RememberedCamera {
  deviceId: string;
  kind: CameraKind;
}

const FRONT_RE = /front|frontal|user|selfie|delantera|facing front|facetime/i;
const BACK_RE = /back|rear|trasera|posterior|environment|facing back/i;
const FACING_KIND: Record<CameraFacing, CameraKind> = { user: 'front', environment: 'back' };

export function detectKind(label: string): CameraKind {
  if (FRONT_RE.test(label)) return 'front';
  if (BACK_RE.test(label)) return 'back';
  return 'unknown';
}

/** Lado de la cámara abierta: el que informa el navegador (facingMode) o, si no, su nombre. */
export function activeKind(facingMode: string | undefined, label: string): CameraKind {
  if (facingMode === 'user') return 'front';
  if (facingMode === 'environment') return 'back';
  return detectKind(label);
}

/** Nombre de la cámara abierta para el visor, en el idioma activo. */
export function kindLabel(kind: CameraKind): string {
  return t(`face.camera.kinds.${kind}`);
}

/** Etiquetas legibles en el idioma activo: "Cámara frontal", "Cámara trasera 2", "Cámara 1"... (se piden al dibujarse). */
export function toCameraDevices(inputs: Array<Pick<MediaDeviceInfo, 'deviceId' | 'label'>>): CameraDevice[] {
  const counters = { front: 0, back: 0, unknown: 0 };
  const totals = { front: 0, back: 0, unknown: 0 };
  inputs.forEach((d) => totals[detectKind(d.label)]++);
  return inputs.map((d) => {
    const kind = detectKind(d.label);
    const n = ++counters[kind];
    const base = kindLabel(kind);
    const label = kind === 'unknown' || totals[kind] > 1 ? t('face.camera.numbered', { name: base, number: n }) : base;
    return { deviceId: d.deviceId, label, rawLabel: d.label, kind };
  });
}

/**
 * Restricciones para getUserMedia. Un lado exacto (al cambiar de cámara en el teléfono) deja que
 * el sistema elija la lente principal de ese lado, no una ultra gran angular o telefoto.
 */
export function cameraConstraints(preferred: CameraFacing, target: CameraTarget = {}): MediaStreamConstraints {
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
  if (target.deviceId) return { audio: false, video: { ...size, deviceId: { exact: target.deviceId } } };
  const facingMode = target.facing ? { exact: target.facing } : { ideal: preferred };
  return { audio: false, video: { ...size, facingMode } };
}

/**
 * Cámara siguiente al pulsar "Cambiar cámara": en teléfonos y tabletas (con frontal y trasera)
 * alterna de lado; en computadoras con varias webcams, pasa a la siguiente. null si solo hay una.
 */
export function switchTarget(devices: CameraDevice[], activeId: string | null, current: CameraKind): CameraTarget | null {
  if (devices.length < 2) return null;
  const sided = devices.some((d) => d.kind === 'front') && devices.some((d) => d.kind === 'back');
  if (sided && current !== 'unknown') return { facing: current === 'front' ? 'environment' : 'user' };
  const index = devices.findIndex((d) => d.deviceId === activeId);
  return { deviceId: devices[(index + 1) % devices.length].deviceId };
}

/** Cámara guardada en el dispositivo (IndexedDB guarda el objeto tal cual); sin id o sin lado se ignora. */
export function parseRemembered(value: unknown): RememberedCamera | null {
  if (typeof value !== 'object' || value === null) return null;
  const { deviceId, kind } = value as Partial<RememberedCamera>;
  return typeof deviceId === 'string' && deviceId && kind ? { deviceId, kind } : null;
}

/**
 * La cámara recordada solo se reabre si sirve para el propósito (frontal para el rostro, trasera
 * para el QR) o si no tiene lado (webcams de computadora). Si en el escáner facial se cambió a la
 * trasera, la próxima vez vuelve a abrir la frontal.
 */
export function rememberedFor(remembered: RememberedCamera | null, facing: CameraFacing): string | undefined {
  if (!remembered) return undefined;
  return remembered.kind === 'unknown' || remembered.kind === FACING_KIND[facing] ? remembered.deviceId : undefined;
}

/** Espejo solo para cámara frontal (o webcam única de laptop/PC). */
export function shouldMirror(kind: CameraKind, facing: CameraFacing, deviceCount: number): boolean {
  return kind === 'front' || (kind === 'unknown' && facing === 'user' && deviceCount <= 1);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Cámara virtual: programa que finge ser una cámara (OBS, ManyCam...) y puede transmitir un video o
 * una foto. Su nombre contiene uno de los bloqueados como palabra completa ("OBSBOT" no es "obs").
 * La lista viene del backend (política de verificación), que también la exige al recibir capturas.
 */
export function isVirtualCamera(label: string | null | undefined, blocked: readonly string[]): boolean {
  if (!label) return false;
  const text = label.toLowerCase();
  return blocked.some((name) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(name.toLowerCase())}(?![\\p{L}\\p{N}_])`, 'u').test(text));
}

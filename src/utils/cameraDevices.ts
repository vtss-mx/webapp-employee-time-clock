/**
 * Elección de cámara (reglas puras, sin MediaStream): qué cámara abrir, a cuál cambiar, cuál
 * recordar y cómo nombrarla. La usa el hook useCamera.
 */
import { t } from '../i18n/core';
import { foldText } from './text';

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

const FACING_KIND: Record<CameraFacing, CameraKind> = { user: 'front', environment: 'back' };

/** Cámara recordada para un propósito (rostro o QR). */
export interface RememberedCamera {
  deviceId: string;
  kind: CameraKind;
}

/*
 * Nombres de las cámaras. El sistema operativo nombra las cámaras del propio equipo en SU idioma, no en el de la
 * app: un iPhone en inglés dice «Front Camera» o «Back Ultra Wide Camera» aunque la app esté en español; Android,
 * «camera2 1, facing front»; una Mac, «FaceTime HD Camera»; Windows, «Integrated Camera». Mostrarlos tal cual
 * mezclaría idiomas (regla 16). Por eso un nombre hecho solo de palabras genéricas (en los idiomas comunes de los
 * sistemas: inglés, español, portugués, francés, alemán e italiano) se reconoce por su lado y su lente y se
 * muestra con el texto de la app en el idioma activo («Cámara trasera (ultra gran angular)» · «Back camera (ultra
 * wide)»). Una cámara externa con marca y modelo («Logitech BRIO») se muestra con su nombre: es un nombre propio.
 * El nombre original sigue en `rawLabel` (lo usan las reglas que reconocen cámaras virtuales).
 */

/** Palabras (en minúsculas y sin acentos) que dicen que la cámara es la frontal. */
const FRONT_WORDS = new Set(['front', 'frontal', 'frontale', 'delantera', 'frente', 'user', 'selfie', 'facetime', 'truedepth', 'avant', 'vorder', 'vorderseite', 'frontkamera', 'anteriore']);
/** Palabras que dicen que la cámara es la trasera. */
const BACK_WORDS = new Set(['back', 'rear', 'environment', 'trasera', 'traseira', 'posterior', 'posteriore', 'arriere', 'ruck', 'ruckseite', 'ruckkamera', 'hinten', 'retro']);
/** Palabras de una lente gran angular (con «ultra», ultra gran angular). */
const WIDE_WORDS = ['wide', 'angular', 'grandangolo'];
/** Lentes, de la más específica a la más general (la primera que aparece manda). */
const LENS_WORDS: Array<[CameraLens, string[]]> = [
  ['triple', ['triple', 'tripla']],
  ['dual', ['dual', 'doble', 'duo']],
  ['ultraWide', ['ultrawide']],
  ['telephoto', ['telephoto', 'teleobjetivo', 'telefoto', 'teleobiettivo', 'tele']],
  ['wide', WIDE_WORDS],
];

/** La lente que nombra el sistema, si la nombra. */
function lensOf(words: ReadonlySet<string>): CameraLens | undefined {
  const has = (list: string[]) => list.some((word) => words.has(word));
  if (words.has('ultra') && has(WIDE_WORDS)) return 'ultraWide';
  return LENS_WORDS.find(([, list]) => has(list))?.[0];
}
/** El resto de las palabras genéricas de un nombre del sistema (cámara, integrada, HD, USB...). */
const GENERIC_WORDS = new Set([
  ...FRONT_WORDS,
  ...BACK_WORDS,
  ...['ultra', 'ultrawide', 'wide', 'angular', 'gran', 'grande', 'grandangolo', 'telephoto', 'teleobjetivo', 'telefoto', 'teleobiettivo', 'tele'],
  ...['dual', 'doble', 'duo', 'triple', 'tripla', 'camera', 'camara', 'camera2', 'cam', 'webcam', 'kamera', 'fotocamera', 'facing', 'lens', 'lente'],
  ...['integrated', 'integrada', 'integrado', 'integree', 'integriert', 'integrata', 'built', 'builtin', 'in', 'internal', 'interna', 'interno'],
  ...['hd', 'fhd', 'uhd', 'usb', 'uvc', 'video', 'device', 'dispositivo', 'desk', 'view', 'de', 'del', 'con', 'la', 'el', 'the', 'of', 'with'],
]);
/** Identificador USB del fabricante y el modelo que algunos navegadores agregan: «Logitech BRIO (046d:085e)». */
const USB_ID = /\s*\([0-9a-f]{4}:[0-9a-f]{4}\)/gi;

export type CameraLens = 'wide' | 'ultraWide' | 'telephoto' | 'dual' | 'triple';

/** Las palabras de un nombre, en minúsculas y sin acentos («Cámara trasera» → camara, trasera). */
function wordsOf(label: string): string[] {
  return foldText(label)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function detectKind(label: string): CameraKind {
  const words = wordsOf(label);
  if (words.some((word) => FRONT_WORDS.has(word))) return 'front';
  return words.some((word) => BACK_WORDS.has(word)) ? 'back' : 'unknown';
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

/**
 * Nombre de una cámara en el idioma activo: el de la app si el sistema la nombra con palabras genéricas (su lado
 * y su lente), o su nombre propio si es un modelo con marca. Sin nombre (antes del permiso), "Cámara".
 */
export function cameraName(label: string): string {
  const proper = label.replace(USB_ID, '').trim();
  const words = wordsOf(proper);
  const generic = words.every((word) => GENERIC_WORDS.has(word) || /^\d+$/.test(word));
  if (!generic) return proper;
  const kind = detectKind(proper);
  const lens = lensOf(new Set(words));
  return lens ? t('face.camera.withLens', { camera: kindLabel(kind), lens: t(`face.camera.lenses.${lens}`) }) : kindLabel(kind);
}

/**
 * Etiquetas legibles en el idioma activo (se piden al dibujarse): "Cámara frontal", "Cámara trasera (ultra gran
 * angular)", "Logitech BRIO"... Dos con el mismo nombre se numeran ("Cámara 1", "Cámara 2").
 */
export function toCameraDevices(inputs: Array<Pick<MediaDeviceInfo, 'deviceId' | 'label'>>): CameraDevice[] {
  const names = inputs.map((d) => cameraName(d.label));
  return inputs.map((d, index) => {
    const name = names[index];
    const same = names.filter((other) => other === name).length;
    const number = names.slice(0, index + 1).filter((other) => other === name).length;
    const label = same > 1 ? t('face.camera.numbered', { name, number }) : name;
    return { deviceId: d.deviceId, label, rawLabel: d.label, kind: detectKind(d.label) };
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
 * una foto. Su nombre contiene uno de los bloqueados como palabra completa ("OBSBOT" no es "obs"), sin
 * distinguir mayúsculas ni acentos («Câmera virtual», «Caméra virtuelle», «Virtuelle Kamera», «Fotocamera
 * virtuale»: el sistema los escribe en SU idioma, con o sin acentos; `foldText` en los dos lados, como el backend).
 * La lista viene del backend (política de verificación), que también la exige al recibir capturas.
 */
export function isVirtualCamera(label: string | null | undefined, blocked: readonly string[]): boolean {
  if (!label) return false;
  const text = foldText(label);
  return blocked.some((name) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(foldText(name))}(?![\\p{L}\\p{N}_])`, 'u').test(text));
}
